import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoPresupuesto } from '@prisma/client';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { estado } = await req.json();

  if (!Object.values(EstadoPresupuesto).includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const presupuesto = await prisma.presupuesto.update({
    where: { id: params.id },
    data: {
      estado,
      fechaEnvio: estado === 'ENVIADO' ? new Date() : undefined,
    },
  });

  return NextResponse.json(presupuesto);
}
