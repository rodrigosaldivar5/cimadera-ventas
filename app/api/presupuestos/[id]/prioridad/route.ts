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

  if (prioridad === 'ALTA') {
    try {
      const { enviarNotificacionMasiva } = await import('@/lib/notificaciones');
      const cliente = await prisma.cliente.findUnique({
        where: { id: presupuesto.clienteId },
        select: { razonSocial: true },
      });
      await enviarNotificacionMasiva({
        evento: 'alta_prioridad',
        titulo: `🔴 Prioridad ALTA: #${presupuesto.numero}`,
        mensaje: `"${presupuesto.nombrePresupuesto ?? 'Presupuesto'}" — ${cliente?.razonSocial ?? 'Cliente'} fue marcado como alta prioridad`,
        linkUrl: `/presupuestos/${params.id}`,
        excluirUserId: session.user.id,
      });
      console.log('[NOTIF] alta_prioridad enviado (cambio prioridad)');
    } catch (err) {
      console.error('[NOTIF] Error en alta_prioridad:', err);
    }
  }

  return NextResponse.json(presupuesto);
}
