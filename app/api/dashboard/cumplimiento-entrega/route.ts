import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCumplimientoEntregaPresupuesto } from '@/lib/presupuestos/cumplimiento-entrega';
import type { ResultadoEntrega } from '@/lib/presupuestos/cumplimiento-entrega';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const responsableId = searchParams.get('responsableId');

  const filtroResp = responsableId ? { responsableId } : {};

  const wherePrometida: Record<string, unknown> = {};
  if (desde) {
    const [y, m, d] = desde.split('-').map(Number);
    wherePrometida.gte = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  }
  if (hasta) {
    const [y, m, d] = hasta.split('-').map(Number);
    wherePrometida.lte = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999));
  }

  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      fechaPrometidaCliente: { not: null, ...wherePrometida },
      ...filtroResp,
    },
    select: {
      id: true,
      numero: true,
      estado: true,
      fechaPrometidaCliente: true,
      cliente: { select: { razonSocial: true } },
      obra: { select: { nombre: true } },
      responsable: { select: { nombre: true } },
    },
  });

  if (presupuestos.length === 0) {
    return NextResponse.json({
      resumen: { conFecha: 0, enTermino: 0, fueraDeTermino: 0, vencidosSinEnviar: 0, pendientes: 0, sinTrazabilidad: 0, cumplimiento: null },
      vencidosSinEnviar: [],
      fueraDeTermino: [],
      sinTrazabilidad: [],
    });
  }

  const ids = presupuestos.map(p => p.id);

  const transiciones = await prisma.presupuestoEstadoTransicion.findMany({
    where: {
      presupuestoId: { in: ids },
      estadoNuevo: 'ENVIADO',
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

  type Row = {
    id: string;
    numero: number;
    cliente: string;
    obra: string | null;
    responsable: string | null;
    estado: string;
    fechaPrometida: string | null;
    primeraFechaEnviado: string | null;
    minutosDemoraCalendario: number;
    minutosDemoraHabiles: number;
    resultado: ResultadoEntrega;
  };

  const now = new Date();
  let enTermino = 0;
  let fueraDeTermino = 0;
  let vencidosSinEnviar = 0;
  let pendientes = 0;
  let sinTrazabilidad = 0;
  const fueraDeTerminoList: Row[] = [];
  const vencidosSinEnviarList: Row[] = [];
  const sinTrazabilidadList: Row[] = [];

  for (const p of presupuestos) {
    const trans = transByPres.get(p.id) ?? [];
    const cumpl = getCumplimientoEntregaPresupuesto(
      { estado: p.estado, fechaPrometidaCliente: p.fechaPrometidaCliente },
      trans,
      now,
    );

    const row: Row = {
      id: p.id,
      numero: p.numero,
      cliente: p.cliente.razonSocial,
      obra: p.obra?.nombre ?? null,
      responsable: p.responsable?.nombre ?? null,
      estado: p.estado,
      fechaPrometida: cumpl.fechaPrometida?.toISOString() ?? null,
      primeraFechaEnviado: cumpl.primeraFechaEnviado?.toISOString() ?? null,
      minutosDemoraCalendario: cumpl.minutosDemoraCalendario,
      minutosDemoraHabiles: cumpl.minutosDemoraHabiles,
      resultado: cumpl.resultado,
    };

    switch (cumpl.resultado) {
      case 'EN_TERMINO':
        enTermino++;
        break;
      case 'FUERA_DE_TERMINO':
        fueraDeTermino++;
        fueraDeTerminoList.push(row);
        break;
      case 'VENCIDO_SIN_ENTREGAR':
        vencidosSinEnviar++;
        vencidosSinEnviarList.push(row);
        break;
      case 'PENDIENTE':
        pendientes++;
        break;
      case 'SIN_TRAZABILIDAD':
        sinTrazabilidad++;
        sinTrazabilidadList.push(row);
        break;
    }
  }

  vencidosSinEnviarList.sort((a, b) => b.minutosDemoraCalendario - a.minutosDemoraCalendario);
  fueraDeTerminoList.sort((a, b) => b.minutosDemoraCalendario - a.minutosDemoraCalendario);

  const denominador = enTermino + fueraDeTermino + vencidosSinEnviar;
  const cumplimiento = denominador > 0 ? Math.round((enTermino / denominador) * 1000) / 10 : null;

  return NextResponse.json({
    resumen: {
      conFecha: presupuestos.length,
      enTermino,
      fueraDeTermino,
      vencidosSinEnviar,
      pendientes,
      sinTrazabilidad,
      cumplimiento,
    },
    vencidosSinEnviar: vencidosSinEnviarList,
    fueraDeTermino: fueraDeTerminoList,
    sinTrazabilidad: sinTrazabilidadList,
  });
}
