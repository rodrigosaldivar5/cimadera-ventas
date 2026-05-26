import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TipoMovimiento, EstadoCuenta } from '@prisma/client';

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const { tipo, descripcion, monto, numeroFactura, fecha, indiceValor } = data;

    if (!tipo || !descripcion || monto === undefined || !fecha) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: { movimientos: { orderBy: { fecha: 'desc' }, take: 1 } },
    });
    if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const lastMovimiento = cuenta.movimientos[0];
    const lastSaldo = lastMovimiento ? Number(lastMovimiento.saldoResultante) : Number(cuenta.montoOriginal);
    const montoNum = Number(monto);

    let saldoResultante: number;
    const updateCuenta: Record<string, unknown> = {};

    if (tipo === TipoMovimiento.ANTICIPO || tipo === TipoMovimiento.PAGO_PARCIAL) {
      saldoResultante = lastSaldo - montoNum;
    } else if (tipo === TipoMovimiento.ACTUALIZACION) {
      saldoResultante = lastSaldo + montoNum;
      if (indiceValor) {
        updateCuenta.indiceActual = Number(indiceValor);
        updateCuenta.saldoActualizado =
          Number(cuenta.montoOriginal) * (Number(indiceValor) / Number(cuenta.indiceInicio));
      }
    } else {
      return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
    }

    if (saldoResultante <= 0) {
      updateCuenta.estado = EstadoCuenta.CANCELADO;
    }

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoCuenta.create({
        data: {
          cuentaId: params.id,
          tipo,
          descripcion,
          monto: montoNum,
          saldoResultante,
          numeroFactura: numeroFactura || null,
          fecha: new Date(fecha),
          indiceValor: indiceValor ? Number(indiceValor) : null,
        },
      }),
      prisma.cuentaCorriente.update({
        where: { id: params.id },
        data: {
          saldoActualizado: saldoResultante > 0 ? saldoResultante : 0,
          ...updateCuenta,
        },
      }),
    ]);

    const cuentaActualizada = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json({ movimiento, cuenta: cuentaActualizada }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}
