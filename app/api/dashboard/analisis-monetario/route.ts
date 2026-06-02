import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const desdeParam = searchParams.get('desde');
  const hastaParam = searchParams.get('hasta');

  const now = new Date();
  const desde = desdeParam ? new Date(desdeParam) : subMonths(startOfMonth(now), 11);
  const hasta = hastaParam ? new Date(hastaParam) : endOfMonth(now);

  // Build 1-month buckets across the range
  const meses: { inicio: Date; fin: Date; label: string }[] = [];
  let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  while (cursor <= hasta) {
    meses.push({
      inicio: startOfMonth(cursor),
      fin: endOfMonth(cursor),
      label: format(cursor, 'MMM yyyy', { locale: es }),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  const rows = await Promise.all(
    meses.map(async ({ inicio, fin, label }) => {
      const [aprobados, cobrosUSD, tipoCambios] = await Promise.all([
        prisma.presupuesto.findMany({
          where: { estado: 'APROBADO', fechaCreacion: { gte: inicio, lte: fin } },
          select: { precioFinal: true, totalFinal: true },
        }),
        prisma.movimientoCuenta.findMany({
          where: { caja: 'USD', tipo: { in: ['ANTICIPO', 'PAGO_PARCIAL'] }, fecha: { gte: inicio, lte: fin } },
          select: { monto: true },
        }),
        prisma.tipoCambio.findMany({
          where: { fecha: { gte: inicio, lte: fin } },
          select: { valor: true },
        }),
      ]);

      const ventasARS = aprobados.reduce(
        (s, p) => s + Number(p.precioFinal ?? p.totalFinal ?? 0),
        0,
      );
      const cobrosUSDTotal = cobrosUSD.reduce((s, m) => s + Number(m.monto), 0);
      const tcPromedio =
        tipoCambios.length > 0
          ? tipoCambios.reduce((s, t) => s + Number(t.valor), 0) / tipoCambios.length
          : null;
      const equivUSD = tcPromedio && tcPromedio > 0 ? ventasARS / tcPromedio : null;
      const totalUSD = (equivUSD ?? 0) + cobrosUSDTotal;

      return { label, ventasARS, tcPromedio, equivUSD, cobrosUSD: cobrosUSDTotal, totalUSD };
    }),
  );

  return NextResponse.json({ rows });
}
