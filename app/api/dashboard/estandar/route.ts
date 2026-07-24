import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTiempoEstandarPresupuesto } from '@/lib/presupuestos/cumplimiento-estandar';
import type { ResultadoEstandar } from '@/lib/presupuestos/cumplimiento-estandar';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const responsableId = searchParams.get('responsableId');

  const filtroResp = responsableId ? { responsableId } : {};

  const presupuestos = await prisma.presupuesto.findMany({
    where: { esEstandar: true, ...filtroResp },
    select: {
      id: true,
      numero: true,
      estado: true,
      fechaCreacion: true,
      cliente: { select: { razonSocial: true } },
      obra: { select: { nombre: true } },
      responsable: { select: { nombre: true } },
    },
  });

  if (presupuestos.length === 0) {
    return NextResponse.json({
      resumen: { finalizados: 0, enTermino: 0, demorados: 0, abiertosVencidos: 0, sinTrazabilidad: 0, cumplimiento: null },
      demorados: [],
      abiertosVencidos: [],
    });
  }

  const ids = presupuestos.map(p => p.id);

  const transiciones = await prisma.presupuestoEstadoTransicion.findMany({
    where: {
      presupuestoId: { in: ids },
      estadoNuevo: { in: ['PENDIENTE', 'FINALIZADO'] },
    },
    select: {
      presupuestoId: true,
      estadoNuevo: true,
      changedAt: true,
    },
    orderBy: { changedAt: 'asc' },
  });

  const transByPres = new Map<string, { estadoNuevo: string; changedAt: Date }[]>();
  for (const t of transiciones) {
    let arr = transByPres.get(t.presupuestoId);
    if (!arr) { arr = []; transByPres.set(t.presupuestoId, arr); }
    arr.push({ estadoNuevo: t.estadoNuevo, changedAt: t.changedAt });
  }

  const ESTADOS_FINALIZADOS = new Set(['FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO']);
  const ESTADOS_ABIERTOS = new Set(['PENDIENTE', 'EN_PROCESO', 'FRENADO']);

  type Row = {
    id: string;
    numero: number;
    cliente: string;
    obra: string | null;
    responsable: string | null;
    estado: string;
    horasHabiles: number;
    inicio: string | null;
    ultimoFinalizado: string | null;
    resultado: ResultadoEstandar;
    excesoHoras?: number;
  };

  let enTermino = 0;
  let demorado = 0;
  let abiertosVencidos = 0;
  let sinTrazabilidad = 0;
  let finalizados = 0;
  const demoradosList: Row[] = [];
  const abiertosVencidosList: Row[] = [];

  const now = new Date();
  const desdeDate = desde ? new Date(desde) : null;
  const hastaDate = hasta ? new Date(hasta) : null;

  for (const p of presupuestos) {
    const trans = transByPres.get(p.id) ?? [];
    const cumpl = getTiempoEstandarPresupuesto(
      { estado: p.estado, fechaCreacion: p.fechaCreacion },
      trans,
      now,
    );

    const esFinalizado = ESTADOS_FINALIZADOS.has(p.estado);
    const esAbierto = ESTADOS_ABIERTOS.has(p.estado);

    if (esFinalizado) {
      if (desdeDate && cumpl.ultimoFinalizado && cumpl.ultimoFinalizado < desdeDate) continue;
      if (hastaDate && cumpl.ultimoFinalizado && cumpl.ultimoFinalizado > hastaDate) continue;
    }

    if (esAbierto) {
      if (hastaDate && p.fechaCreacion > hastaDate) continue;
    }

    const row: Row = {
      id: p.id,
      numero: p.numero,
      cliente: p.cliente.razonSocial,
      obra: p.obra?.nombre ?? null,
      responsable: p.responsable?.nombre ?? null,
      estado: p.estado,
      horasHabiles: cumpl.horasHabiles,
      inicio: cumpl.inicio?.toISOString() ?? null,
      ultimoFinalizado: cumpl.ultimoFinalizado?.toISOString() ?? null,
      resultado: cumpl.resultado,
    };

    switch (cumpl.resultado) {
      case 'EN_TERMINO':
        enTermino++;
        finalizados++;
        break;
      case 'DEMORADO':
        demorado++;
        finalizados++;
        demoradosList.push(row);
        break;
      case 'ABIERTO_VENCIDO':
        abiertosVencidos++;
        row.excesoHoras = Math.round((cumpl.horasHabiles - 27) * 100) / 100;
        abiertosVencidosList.push(row);
        break;
      case 'ABIERTO_EN_TERMINO':
        break;
      case 'SIN_TRAZABILIDAD':
        sinTrazabilidad++;
        break;
    }
  }

  demoradosList.sort((a, b) => b.horasHabiles - a.horasHabiles);
  abiertosVencidosList.sort((a, b) => (b.excesoHoras ?? 0) - (a.excesoHoras ?? 0));

  const denominador = enTermino + demorado;
  const cumplimiento = denominador > 0 ? Math.round((enTermino / denominador) * 1000) / 10 : null;

  return NextResponse.json({
    resumen: { finalizados, enTermino, demorados: demorado, abiertosVencidos, sinTrazabilidad, cumplimiento },
    demorados: demoradosList,
    abiertosVencidos: abiertosVencidosList,
  });
}
