import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const presupuestos = await prisma.presupuesto.findMany({
    where: {
      estado: 'APROBADO',
      cuentaCorriente: null,
    },
    select: {
      id: true,
      numero: true,
      nombrePresupuesto: true,
      precioFinal: true,
      totalFinal: true,
      fechaCreacion: true,
      clienteId: true,
      cliente: { select: { razonSocial: true } },
      obraId: true,
      obra: { select: { nombre: true } },
    },
    orderBy: { fechaCreacion: 'desc' },
  });

  const result = presupuestos.map((p) => ({
    ...p,
    precioFinal: p.precioFinal != null ? Number(p.precioFinal) : null,
    totalFinal: Number(p.totalFinal),
  }));

  return NextResponse.json({ presupuestos: result });
}
