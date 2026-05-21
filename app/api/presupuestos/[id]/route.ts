import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: { cliente: true, creadoPor: true, lineas: { include: { item: true } }, puertas: { include: { tipoPuerta: true } } },
  });

  if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(presupuesto);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();

    // Eliminar puertas y líneas existentes para recrearlas
    await prisma.puertaPresupuesto.deleteMany({ where: { presupuestoId: params.id } });
    await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoId: params.id } });

    const presupuesto = await prisma.presupuesto.update({
      where: { id: params.id },
      data: {
        clienteId: data.clienteId,
        estado: data.estado,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        observaciones: data.observaciones ?? null,
        descuento: data.descuento ?? 0,
        subtotal: data.subtotal ?? 0,
        totalFinal: data.totalFinal ?? 0,
        puertas: { create: data.puertas ?? [] },
        lineas: { create: (data.lineas ?? []).filter((l: { itemId: string }) => l.itemId) },
      },
    });

    return NextResponse.json(presupuesto);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.presupuesto.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
