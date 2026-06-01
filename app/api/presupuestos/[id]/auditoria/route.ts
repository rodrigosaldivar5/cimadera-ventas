import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const auditoria = await prisma.auditoriaPresupuesto.findMany({
    where: { presupuestoId: params.id },
    orderBy: { createdAt: 'desc' },
    include: { usuario: { select: { nombre: true } } },
  });

  return NextResponse.json(auditoria);
}
