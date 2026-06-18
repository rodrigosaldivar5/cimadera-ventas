import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const solicitudes = await prisma.solicitudRestablecimiento.findMany({
    where: { estado: 'PENDIENTE' },
    include: { user: { select: { id: true, nombre: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(solicitudes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  await prisma.solicitudRestablecimiento.update({
    where: { id },
    data: { estado: 'RECHAZADO', resolvedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
