import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFechaKeyArgentina } from '@/lib/mi-trabajo';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const hoy = getFechaKeyArgentina();

  const pendientes = await prisma.presupuestoTrabajoDia.findMany({
    where: {
      userId: session.user.id,
      fechaKey: { lt: hoy },
      completado: false,
    },
    orderBy: [{ fechaKey: 'desc' }, { orden: 'asc' }],
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          nombrePresupuesto: true,
          estado: true,
          cliente: { select: { razonSocial: true } },
          obra: { select: { nombre: true } },
        },
      },
    },
  });

  return NextResponse.json(pendientes);
}
