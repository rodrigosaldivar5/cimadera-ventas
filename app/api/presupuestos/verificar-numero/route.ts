import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const numero = Number(new URL(req.url).searchParams.get('numero'));
  const excludeId = new URL(req.url).searchParams.get('excludeId');

  if (!numero || isNaN(numero)) return NextResponse.json({ disponible: false });

  const where: Record<string, unknown> = { numero };
  if (excludeId) where.id = { not: excludeId };

  const existing = await prisma.presupuesto.findFirst({ where });
  return NextResponse.json({ disponible: !existing });
}
