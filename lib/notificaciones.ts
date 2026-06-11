import { prisma } from '@/lib/prisma';
import { enviarPush } from '@/lib/push';

export interface NotificacionData {
  titulo: string;
  mensaje: string;
  tipo?: string;
  linkUrl?: string;
}

export async function crearNotificacion(userId: string, data: NotificacionData): Promise<void> {
  await prisma.notificacion.create({
    data: {
      userId,
      titulo: data.titulo,
      mensaje: data.mensaje,
      tipo: data.tipo ?? 'general',
      linkUrl: data.linkUrl ?? null,
    },
  });
}

export async function crearYEnviarNotificacion(
  userId: string,
  data: NotificacionData
): Promise<void> {
  await crearNotificacion(userId, data);
  await enviarPush(userId, {
    title: data.titulo,
    body: data.mensaje,
    url: data.linkUrl,
  }).catch(() => {});
}
