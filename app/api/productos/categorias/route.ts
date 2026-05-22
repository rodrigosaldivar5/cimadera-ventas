import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const categorias = await prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } });
  return NextResponse.json({ categorias });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre } = await req.json();
  const categoria = await prisma.categoriaProducto.create({ data: { nombre } });
  return NextResponse.json(categoria, { status: 201 });
}
