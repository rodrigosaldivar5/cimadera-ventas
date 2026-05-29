import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { mesOrigen, anioOrigen, mesDestino, anioDestino, porcentajeAumento } = await req.json();
  const factor = 1 + (Number(porcentajeAumento ?? 0) / 100);

  const registrosOrigen = await prisma.registroCostoFijo.findMany({
    where: { mes: mesOrigen, anio: anioOrigen },
  });

  let creados = 0;
  for (const r of registrosOrigen) {
    const base = r.montoReal ?? r.montoEstimado;
    if (!base) continue;
    const montoEstimado = Number(base) * factor;

    await prisma.registroCostoFijo.upsert({
      where: { costoFijoId_mes_anio: { costoFijoId: r.costoFijoId, mes: mesDestino, anio: anioDestino } },
      create: { costoFijoId: r.costoFijoId, mes: mesDestino, anio: anioDestino, montoEstimado },
      update: { montoEstimado },
    });
    creados++;
  }

  return NextResponse.json({ replicados: creados });
}
