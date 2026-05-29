import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  try {
    const [movimientos, canjes, tipoCambioActual] = await Promise.all([
      prisma.movimientoTesoreria.findMany({
        orderBy: { fecha: 'desc' },
        take: 20,
        include: { tipoCambio: true },
      }),
      prisma.activoCanje.findMany(),
      prisma.tipoCambio.findFirst({ orderBy: { fecha: 'desc' } }),
    ]);

    // Calculate balances from all movements
    const saldoARS = movimientos
      .filter((m) => m.caja === 'ARS')
      .reduce((_, m) => Number(m.saldoResultante), 0);
    const saldoUSD = movimientos
      .filter((m) => m.caja === 'USD')
      .reduce((_, m) => Number(m.saldoResultante), 0);

    // Get latest balance per caja
    const ultimoARS = await prisma.movimientoTesoreria.findFirst({
      where: { caja: 'ARS' }, orderBy: { fecha: 'desc' },
    });
    const ultimoUSD = await prisma.movimientoTesoreria.findFirst({
      where: { caja: 'USD' }, orderBy: { fecha: 'desc' },
    });

    const tc = tipoCambioActual ? Number(tipoCambioActual.valor) : 1;

    const totalCanjesNoLiquido = canjes
      .filter((c) => c.estado === 'NO_LIQUIDO')
      .reduce((s, c) => s + Number(c.valorEstimado), 0);
    const totalCanjesRealizado = canjes
      .filter((c) => c.estado === 'REALIZADO')
      .reduce((s, c) => s + Number(c.valorVenta ?? 0), 0);
    const gananciaTotal = canjes
      .filter((c) => c.estado === 'REALIZADO')
      .reduce((s, c) => s + Number(c.gananciaUSD ?? 0), 0);

    const sARS = ultimoARS ? Number(ultimoARS.saldoResultante) : 0;
    const sUSD = ultimoUSD ? Number(ultimoUSD.saldoResultante) : 0;

    return jsonWithCors({
      saldoARS: sARS,
      saldoUSD: sUSD,
      tipoCambioActual: tipoCambioActual
        ? { valor: Number(tipoCambioActual.valor), fecha: tipoCambioActual.fecha }
        : null,
      saldoARSenUSD: tc > 0 ? Math.round(sARS / tc) : 0,
      saldoUSDenARS: Math.round(sUSD * tc),
      totalCanjes: {
        noLiquido: totalCanjesNoLiquido,
        realizadoAcumulado: totalCanjesRealizado,
        gananciaTotal,
      },
      movimientosRecientes: movimientos.map((m) => ({
        id: m.id,
        caja: m.caja,
        tipo: m.tipo,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        saldoResultante: Number(m.saldoResultante),
        fecha: m.fecha,
        tipoCambio: m.tipoCambio ? Number(m.tipoCambio.valor) : null,
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/tesoreria/resumen:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
