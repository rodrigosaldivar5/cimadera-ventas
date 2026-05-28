import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja, isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const [saldoARS, saldoUSD, tipoCambio, canjes, movimientosRecientes] = await Promise.all([
    getSaldoCaja('ARS'),
    getSaldoCaja('USD'),
    prisma.tipoCambio.findFirst({ orderBy: { fecha: 'desc' } }),
    prisma.activoCanje.findMany(),
    prisma.movimientoTesoreria.findMany({ orderBy: { fecha: 'desc' }, take: 10 }),
  ]);

  const tc = tipoCambio ? parseFloat(tipoCambio.valor.toString()) : 1;

  return NextResponse.json({
    saldoARS,
    saldoUSD,
    tipoCambioActual: tipoCambio ? { id: tipoCambio.id, valor: tc, fecha: tipoCambio.fecha } : null,
    saldoARSenUSD: tc > 0 ? saldoARS / tc : 0,
    saldoUSDenARS: saldoUSD * tc,
    totalCanjesNoLiquidos: canjes
      .filter((c) => c.estado === 'NO_LIQUIDO')
      .reduce((s, c) => s + parseFloat(c.valorEstimado.toString()), 0),
    countCanjes: {
      total: canjes.length,
      noLiquido: canjes.filter((c) => c.estado === 'NO_LIQUIDO').length,
      realizado: canjes.filter((c) => c.estado === 'REALIZADO').length,
    },
    movimientosRecientes: movimientosRecientes.map((m) => ({
      ...m,
      monto: parseFloat(m.monto.toString()),
      saldoResultante: parseFloat(m.saldoResultante.toString()),
    })),
  });
}
