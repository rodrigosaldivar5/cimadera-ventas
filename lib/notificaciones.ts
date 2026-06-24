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

export async function enviarNotificacion({
  evento,
  userId,
  titulo,
  mensaje,
  linkUrl,
}: {
  evento: string;
  userId: string;
  titulo: string;
  mensaje: string;
  linkUrl?: string;
}): Promise<void> {
  const pref = await prisma.notificacionPreferencia.findUnique({
    where: { userId_tipo: { userId, tipo: evento } },
  });
  if (pref && !pref.activo) return;

  await prisma.notificacion.create({
    data: { userId, titulo, mensaje, tipo: evento, linkUrl: linkUrl ?? null },
  });
  await enviarPush(userId, { title: titulo, body: mensaje, url: linkUrl }).catch(() => {});
}

export async function enviarNotificacionMasiva({
  evento,
  titulo,
  mensaje,
  linkUrl,
  excluirUserId,
}: {
  evento: string;
  titulo: string;
  mensaje: string;
  linkUrl?: string;
  excluirUserId?: string;
}): Promise<void> {
  const usuarios = await prisma.user.findMany({
    select: { id: true },
    where: excluirUserId ? { id: { not: excluirUserId } } : undefined,
  });

  await Promise.all(
    usuarios.map((u) =>
      enviarNotificacion({ evento, userId: u.id, titulo, mensaje, linkUrl }).catch(() => {})
    )
  );
}
