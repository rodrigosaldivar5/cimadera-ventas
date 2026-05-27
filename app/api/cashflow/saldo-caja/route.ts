import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 12);
  const registros = await prisma.saldoCaja.findMany({
    orderBy: { fecha: 'desc' },
    take: limit,
  });

  return NextResponse.json({ registros, actual: registros[0] ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { fecha, saldo, nota } = await req.json();
  if (!fecha || saldo === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const registro = await prisma.saldoCaja.create({
    data: {
      fecha: new Date(fecha),
      saldo: Number(saldo),
      nota: nota || null,
      creadoPor: session.user.id,
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
