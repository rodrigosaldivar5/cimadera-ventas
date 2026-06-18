import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { userId, nuevaPassword } = await req.json();
  if (!userId || !nuevaPassword) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const hashed = await hash(nuevaPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  await prisma.solicitudRestablecimiento.updateMany({
    where: { userId, estado: 'PENDIENTE' },
    data: {
      estado: 'APROBADO',
      aprobadoPorId: session.user.id,
      nuevaPassword: hashed,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
