import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { searchParams } = new URL(request.url);
  const caja = searchParams.get('caja') ?? 'all';
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const tipo = searchParams.get('tipo');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  try {
    const where: Prisma.MovimientoTesoreriaWhereInput = {};
    if (caja !== 'all') where.caja = caja as 'ARS' | 'USD';
    if (tipo) where.tipo = tipo as Prisma.MovimientoTesoreriaWhereInput['tipo'];
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    const [total, movimientos] = await Promise.all([
      prisma.movimientoTesoreria.count({ where }),
      prisma.movimientoTesoreria.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
        include: { tipoCambio: true },
      }),
    ]);

    return jsonWithCors({
      total,
      limit,
      offset,
      data: movimientos.map((m) => ({
        id: m.id,
        caja: m.caja,
        tipo: m.tipo,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        saldoResultante: Number(m.saldoResultante),
        fecha: m.fecha,
        tipoCambio: m.tipoCambio ? Number(m.tipoCambio.valor) : null,
        traspasoId: m.traspasoId,
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/tesoreria/movimientos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
