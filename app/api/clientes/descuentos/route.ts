import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TipoCliente } from '@prisma/client';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const descuentos = await prisma.descuentoTipoCliente.findMany({
    orderBy: { tipoCliente: 'asc' },
  });

  return NextResponse.json({ descuentos });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { tipoCliente, descuento, descripcion } = await req.json();

  if (!Object.values(TipoCliente).includes(tipoCliente)) {
    return NextResponse.json({ error: 'Tipo de cliente inválido' }, { status: 400 });
  }

  const result = await prisma.descuentoTipoCliente.upsert({
    where: { tipoCliente },
    update: { descuento, descripcion: descripcion ?? null },
    create: { tipoCliente, descuento, descripcion: descripcion ?? null },
  });

  return NextResponse.json(result);
}
