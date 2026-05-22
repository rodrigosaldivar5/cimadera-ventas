import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    select: { tipoCliente: true },
  });
  if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const descuento = await prisma.descuentoTipoCliente.findUnique({
    where: { tipoCliente: cliente.tipoCliente },
  });

  return NextResponse.json({ tipoCliente: cliente.tipoCliente, descuento: Number(descuento?.descuento ?? 0) });
}
