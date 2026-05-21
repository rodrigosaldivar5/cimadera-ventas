export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ClientesTable } from '@/components/clientes/clientes-table';

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await auth();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const q = searchParams.q ?? '';
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where = q
    ? {
        activo: true,
        OR: [
          { razonSocial: { contains: q, mode: 'insensitive' as const } },
          { cuit: { contains: q, mode: 'insensitive' as const } },
          { ciudad: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : { activo: true };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({ where, skip, take: perPage, orderBy: { razonSocial: 'asc' } }),
    prisma.cliente.count({ where }),
  ]);

  return (
    <ClientesTable
      clientes={clientes}
      total={total}
      page={page}
      perPage={perPage}
      q={q}
    />
  );
}
