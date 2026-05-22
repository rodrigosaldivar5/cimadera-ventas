import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const puertas = await prisma.catalogoPuerta.findMany({
    where: { activo: true },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json({ puertas });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (session.user.rolNombre !== 'Administrador') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { nombre, imageUrl, categoria, descripcion } = await req.json();
  if (!nombre?.trim() || !imageUrl?.trim()) {
    return NextResponse.json({ error: 'Nombre e imagen son requeridos' }, { status: 400 });
  }

  const puerta = await prisma.catalogoPuerta.create({
    data: {
      nombre: nombre.trim(),
      imageUrl: imageUrl.trim(),
      categoria: categoria || 'Interior',
      descripcion: descripcion?.trim() || null,
    },
  });

  return NextResponse.json(puerta, { status: 201 });
}
