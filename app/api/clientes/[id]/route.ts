import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: { presupuestos: { orderBy: { fechaCreacion: 'desc' }, take: 20 } },
  });

  if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: {
        razonSocial: data.razonSocial,
        cuit: data.cuit || null,
        email: data.email || null,
        telefono: data.telefono || null,
        direccion: data.direccion || null,
        ciudad: data.ciudad || null,
        provincia: data.provincia || null,
      },
    });
    return NextResponse.json(cliente);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Soft delete
  await prisma.cliente.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
