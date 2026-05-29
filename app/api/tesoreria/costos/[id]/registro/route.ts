import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get('mes') ?? String(new Date().getMonth() + 1));
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()));

  const { montoEstimado, montoReal, observacion } = await req.json();

  const data: Record<string, unknown> = {};
  if (montoEstimado !== undefined) data.montoEstimado = montoEstimado === null ? null : Number(montoEstimado);
  if (montoReal !== undefined) data.montoReal = montoReal === null ? null : Number(montoReal);
  if (observacion !== undefined) data.observacion = observacion;

  const registro = await prisma.registroCostoFijo.upsert({
    where: { costoFijoId_mes_anio: { costoFijoId: id, mes, anio } },
    create: { costoFijoId: id, mes, anio, ...data },
    update: data,
  });

  return NextResponse.json({
    id: registro.id,
    montoEstimado: registro.montoEstimado ? Number(registro.montoEstimado) : null,
    montoReal: registro.montoReal ? Number(registro.montoReal) : null,
    observacion: registro.observacion,
  });
}
