import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get('mes'));
  const anio = Number(searchParams.get('anio'));

  if (!mes || !anio) return NextResponse.json(null);

  const snapshot = await prisma.snapshotCostosFijos.findUnique({
    where: { mes_anio: { mes, anio } },
  });
  return NextResponse.json(snapshot ?? null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { mes, anio, datos } = await req.json();
    const snapshot = await prisma.snapshotCostosFijos.upsert({
      where: { mes_anio: { mes, anio } },
      update: { datos },
      create: { mes, anio, datos },
    });
    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al guardar snapshot' }, { status: 500 });
  }
}
