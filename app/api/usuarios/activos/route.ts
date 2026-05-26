import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const usuarios = await prisma.user.findMany({
    where: { aprobado: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  return NextResponse.json({ usuarios, currentUserId: session.user.id });
}
