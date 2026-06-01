import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prioridad } from '@prisma/client';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { prioridad } = await req.json();
  if (!Object.values(Prioridad).includes(prioridad)) {
    return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 });
  }

  const prev = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    select: { prioridad: true },
  });

  const presupuesto = await prisma.presupuesto.update({
    where: { id: params.id },
    data: { prioridad },
  });

  registrarAuditoria({
    presupuestoId: params.id,
    usuarioId: session.user.id,
    accion: 'MODIFICACION',
    camposModificados: { prioridad: { antes: prev?.prioridad, despues: prioridad } },
  });

  return NextResponse.json(presupuesto);
}
