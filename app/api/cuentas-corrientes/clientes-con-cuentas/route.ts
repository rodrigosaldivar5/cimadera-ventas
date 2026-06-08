import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const clientes = await prisma.cliente.findMany({
    where: { cuentasCorrientes: { some: {} } },
    select: {
      id: true,
      razonSocial: true,
      _count: { select: { cuentasCorrientes: true } },
    },
    orderBy: { razonSocial: 'asc' },
  });

  return NextResponse.json(clientes);
}
