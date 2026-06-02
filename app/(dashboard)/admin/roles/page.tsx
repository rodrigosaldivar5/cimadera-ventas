export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { RolesContent } from '@/components/admin/roles-content';

export default async function RolesPage() {
  const [roles, divisiones] = await Promise.all([
    prisma.rol.findMany({
      include: { area: { include: { division: true } }, permisos: true, columnas: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.division.findMany({
      include: { areas: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  return <RolesContent roles={roles} divisiones={divisiones} />;
}
