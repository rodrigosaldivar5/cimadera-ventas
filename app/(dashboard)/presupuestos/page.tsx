export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { PresupuestosTable } from '@/components/presupuestos/presupuestos-table';

export default async function PresupuestosPage() {
  const [usuarios, criticos, session] = await Promise.all([
    prisma.user.findMany({ where: { aprobado: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.presupuesto.findMany({
      where: { prioridad: 'ALTA', estado: { in: ['EN_PROCESO', 'PARA_ENVIAR'] } },
      orderBy: { fechaCreacion: 'asc' },
      include: { cliente: true, responsable: true },
      take: 10,
    }),
    auth(),
  ]);

  return (
    <PresupuestosTable
      usuarios={usuarios}
      criticos={criticos}
      userEmail={session?.user?.email ?? ''}
    />
  );
}
