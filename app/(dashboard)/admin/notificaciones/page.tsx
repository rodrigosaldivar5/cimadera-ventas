export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { NotificacionesContent } from '@/components/admin/notificaciones-content';

export default async function NotificacionesAdminPage() {
  const [usuarios, preferencias] = await Promise.all([
    prisma.user.findMany({
      where: { aprobado: true },
      select: {
        id: true,
        nombre: true,
        email: true,
        pushSubscriptions: { select: { id: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.notificacionPreferencia.findMany(),
  ]);

  return <NotificacionesContent usuarios={usuarios} preferencias={preferencias} />;
}
