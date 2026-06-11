export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { PushAdmin } from '@/components/admin/push-admin';

export default async function PushAdminPage() {
  const [usuarios, recentNotifs] = await Promise.all([
    prisma.user.findMany({
      where: { aprobado: true },
      select: {
        id: true,
        nombre: true,
        email: true,
        pushSubscriptions: { select: { id: true, createdAt: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.notificacion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { nombre: true } } },
    }),
  ]);

  return <PushAdmin usuarios={usuarios} recentNotifs={recentNotifs} />;
}
