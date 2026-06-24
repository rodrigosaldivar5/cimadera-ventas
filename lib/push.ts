import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

webpush.setVapidDetails(
  'mailto:coordinacion.general@cimadera.net',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function enviarPush(userId: string, payload: PushPayload): Promise<void> {
  const suscripciones = await prisma.pushSubscription.findMany({ where: { userId } });
  if (suscripciones.length === 0) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    suscripciones.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    })
  );
}
