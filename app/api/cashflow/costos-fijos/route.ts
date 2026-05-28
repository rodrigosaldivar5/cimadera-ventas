import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const costos = await prisma.costoFijo.findMany({
    where: { activo: true },
    orderBy: { categoria: 'asc' },
  });
  const total = costos.reduce((sum, c) => sum + c.monto, 0);

  return NextResponse.json({ costos, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, categoria, moneda, monto, observacion } = await req.json();
  if (!nombre || !categoria || monto === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const costo = await prisma.costoFijo.create({
    data: { nombre, categoria, moneda: moneda ?? 'ARS', monto: Number(monto), observacion: observacion || null },
  });

  return NextResponse.json(costo, { status: 201 });
}
