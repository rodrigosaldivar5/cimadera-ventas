import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const categorias = await prisma.categoriaCostoFijo.findMany({
    orderBy: { nombre: 'asc' },
  });
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { nombre } = await req.json();
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const cat = await prisma.categoriaCostoFijo.create({
      data: { nombre: nombre.trim() },
    });
    return NextResponse.json(cat, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unique')) return NextResponse.json({ error: 'La categoría ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}
