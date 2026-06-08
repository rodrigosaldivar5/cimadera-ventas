import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { mensaje } = await request.json();

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      responsable: { select: { id: true, nombre: true } },
      cliente: { select: { razonSocial: true } },
    },
  });

  if (!presupuesto) {
    return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
  }
  if (!presupuesto.responsableId) {
    return NextResponse.json({ error: 'El presupuesto no tiene responsable asignado' }, { status: 400 });
  }

  await prisma.notificacion.create({
    data: {
      userId: presupuesto.responsableId,
      titulo: `Avance requerido: Presupuesto #${presupuesto.numero}`,
      mensaje: mensaje
        ? `${session.user.nombre} pide avance: "${mensaje}"`
        : `${session.user.nombre} solicita avance del presupuesto #${presupuesto.numero} — ${presupuesto.cliente?.razonSocial ?? 'Sin cliente'}`,
      tipo: 'avance_requerido',
      linkUrl: `/presupuestos/${presupuesto.id}`,
    },
  });

  try {
    await prisma.auditoriaPresupuesto.create({
      data: {
        presupuestoId: presupuesto.id,
        usuarioId: session.user.id,
        accion: 'PEDIDO_AVANCE',
        camposModificados: {
          descripcion: mensaje
            ? `Avance solicitado a ${presupuesto.responsable?.nombre}: "${mensaje}"`
            : `Avance solicitado a ${presupuesto.responsable?.nombre}`,
        },
      },
    });
  } catch {}

  try {
    const suscripciones = await prisma.pushSubscription.findMany({
      where: { userId: presupuesto.responsableId },
    });
    if (suscripciones.length > 0) {
      const webpush = await import('web-push');
      webpush.setVapidDetails(
        'mailto:coordinacion.general@cimadera.net',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
        process.env.VAPID_PRIVATE_KEY ?? ''
      );
      const pushPayload = JSON.stringify({
        title: `Avance requerido`,
        body: `Presupuesto #${presupuesto.numero} — ${presupuesto.cliente?.razonSocial ?? ''}`,
        url: `/presupuestos/${presupuesto.id}`,
      });
      for (const sub of suscripciones) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        } catch (err) {
          console.error('Push failed:', err);
          if ((err as { statusCode?: number }).statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }
    }
  } catch {}

  return NextResponse.json({ success: true });
}
