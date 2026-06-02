import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TipoMovimiento, EstadoCuenta } from '@prisma/client';

const ADMIN_EMAILS = ['coordinacion.general@cimadera.net', 'admin@cimadera.net'];

type RouteContext = { params: { id: string; movimientoId: string } };

async function recalcularSaldos(cuentaId: string, desdeMovimientoId: string) {
  // Get all movements ordered by fecha, starting from the one before the affected one
  const allMovimientos = await prisma.movimientoCuenta.findMany({
    where: { cuentaId },
    orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
  });

  const idx = allMovimientos.findIndex((m) => m.id === desdeMovimientoId);
  if (idx <= 0) return; // nothing to recalculate if it's the first movement

  // saldo base is from the movement before `idx`
  let saldoBase = Number(allMovimientos[idx - 1].saldoResultante);

  for (let i = idx; i < allMovimientos.length; i++) {
    const mov = allMovimientos[i];
    let nuevoSaldo: number;
    if (mov.tipo === TipoMovimiento.ANTICIPO || mov.tipo === TipoMovimiento.PAGO_PARCIAL) {
      nuevoSaldo = saldoBase - Number(mov.monto);
    } else {
      // ACTUALIZACION
      nuevoSaldo = saldoBase + Number(mov.monto);
    }
    await prisma.movimientoCuenta.update({
      where: { id: mov.id },
      data: { saldoResultante: nuevoSaldo },
    });
    saldoBase = nuevoSaldo;
  }

  // Update the cuenta's saldoActualizado based on the final saldo
  const lastSaldo = saldoBase;
  const cuenta = await prisma.cuentaCorriente.findUnique({ where: { id: cuentaId } });
  if (cuenta) {
    await prisma.cuentaCorriente.update({
      where: { id: cuentaId },
      data: {
        saldoActualizado: Math.max(0, lastSaldo),
        estado: lastSaldo <= 0 ? EstadoCuenta.CANCELADO : undefined,
      },
    });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!ADMIN_EMAILS.includes(session.user.email ?? '')) {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar movimientos' }, { status: 403 });
  }

  try {
    const movimiento = await prisma.movimientoCuenta.findUnique({
      where: { id: params.movimientoId },
    });
    if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    if (movimiento.cuentaId !== params.id) {
      return NextResponse.json({ error: 'El movimiento no pertenece a esta cuenta' }, { status: 400 });
    }
    if (movimiento.tipo === TipoMovimiento.CARGO_INICIAL) {
      return NextResponse.json({ error: 'No se puede eliminar el cargo inicial' }, { status: 400 });
    }

    // Get next movement before deleting, to know from where to recalculate
    const movimientosOrdenados = await prisma.movimientoCuenta.findMany({
      where: { cuentaId: params.id },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }],
    });
    const idxDeleted = movimientosOrdenados.findIndex((m) => m.id === params.movimientoId);
    const nextMovimiento = movimientosOrdenados[idxDeleted + 1] ?? null;

    await prisma.movimientoCuenta.delete({ where: { id: params.movimientoId } });

    if (nextMovimiento) {
      await recalcularSaldos(params.id, nextMovimiento.id);
    } else {
      // Deleted the last movement — update saldo to the one before
      const prevMovimiento = movimientosOrdenados[idxDeleted - 1];
      if (prevMovimiento) {
        await prisma.cuentaCorriente.update({
          where: { id: params.id },
          data: {
            saldoActualizado: Math.max(0, Number(prevMovimiento.saldoResultante)),
            estado:
              Number(prevMovimiento.saldoResultante) <= 0
                ? EstadoCuenta.CANCELADO
                : EstadoCuenta.SALDO_PENDIENTE,
          },
        });
      }
    }

    const cuentaActualizada = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json(cuentaActualizada);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const { descripcion, monto, numeroFactura, fecha, caja, tipoCambio } = data;

    const movimiento = await prisma.movimientoCuenta.findUnique({
      where: { id: params.movimientoId },
    });
    if (!movimiento) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
    if (movimiento.cuentaId !== params.id) {
      return NextResponse.json({ error: 'El movimiento no pertenece a esta cuenta' }, { status: 400 });
    }
    if (
      movimiento.tipo !== TipoMovimiento.ANTICIPO &&
      movimiento.tipo !== TipoMovimiento.PAGO_PARCIAL
    ) {
      return NextResponse.json({ error: 'Solo se pueden editar movimientos de tipo ANTICIPO o PAGO_PARCIAL' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (monto !== undefined) updateData.monto = Number(monto);
    if (numeroFactura !== undefined) updateData.numeroFactura = numeroFactura || null;
    if (fecha !== undefined) updateData.fecha = new Date(fecha);
    if (caja !== undefined) updateData.caja = caja || null;
    if (tipoCambio !== undefined) updateData.tipoCambio = tipoCambio != null ? Number(tipoCambio) : null;

    await prisma.movimientoCuenta.update({
      where: { id: params.movimientoId },
      data: updateData,
    });

    // Recalculate saldos from this movement onwards
    await recalcularSaldos(params.id, params.movimientoId);

    const cuentaActualizada = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json(cuentaActualizada);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al editar movimiento' }, { status: 500 });
  }
}
