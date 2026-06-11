import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { crearYEnviarNotificacion } from '@/lib/notificaciones';

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

  const titulo = `Avance requerido: Presupuesto #${presupuesto.numero}`;
  const mensajeNotif = mensaje
    ? `${session.user.nombre} pide avance: "${mensaje}"`
    : `${session.user.nombre} solicita avance del presupuesto #${presupuesto.numero} — ${presupuesto.cliente?.razonSocial ?? 'Sin cliente'}`;

  await crearYEnviarNotificacion(presupuesto.responsableId, {
    titulo,
    mensaje: mensajeNotif,
    tipo: 'avance_requerido',
    linkUrl: `/presupuestos/${presupuesto.id}`,
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

  return NextResponse.json({ success: true });
}
