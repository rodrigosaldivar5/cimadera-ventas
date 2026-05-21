import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const roles = await prisma.rol.findMany({
    include: { area: { include: { division: true } }, permisos: true },
    orderBy: { nombre: 'asc' },
  });
  return NextResponse.json({ roles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, areaId } = await req.json();
  const rol = await prisma.rol.create({ data: { nombre, areaId } });
  return NextResponse.json(rol, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, nombre } = await req.json();
  const rol = await prisma.rol.update({ where: { id }, data: { nombre } });
  return NextResponse.json(rol);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await req.json();
  await prisma.rol.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
