export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { NotificacionesAdmin } from '@/components/admin/notificaciones-admin';

export default async function NotificacionesAdminPage() {
  const usuarios = await prisma.user.findMany({
    where: { aprobado: true },
    select: {
      id: true,
      nombre: true,
      email: true,
      pushSubscriptions: { select: { id: true, createdAt: true } },
    },
    orderBy: { nombre: 'asc' },
  });

  const recentNotifs = await prisma.notificacion.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { nombre: true } } },
  });

  return <NotificacionesAdmin usuarios={usuarios} recentNotifs={recentNotifs} />;
}
