import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; criterioId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const data = await req.json();
  const criterio = await prisma.criterioCliente.update({
    where: { id: params.criterioId, clienteId: params.id },
    data,
  });
  return NextResponse.json(criterio);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; criterioId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.criterioCliente.delete({ where: { id: params.criterioId, clienteId: params.id } });
  return NextResponse.json({ ok: true });
}
