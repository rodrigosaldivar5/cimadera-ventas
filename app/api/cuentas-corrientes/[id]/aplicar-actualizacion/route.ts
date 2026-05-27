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
    const { indiceNuevo, descripcion } = data;

    if (!indiceNuevo) {
      return NextResponse.json({ error: 'El índice nuevo es requerido' }, { status: 400 });
    }

    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: { movimientos: true },
    });
    if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const idxNuevo = Number(indiceNuevo);
    const idxInicio = Number(cuenta.indiceInicio);
    const montoOriginal = Number(cuenta.montoOriginal);

    const totalPagado = cuenta.movimientos
      .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const montoAjustado = montoOriginal * (idxNuevo / idxInicio);
    const saldoActualizado = montoAjustado - totalPagado;

    // Delta vs the current saldo (used as the movement amount)
    const saldoAjusteAnterior = Number(cuenta.saldoActualizado);
    const montoMovimiento = saldoActualizado - saldoAjusteAnterior;

    const descripcionFinal = descripcion?.trim() || `Actualización por ${cuenta.nombreIndice}`;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoCuenta.create({
        data: {
          cuentaId: params.id,
          tipo: TipoMovimiento.ACTUALIZACION,
          descripcion: descripcionFinal,
          monto: Math.abs(montoMovimiento),
          saldoResultante: saldoActualizado,
          fecha: new Date(),
          indiceValor: idxNuevo,
        },
      }),
      prisma.cuentaCorriente.update({
        where: { id: params.id },
        data: {
          indiceActual: idxNuevo,
          saldoActualizado: Math.max(0, saldoActualizado),
          estado: saldoActualizado <= 0 ? EstadoCuenta.CANCELADO : EstadoCuenta.SALDO_PENDIENTE,
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
