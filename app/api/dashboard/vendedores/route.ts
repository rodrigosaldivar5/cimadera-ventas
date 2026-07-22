import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ESTADOS_FINALIZADOS_COTIZADOR } from '@/lib/mi-trabajo';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desdeParam = searchParams.get('desde');
  const hastaParam = searchParams.get('hasta');

  const now = new Date();
  const desde = desdeParam ? new Date(desdeParam) : subMonths(startOfMonth(now), 5);
  const hasta = hastaParam ? new Date(hastaParam) : endOfMonth(now);

  const meses: { inicio: Date; fin: Date; label: string }[] = [];
  let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  while (cursor <= hasta) {
    meses.push({
      inicio: startOfMonth(cursor),
      fin: endOfMonth(cursor),
      label: format(cursor, 'MMM yy', { locale: es }),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const finalizadosSet = new Set(ESTADOS_FINALIZADOS_COTIZADOR as string[]);

  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      responsableId: { not: null },
      fechaCreacion: { gte: desde, lte: hasta },
    },
    select: {
      id: true,
      estado: true,
      fechaCreacion: true,
      fechaCierreComercial: true,
      responsable: { select: { id: true, nombre: true } },
    },
  });

  const presIds = presupuestos.filter(p => finalizadosSet.has(p.estado)).map(p => p.id);

  // Primera transición a un estado finalizado para cada presupuesto
  const transiciones = presIds.length > 0
    ? await prisma.presupuestoEstadoTransicion.findMany({
        where: {
          presupuestoId: { in: presIds },
          estadoNuevo: { in: ESTADOS_FINALIZADOS_COTIZADOR as string[] },
        },
        select: { presupuestoId: true, changedAt: true },
        orderBy: { changedAt: 'asc' },
      })
    : [];

  // Map: presupuestoId → fecha de primera transición a finalizado
  const fechaFinalizacionMap = new Map<string, Date>();
  for (const t of transiciones) {
    if (!fechaFinalizacionMap.has(t.presupuestoId)) {
      fechaFinalizacionMap.set(t.presupuestoId, t.changedAt);
    }
  }

  const responsableMap = new Map<string, string>();
  for (const p of presupuestos) {
    if (p.responsable) {
      responsableMap.set(p.responsable.id, p.responsable.nombre ?? 'Sin nombre');
    }
  }

  type SeriesPoint = { label: string; count: number };
  const seriesMap = new Map<string, SeriesPoint[]>();
  const resumenMap = new Map<string, { asignados: number; finalizados: number; abiertos: number }>();

  for (const respId of Array.from(responsableMap.keys())) {
    seriesMap.set(respId, meses.map(m => ({ label: m.label, count: 0 })));
    resumenMap.set(respId, { asignados: 0, finalizados: 0, abiertos: 0 });
  }

  for (const p of presupuestos) {
    if (!p.responsable) continue;
    const respId = p.responsable.id;
    const resumen = resumenMap.get(respId)!;
    resumen.asignados++;

    if (finalizadosSet.has(p.estado)) {
      resumen.finalizados++;
      // Prioridad: transición a FINALIZADO > fechaCierreComercial > fechaCreacion (fallback)
      const fechaTransicion = fechaFinalizacionMap.get(p.id);
      const d = new Date(fechaTransicion ?? p.fechaCierreComercial ?? p.fechaCreacion);
      const mesIdx = meses.findIndex(m => d >= m.inicio && d <= m.fin);
      if (mesIdx >= 0) {
        seriesMap.get(respId)![mesIdx].count++;
      }
    } else {
      resumen.abiertos++;
    }
  }

  const entries = Array.from(responsableMap.entries());

  const series = entries.map(([id, nombre]) => ({
    id,
    nombre,
    data: seriesMap.get(id) ?? [],
  }));

  const resumen = entries.map(([id, nombre]) => {
    const r = resumenMap.get(id)!;
    return {
      id,
      nombre,
      asignados: r.asignados,
      finalizados: r.finalizados,
      abiertos: r.abiertos,
      pctFinalizacion: r.asignados > 0 ? Math.round((r.finalizados / r.asignados) * 100) : 0,
    };
  }).sort((a, b) => b.finalizados - a.finalizados);

  const labels = meses.map(m => m.label);

  return NextResponse.json({ series, resumen, labels });
}
