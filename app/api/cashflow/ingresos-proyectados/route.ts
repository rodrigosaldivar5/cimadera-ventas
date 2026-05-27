import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const dias = Number(new URL(req.url).searchParams.get('dias') ?? 90);
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  const cuentas = await prisma.cuentaCorriente.findMany({
    where: {
      estado: 'SALDO_PENDIENTE',
      saldoActualizado: { gt: 0 },
    },
    include: {
      cliente: { select: { id: true, razonSocial: true } },
      obra: { select: { id: true, nombre: true } },
      presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true } },
    },
    orderBy: { proximoCobro: 'asc' },
  });

  return NextResponse.json({ cuentas, dias });
}
