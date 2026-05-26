import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 });

  const blob = await put(`presupuestos/${params.id}/${file.name}`, file, { access: 'public' });
  await prisma.presupuesto.update({
    where: { id: params.id },
    data: { archivoAdjunto: blob.url, archivoNombre: file.name },
  });

  return NextResponse.json({ url: blob.url, nombre: file.name });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  await prisma.presupuesto.update({
    where: { id: params.id },
    data: { archivoAdjunto: null, archivoNombre: null },
  });
  return NextResponse.json({ ok: true });
}
