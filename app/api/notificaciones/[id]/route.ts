import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.notificacion.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { leida: true },
  });

  return NextResponse.json({ success: true });
}
