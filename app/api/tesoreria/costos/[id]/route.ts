import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { nombre, categoria, moneda, observacion } = await req.json();

  let categoriaId: string | undefined;
  if (categoria) {
    let cat = await prisma.categoriaCostoFijo.findFirst({
      where: { nombre: { equals: categoria, mode: 'insensitive' } },
    });
    if (!cat) cat = await prisma.categoriaCostoFijo.create({ data: { nombre: categoria } });
    categoriaId = cat.id;
  }

  const costo = await prisma.costoFijo.update({
    where: { id },
    data: {
      ...(nombre !== undefined && { nombre }),
      ...(categoria !== undefined && { categoria, categoriaId }),
      ...(moneda !== undefined && { moneda }),
      ...(observacion !== undefined && { observacion }),
    },
  });
  return NextResponse.json(costo);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  await prisma.costoFijo.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
