import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMontoFinalPresupuesto } from '@/lib/presupuestos/montos';
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
      const [aprobadosARS, aprobadosUSD, tipoCambios] = await Promise.all([
        prisma.presupuesto.findMany({
          where: { estado: 'APROBADO', moneda: 'ARS', fechaCreacion: { gte: inicio, lte: fin } },
          select: { precioFinal: true, totalFinal: true, totalConIva: true },
        }),
        prisma.presupuesto.findMany({
          where: { estado: 'APROBADO', moneda: 'USD', fechaCreacion: { gte: inicio, lte: fin } },
          select: { precioFinal: true, totalFinal: true, totalConIva: true },
        }),
        prisma.tipoCambio.findMany({
          where: { fecha: { gte: inicio, lte: fin } },
          select: { valor: true },
        }),
      ]);

      const ventasARS = aprobadosARS.reduce(
        (s, p) => s + getMontoFinalPresupuesto(p),
        0,
      );
      const ventasUSD = aprobadosUSD.reduce(
        (s, p) => s + getMontoFinalPresupuesto(p),
        0,
      );
      const tcPromedio =
        tipoCambios.length > 0
          ? tipoCambios.reduce((s, t) => s + Number(t.valor), 0) / tipoCambios.length
          : null;
      const equivUSD = tcPromedio && tcPromedio > 0 ? ventasARS / tcPromedio : null;
      const totalUSD = (equivUSD ?? 0) + ventasUSD;

      return { label, ventasARS, tcPromedio, equivUSD, ventasUSD, totalUSD };
    }),
  );

  return NextResponse.json({ rows });
}
