import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoCuenta } from '@prisma/client';

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cuenta = await prisma.cuentaCorriente.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
      obra: { select: { id: true, nombre: true, direccion: true } },
      presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
      movimientos: { orderBy: { fecha: 'asc' } },
    },
  });

  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
  return NextResponse.json(cuenta);
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const { indiceActual, observaciones, estado, proximoCobro, probabilidadCobro } = data;

    const cuentaActual = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: { movimientos: true },
    });
    if (!cuentaActual) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    if (observaciones !== undefined) updateData.observaciones = observaciones;
    if (estado && Object.values(EstadoCuenta).includes(estado)) updateData.estado = estado;
    if (proximoCobro !== undefined) updateData.proximoCobro = proximoCobro ? new Date(proximoCobro) : null;
    if (probabilidadCobro !== undefined && ['ALTA', 'MEDIA', 'BAJA'].includes(probabilidadCobro)) {
      updateData.probabilidadCobro = probabilidadCobro;
    }

    if (indiceActual !== undefined) {
      const idxNuevo    = Number(indiceActual);
      const idxInicio   = Number(cuentaActual.indiceInicio);
      const montoOriginal = Number(cuentaActual.montoOriginal);
      const totalPagado = cuentaActual.movimientos
        .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
        .reduce((sum, m) => sum + Number(m.montoEnARS ?? m.monto), 0);
      const saldoActualizado = (montoOriginal - totalPagado) * (idxNuevo / idxInicio);
      updateData.indiceActual = idxNuevo;
      updateData.saldoActualizado = saldoActualizado;
      updateData.estado = saldoActualizado <= 0 ? EstadoCuenta.CANCELADO : EstadoCuenta.SALDO_PENDIENTE;
    }

    const cuenta = await prisma.cuentaCorriente.update({
      where: { id: params.id },
      data: updateData,
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json(cuenta);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al actualizar cuenta' }, { status: 500 });
  }
}
