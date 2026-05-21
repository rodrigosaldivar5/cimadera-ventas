export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { UsuariosContent } from '@/components/admin/usuarios-content';

export default async function UsuariosPage() {
  const [usuarios, roles] = await Promise.all([
    prisma.user.findMany({
      include: { rol: { include: { area: { include: { division: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.rol.findMany({
      include: { area: { include: { division: true } } },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  return <UsuariosContent usuarios={usuarios} roles={roles} />;
}
