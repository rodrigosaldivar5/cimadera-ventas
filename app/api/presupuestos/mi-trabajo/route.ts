import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFechaKeyArgentina } from '@/lib/mi-trabajo';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fechaKey = searchParams.get('fecha') ?? getFechaKeyArgentina();

  const items = await prisma.presupuestoTrabajoDia.findMany({
    where: { userId: session.user.id, fechaKey },
    orderBy: { orden: 'asc' },
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          nombrePresupuesto: true,
          estado: true,
          cliente: { select: { razonSocial: true } },
          obra: { select: { nombre: true } },
        },
      },
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { presupuestoId, nota } = await req.json();
  if (!presupuestoId) {
    return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 });
  }

  const fechaKey = getFechaKeyArgentina();

  const existing = await prisma.presupuestoTrabajoDia.findUnique({
    where: { userId_presupuestoId_fechaKey: { userId: session.user.id, presupuestoId, fechaKey } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Ya está en la lista de hoy' }, { status: 409 });
  }

  const maxOrden = await prisma.presupuestoTrabajoDia.aggregate({
    where: { userId: session.user.id, fechaKey },
    _max: { orden: true },
  });

  const item = await prisma.presupuestoTrabajoDia.create({
    data: {
      userId: session.user.id,
      presupuestoId,
      fechaKey,
      orden: (maxOrden._max.orden ?? -1) + 1,
      nota: nota ?? null,
    },
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          nombrePresupuesto: true,
          estado: true,
          cliente: { select: { razonSocial: true } },
          obra: { select: { nombre: true } },
        },
      },
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const item = await prisma.presupuestoTrabajoDia.findUnique({ where: { id } });
  if (!item || item.userId !== session.user.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await prisma.presupuestoTrabajoDia.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, completado, orden, nota } = await req.json();
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const item = await prisma.presupuestoTrabajoDia.findUnique({ where: { id } });
  if (!item || item.userId !== session.user.id) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof completado === 'boolean') {
    data.completado = completado;
    data.completadoAt = completado ? new Date() : null;
  }
  if (typeof orden === 'number') data.orden = orden;
  if (typeof nota === 'string') data.nota = nota || null;

  const updated = await prisma.presupuestoTrabajoDia.update({
    where: { id },
    data,
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          nombrePresupuesto: true,
          estado: true,
          cliente: { select: { razonSocial: true } },
          obra: { select: { nombre: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
