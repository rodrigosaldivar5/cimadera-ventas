import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const categoria = await prisma.categoriaItem.findUnique({
    where: { id: params.id },
    include: { items: { take: 1 } },
  });

  if (!categoria) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  if (categoria.items.length > 0)
    return NextResponse.json({ error: 'La categoría tiene ítems asociados' }, { status: 400 });

  await prisma.categoriaItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre } = await req.json();
  const categoria = await prisma.categoriaItem.update({ where: { id: params.id }, data: { nombre } });
  return NextResponse.json(categoria);
}
