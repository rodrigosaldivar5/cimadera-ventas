import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ObrasContent } from '@/components/obras/obras-content';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  clienteId?: string;
  inactivas?: string;
  page?: string;
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await auth();

  const q              = searchParams.q ?? '';
  const clienteId      = searchParams.clienteId ?? '';
  const mostrarInactivas = searchParams.inactivas === 'true';
  const page           = Math.max(1, Number(searchParams.page ?? 1));
  const perPage        = 20;

  const where: Record<string, unknown> = {
    activo: mostrarInactivas ? false : true,
  };
  if (clienteId) where.clienteId = clienteId;
  if (q) {
    where.OR = [
      { nombre:    { contains: q, mode: 'insensitive' as const } },
      { direccion: { contains: q, mode: 'insensitive' as const } },
      { cliente:   { razonSocial: { contains: q, mode: 'insensitive' as const } } },
    ];
  }

  const [obras, total, clientes] = await Promise.all([
    prisma.obra.findMany({
      where,
      include: {
        cliente: { select: { id: true, razonSocial: true } },
        _count:  { select: { presupuestos: true, cuentasCorrientes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.obra.count({ where }),
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { razonSocial: 'asc' },
      select: { id: true, razonSocial: true },
    }),
  ]);

  const obrasSerializadas = obras.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <ObrasContent
      obras={obrasSerializadas}
      clientes={clientes}
      total={total}
      page={page}
      perPage={perPage}
      q={q}
      clienteId={clienteId}
      mostrarInactivas={mostrarInactivas}
    />
  );
}
