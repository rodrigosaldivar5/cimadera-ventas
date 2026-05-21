import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const usuarios = await prisma.user.findMany({
    include: { rol: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ usuarios });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id, aprobado, rolId } = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof aprobado === 'boolean') data.aprobado = aprobado;
  if (rolId !== undefined) data.rolId = rolId || null;

  const usuario = await prisma.user.update({ where: { id }, data });
  return NextResponse.json(usuario);
}
