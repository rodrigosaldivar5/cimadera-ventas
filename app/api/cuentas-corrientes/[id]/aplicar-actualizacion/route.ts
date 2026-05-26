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
      include: { movimientos: { orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }], take: 1 } },
    });
    if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const lastMovimiento = cuenta.movimientos[0];
    const lastSaldo = lastMovimiento
      ? Number(lastMovimiento.saldoResultante)
      : Number(cuenta.montoOriginal);

    const idxNuevo = Number(indiceNuevo);
    const idxActual = Number(cuenta.indiceActual);

    // ajuste = lastSaldo × (indiceNuevo / indiceActual - 1)
    const ajuste = lastSaldo * (idxNuevo / idxActual - 1);
    const saldoResultante = lastSaldo + ajuste;

    const saldoActualizado =
      Number(cuenta.montoOriginal) * (idxNuevo / Number(cuenta.indiceInicio));

    const estadoNuevo = saldoResultante <= 0 ? EstadoCuenta.CANCELADO : undefined;

    const descripcionFinal =
      descripcion?.trim() || `Actualización por ${cuenta.nombreIndice}`;

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoCuenta.create({
        data: {
          cuentaId: params.id,
          tipo: TipoMovimiento.ACTUALIZACION,
          descripcion: descripcionFinal,
          monto: ajuste,
          saldoResultante,
          fecha: new Date(),
          indiceValor: idxNuevo,
        },
      }),
      prisma.cuentaCorriente.update({
        where: { id: params.id },
        data: {
          indiceActual: idxNuevo,
          saldoActualizado: Math.max(0, saldoActualizado),
          ...(estadoNuevo ? { estado: estadoNuevo } : {}),
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
