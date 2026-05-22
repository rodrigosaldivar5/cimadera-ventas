import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const criterios = await prisma.criterioCliente.findMany({
    where: { clienteId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ criterios });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { titulo, descripcion } = await req.json();
  const criterio = await prisma.criterioCliente.create({
    data: { clienteId: params.id, titulo, descripcion: descripcion || null },
  });
  return NextResponse.json(criterio, { status: 201 });
}
