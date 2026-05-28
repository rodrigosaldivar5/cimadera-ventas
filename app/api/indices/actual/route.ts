import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const indice = await prisma.indiceGlobal.findFirst({ orderBy: { fecha: 'desc' } });
  return NextResponse.json(indice);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, valor } = await req.json();
  if (!valor) return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });

  const indice = await prisma.indiceGlobal.create({
    data: {
      nombre: nombre ?? 'CAC MO',
      valor: Number(valor),
      creadoPor: session.user.email ?? undefined,
    },
  });
  return NextResponse.json(indice, { status: 201 });
}
