import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: { id: string } };

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const data = await req.json();
  const updateData: Record<string, unknown> = {};
  if (data.nombre !== undefined) updateData.nombre = data.nombre;
  if (data.categoria !== undefined) updateData.categoria = data.categoria;
  if (data.moneda !== undefined) updateData.moneda = data.moneda;
  if (data.monto !== undefined) updateData.monto = Number(data.monto);
  if (data.observacion !== undefined) updateData.observacion = data.observacion;

  const costo = await prisma.costoFijo.update({ where: { id: params.id }, data: updateData });
  return NextResponse.json(costo);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.costoFijo.update({ where: { id: params.id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
