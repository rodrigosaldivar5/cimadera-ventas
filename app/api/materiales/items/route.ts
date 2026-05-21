import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get('all') === 'true';
  const categoriaId = searchParams.get('categoriaId');

  const where: Record<string, unknown> = { activo: true };
  if (categoriaId) where.categoriaId = categoriaId;

  const items = await prisma.item.findMany({
    where,
    include: { categoria: true },
    orderBy: [{ categoria: { nombre: 'asc' } }, { nombre: 'asc' }],
    ...(all ? {} : { take: 100 }),
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const item = await prisma.item.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoriaId: data.categoriaId,
        costoBase: data.costoBase,
        indiceUtilidad: data.indiceUtilidad ?? 1.3,
        precioVenta: data.precioVenta,
        unidad: data.unidad ?? 'unidad',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error al crear ítem' }, { status: 500 });
  }
}
