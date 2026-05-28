import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja, isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const traspasos = await prisma.traspaso.findMany({ orderBy: { fecha: 'desc' } });

  return NextResponse.json(
    traspasos.map((t) => ({
      ...t,
      montoOrigen: parseFloat(t.montoOrigen.toString()),
      montoDestino: parseFloat(t.montoDestino.toString()),
      tipoCambioUsado: parseFloat(t.tipoCambioUsado.toString()),
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const { cajaOrigen, cajaDestino, montoOrigen, tipoCambioUsado, descripcion, fecha } = await req.json();

    const montoOrigenNum = parseFloat(montoOrigen);
    const tcNum = parseFloat(tipoCambioUsado);
    const montoDestino = cajaOrigen === 'ARS' ? montoOrigenNum / tcNum : montoOrigenNum * tcNum;
    const fechaDate = fecha ? new Date(fecha) : new Date();

    const [saldoOrigen, saldoDestino] = await Promise.all([
      getSaldoCaja(cajaOrigen),
      getSaldoCaja(cajaDestino),
    ]);

    const result = await prisma.$transaction(async (tx) => {
      const traspaso = await tx.traspaso.create({
        data: { cajaOrigen, cajaDestino, montoOrigen: montoOrigenNum, montoDestino, tipoCambioUsado: tcNum, descripcion: descripcion || null, fecha: fechaDate },
      });
      const movSalida = await tx.movimientoTesoreria.create({
        data: { caja: cajaOrigen, tipo: 'TRASPASO_SALIDA', descripcion: descripcion || `Traspaso a ${cajaDestino}`, monto: montoOrigenNum, saldoResultante: saldoOrigen - montoOrigenNum, traspasoId: traspaso.id, fecha: fechaDate },
      });
      const movEntrada = await tx.movimientoTesoreria.create({
        data: { caja: cajaDestino, tipo: 'TRASPASO_ENTRADA', descripcion: descripcion || `Traspaso desde ${cajaOrigen}`, monto: montoDestino, saldoResultante: saldoDestino + montoDestino, traspasoId: traspaso.id, fecha: fechaDate },
      });
      return { traspaso, movimientoSalida: movSalida, movimientoEntrada: movEntrada };
    });

    const serialize = (m: typeof result.movimientoSalida) => ({ ...m, monto: parseFloat(m.monto.toString()), saldoResultante: parseFloat(m.saldoResultante.toString()) });
    return NextResponse.json({
      traspaso: { ...result.traspaso, montoOrigen: parseFloat(result.traspaso.montoOrigen.toString()), montoDestino: parseFloat(result.traspaso.montoDestino.toString()), tipoCambioUsado: parseFloat(result.traspaso.tipoCambioUsado.toString()) },
      movimientoSalida: serialize(result.movimientoSalida),
      movimientoEntrada: serialize(result.movimientoEntrada),
    }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear traspaso' }, { status: 500 });
  }
}
