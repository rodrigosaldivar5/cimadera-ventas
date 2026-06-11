import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const preferencias = await prisma.notificacionPreferencia.findMany();
  return NextResponse.json({ preferencias });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { userId, tipo, activo } = await request.json();
  if (!userId || !tipo || typeof activo !== 'boolean') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  await prisma.notificacionPreferencia.upsert({
    where: { userId_tipo: { userId, tipo } },
    create: { userId, tipo, activo },
    update: { activo },
  });

  return NextResponse.json({ success: true });
}
