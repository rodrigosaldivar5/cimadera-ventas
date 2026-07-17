import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFechaKeyArgentina, canManageTeamWork } from '@/lib/mi-trabajo';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('targetUserId');

  let effectiveUserId: string | undefined = session.user.id;
  if (targetUserId && canManageTeamWork(session.user)) {
    effectiveUserId = targetUserId === '__all__' ? undefined : targetUserId;
  }

  const hoy = getFechaKeyArgentina();

  const pendientes = await prisma.presupuestoTrabajoDia.findMany({
    where: {
      ...(effectiveUserId ? { userId: effectiveUserId } : {}),
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
      user: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(pendientes);
}
