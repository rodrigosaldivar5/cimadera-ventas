import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNetoPresupuesto } from '@/lib/presupuestos/montos';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desdeParam = searchParams.get('desde');
  const hastaParam = searchParams.get('hasta');

  const now = new Date();
  let inicio: Date;
  let fin: Date;

  if (desdeParam && hastaParam) {
    inicio = new Date(desdeParam);
    fin = new Date(hastaParam);
  } else {
    const periodo = searchParams.get('periodo') ?? 'mes_actual';
    const mesParam = Number(searchParams.get('mes') ?? now.getMonth() + 1);
    const anioParam = Number(searchParams.get('anio') ?? now.getFullYear());
    if (periodo === 'mes_actual') {
      inicio = startOfMonth(now);
      fin = endOfMonth(now);
    } else if (periodo === 'anio_actual') {
      inicio = startOfYear(now);
      fin = endOfYear(now);
    } else if (periodo === 'mes') {
      const ref = new Date(anioParam, mesParam - 1, 1);
      inicio = startOfMonth(ref);
      fin = endOfMonth(ref);
    } else {
      inicio = startOfYear(new Date(anioParam, 0, 1));
      fin = endOfYear(new Date(anioParam, 0, 1));
    }
  }

  const agruparPor = searchParams.get('agrupar') ?? 'mes';

  const rows = await prisma.presupuesto.findMany({
    where: { estado: 'APROBADO', fechaCreacion: { gte: inicio, lte: fin } },
    select: {
      fechaCreacion: true,
      tasaIva: true,
      totalFinal: true,
      precioFinal: true,
      montoIva: true,
      totalConIva: true,
    },
    orderBy: { fechaCreacion: 'asc' },
  });

  // Group by period key
  const grouped: Record<string, { neto0: number; neto105: number; neto21: number; iva105: number; iva21: number; totalConIva: number }> = {};

  for (const r of rows) {
    const d = new Date(r.fechaCreacion);
    const key = agruparPor === 'anio'
      ? `${d.getFullYear()}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[key]) grouped[key] = { neto0: 0, neto105: 0, neto21: 0, iva105: 0, iva21: 0, totalConIva: 0 };

    const tasa = Number(r.tasaIva);
    const neto = getNetoPresupuesto(r);
    const iva = Number(r.montoIva) > 0 ? Number(r.montoIva) : neto * (tasa / 100);
    const total = Number(r.totalConIva) > 0 ? Number(r.totalConIva) : (tasa === 0 ? neto : neto + iva);

    if (tasa === 0) {
      grouped[key].neto0 += neto;
    } else if (tasa === 10.5) {
      grouped[key].neto105 += neto;
      grouped[key].iva105 += iva;
      grouped[key].totalConIva += total;
    } else {
      grouped[key].neto21 += neto;
      grouped[key].iva21 += iva;
      grouped[key].totalConIva += total;
    }
  }

  const filas = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([periodo, data]) => ({ periodo, ...data }));

  const has105 = filas.some((f) => f.neto105 > 0);

  const totales = filas.reduce(
    (acc, f) => ({
      netoTotal: acc.netoTotal + f.neto0 + f.neto105 + f.neto21,
      neto0Total: acc.neto0Total + f.neto0,
      neto105Total: acc.neto105Total + f.neto105,
      neto21Total: acc.neto21Total + f.neto21,
      iva105Total: acc.iva105Total + f.iva105,
      iva21Total: acc.iva21Total + f.iva21,
      ivaTotal: acc.ivaTotal + f.iva105 + f.iva21,
      totalConIvaTotal: acc.totalConIvaTotal + f.totalConIva,
    }),
    { netoTotal: 0, neto0Total: 0, neto105Total: 0, neto21Total: 0, iva105Total: 0, iva21Total: 0, ivaTotal: 0, totalConIvaTotal: 0 }
  );

  return NextResponse.json({ filas, totales, has105, inicio, fin });
}
