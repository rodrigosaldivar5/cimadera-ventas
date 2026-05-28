import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja, isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const caja = searchParams.get('caja');
  const tipo = searchParams.get('tipo');
  const fechaDesde = searchParams.get('fechaDesde');
  const fechaHasta = searchParams.get('fechaHasta');
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit') ?? 100)));

  const where: Record<string, unknown> = {};
  if (caja && caja !== 'todos') where.caja = caja;
  if (tipo) where.tipo = tipo;
  if (fechaDesde || fechaHasta) {
    where.fecha = {};
    if (fechaDesde) (where.fecha as Record<string, unknown>).gte = new Date(fechaDesde);
    if (fechaHasta) (where.fecha as Record<string, unknown>).lte = new Date(fechaHasta);
  }

  const [movimientos, total] = await Promise.all([
    prisma.movimientoTesoreria.findMany({
      where,
      orderBy: { fecha: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.movimientoTesoreria.count({ where }),
  ]);

  return NextResponse.json({
    movimientos: movimientos.map((m) => ({
      ...m,
      monto: parseFloat(m.monto.toString()),
      saldoResultante: parseFloat(m.saldoResultante.toString()),
    })),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const { caja, tipo, descripcion, monto, fecha } = await req.json();

    if (!['INGRESO', 'EGRESO'].includes(tipo))
      return NextResponse.json({ error: 'Tipo inválido. Solo INGRESO o EGRESO.' }, { status: 400 });

    const saldoAnterior = await getSaldoCaja(caja);
    const montoNum = parseFloat(monto);
    const saldoResultante = tipo === 'INGRESO' ? saldoAnterior + montoNum : saldoAnterior - montoNum;

    const movimiento = await prisma.movimientoTesoreria.create({
      data: {
        caja,
        tipo,
        descripcion,
        monto: montoNum,
        saldoResultante,
        fecha: fecha ? new Date(fecha) : new Date(),
      },
    });

    return NextResponse.json(
      { ...movimiento, monto: parseFloat(movimiento.monto.toString()), saldoResultante: parseFloat(movimiento.saldoResultante.toString()) },
      { status: 201 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
  }
}
