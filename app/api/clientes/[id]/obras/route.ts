import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const obras = await prisma.obra.findMany({
    where: { clienteId: params.id, activo: true },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { presupuestos: true } } },
  });

  return NextResponse.json({ obras });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, direccion, descripcion, codigoObra } = await req.json();
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const obra = await prisma.obra.create({
    data: {
      nombre: nombre.trim(),
      codigoObra: codigoObra?.trim() || null,
      direccion: direccion || null,
      descripcion: descripcion || null,
      clienteId: params.id,
    },
  });

  return NextResponse.json(obra, { status: 201 });
}
