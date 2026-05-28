import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TipoMovimiento } from '@prisma/client';

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await req.json();
    const { indiceNuevo, descripcion } = body;

    if (!indiceNuevo) {
      return NextResponse.json({ error: 'El índice nuevo es requerido' }, { status: 400 });
    }

    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: { movimientos: true },
    });
    if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    // Immutable — read only, never written
    const idxInicio     = parseFloat(cuenta.indiceInicio.toString());
    const montoOriginal = parseFloat(cuenta.montoOriginal.toString());
    const idxNuevo      = parseFloat(indiceNuevo.toString());

    const totalPagado = cuenta.movimientos
      .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum, m) => sum + parseFloat(m.monto.toString()), 0);

    // saldoActualizado = montoOriginal × (idxNuevo / idxInicio) - totalPagado
    const montoAjustadoTotal = montoOriginal * (idxNuevo / idxInicio);
    const saldoActualizado   = montoAjustadoTotal - totalPagado;

    // ajuste = diferencia entre saldo nuevo y saldo anterior almacenado
    const saldoAnterior = parseFloat(cuenta.saldoActualizado.toString());
    const ajuste        = saldoActualizado - saldoAnterior;

    const descripcionFinal =
      descripcion?.trim() ||
      `Actualización por ${cuenta.nombreIndice} (→ ${idxNuevo})`;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoCuenta.create({
        data: {
          cuentaId: params.id,
          tipo: TipoMovimiento.ACTUALIZACION,
          descripcion: descripcionFinal,
          monto: ajuste,
          saldoResultante: saldoActualizado,
          fecha: new Date(),
          indiceValor: idxNuevo,
        },
      }),
      prisma.cuentaCorriente.update({
        where: { id: params.id },
        data: {
          indiceActual:     idxNuevo,
          saldoActualizado: saldoActualizado,
          estado: saldoActualizado <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
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

    return NextResponse.json({ movimiento, cuenta: cuentaActualizada });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al aplicar actualización' }, { status: 500 });
  }
}
