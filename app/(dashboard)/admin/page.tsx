export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { AdminContent } from '@/components/admin/admin-content';

export default async function AdminPage() {
  const [usuarios, roles, divisiones] = await Promise.all([
    prisma.user.findMany({ include: { rol: true }, orderBy: { createdAt: 'desc' } }),
    prisma.rol.findMany({ include: { area: { include: { division: true } }, permisos: true }, orderBy: { nombre: 'asc' } }),
    prisma.division.findMany({ include: { areas: { include: { roles: true } } }, orderBy: { nombre: 'asc' } }),
  ]);

  return <AdminContent usuarios={usuarios} roles={roles} divisiones={divisiones} />;
}
