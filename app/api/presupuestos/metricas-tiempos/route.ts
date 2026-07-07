import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcularMinutosHabiles } from '@/lib/business-time';

export const dynamic = 'force-dynamic';

type ResumenResponsable = {
  responsableId: string | null;
  responsableNombre: string;
  totalPresupuestos: number;
  minutosEnProceso: number;
  minutosFrenado: number;
  minutosPromedio: number;
  porcentajeJornada: number;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desdeStr       = searchParams.get('desde');
  const hastaStr       = searchParams.get('hasta');
  const responsableId  = searchParams.get('responsableId') || null;

  const desde = desdeStr ? new Date(desdeStr) : null;
  const hasta = hastaStr ? new Date(hastaStr + 'T23:59:59') : null;

  const transiciones = await prisma.presupuestoEstadoTransicion.findMany({
    where: {
      ...(desde || hasta ? {
        changedAt: {
          ...(desde ? { gte: desde } : {}),
          ...(hasta ? { lte: hasta } : {}),
        },
      } : {}),
      ...(responsableId ? { responsableId } : {}),
    },
    orderBy: { changedAt: 'asc' },
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          responsableId: true,
          responsable: { select: { id: true, nombre: true } },
          fechaCreacion: true,
        },
      },
    },
  });

  // Group transitions by presupuesto
  const porPresupuesto = new Map<string, typeof transiciones>();
  for (const t of transiciones) {
    const arr = porPresupuesto.get(t.presupuestoId) ?? [];
    arr.push(t);
    porPresupuesto.set(t.presupuestoId, arr);
  }

  const now = new Date();
  const statsMap = new Map<string, {
    id: string | null;
    nombre: string;
    presupuestos: Set<string>;
    minutosEnProceso: number;
    minutosFrenado: number;
  }>();

  for (const [presupuestoId, trns] of Array.from(porPresupuesto)) {
    const p = trns[0].presupuesto;
    const respId   = p.responsable?.id ?? null;
    const respName = p.responsable?.nombre ?? 'Sin asignar';
    const key = respId ?? '__sin_asignar__';

    if (!statsMap.has(key)) {
      statsMap.set(key, { id: respId, nombre: respName, presupuestos: new Set(), minutosEnProceso: 0, minutosFrenado: 0 });
    }
    const stats = statsMap.get(key)!;
    stats.presupuestos.add(presupuestoId);

    // Reconstruct tramos for this presupuesto
    let currentEstado = trns[0].estadoAnterior ?? 'PENDIENTE';
    let entryTime: Date = p.fechaCreacion;

    for (const t of trns) {
      const effectiveStart = desde ? new Date(Math.max(entryTime.getTime(), desde.getTime())) : entryTime;
      const effectiveEnd   = t.changedAt;
      if (effectiveStart < effectiveEnd) {
        const mins = calcularMinutosHabiles(effectiveStart, effectiveEnd);
        if (currentEstado === 'EN_PROCESO') stats.minutosEnProceso += mins;
        if (currentEstado === 'FRENADO')    stats.minutosFrenado   += mins;
      }
      currentEstado = t.estadoNuevo;
      entryTime = t.changedAt;
    }

    // Count current open state if within range
    const rangeEnd = hasta ?? now;
    if (entryTime < rangeEnd) {
      const effectiveStart = desde ? new Date(Math.max(entryTime.getTime(), desde.getTime())) : entryTime;
      if (effectiveStart < rangeEnd) {
        const mins = calcularMinutosHabiles(effectiveStart, rangeEnd);
        if (currentEstado === 'EN_PROCESO') stats.minutosEnProceso += mins;
        if (currentEstado === 'FRENADO')    stats.minutosFrenado   += mins;
      }
    }
  }

  // Calculate period length in business minutes for % jornada
  const periodoStart = desde ?? (transiciones[0]?.changedAt ?? now);
  const periodoEnd   = hasta ?? now;
  const minutosPeriodo = calcularMinutosHabiles(periodoStart, periodoEnd);

  const resumenPorResponsable: ResumenResponsable[] = Array.from(statsMap.values() as Iterable<{
    id: string | null; nombre: string; presupuestos: Set<string>; minutosEnProceso: number; minutosFrenado: number;
  }>).map((s) => {
    const total = s.presupuestos.size;
    const minutosTotal = s.minutosEnProceso + s.minutosFrenado;
    return {
      responsableId:      s.id,
      responsableNombre:  s.nombre,
      totalPresupuestos:  total,
      minutosEnProceso:   Math.round(s.minutosEnProceso),
      minutosFrenado:     Math.round(s.minutosFrenado),
      minutosPromedio:    total > 0 ? Math.round(minutosTotal / total) : 0,
      porcentajeJornada:  minutosPeriodo > 0 ? Math.round((minutosTotal / minutosPeriodo) * 100) : 0,
    };
  }).sort((a, b) => b.minutosEnProceso - a.minutosEnProceso);

  const totales = resumenPorResponsable.reduce(
    (acc, r) => ({
      totalPresupuestos: acc.totalPresupuestos + r.totalPresupuestos,
      minutosEnProceso:  acc.minutosEnProceso  + r.minutosEnProceso,
      minutosFrenado:    acc.minutosFrenado     + r.minutosFrenado,
    }),
    { totalPresupuestos: 0, minutosEnProceso: 0, minutosFrenado: 0 },
  );

  return NextResponse.json({ resumenPorResponsable, totales });
}
