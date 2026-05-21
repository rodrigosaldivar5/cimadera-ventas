import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const item = await prisma.item.findUnique({ where: { id: params.id }, include: { categoria: true } });
  if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const item = await prisma.item.update({
      where: { id: params.id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoriaId: data.categoriaId,
        costoBase: data.costoBase,
        indiceUtilidad: data.indiceUtilidad,
        precioVenta: data.precioVenta,
        unidad: data.unidad,
      },
    });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.item.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
