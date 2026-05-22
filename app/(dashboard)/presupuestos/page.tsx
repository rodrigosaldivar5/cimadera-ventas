export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { PresupuestosTable } from '@/components/presupuestos/presupuestos-table';
import { EstadoPresupuesto } from '@prisma/client';

interface SearchParams {
  estado?: string;
  clienteId?: string;
  obraId?: string;
  desde?: string;
  hasta?: string;
  page?: string;
}

export default async function PresupuestosPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const perPage = 10;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};
  if (searchParams.estado && Object.values(EstadoPresupuesto).includes(searchParams.estado as EstadoPresupuesto)) {
    where.estado = searchParams.estado as EstadoPresupuesto;
  }
  if (searchParams.clienteId) where.clienteId = searchParams.clienteId;
  if (searchParams.obraId) where.obraId = searchParams.obraId;
  if (searchParams.desde || searchParams.hasta) {
    where.fechaCreacion = {};
    if (searchParams.desde) (where.fechaCreacion as Record<string, unknown>).gte = new Date(searchParams.desde);
    if (searchParams.hasta) (where.fechaCreacion as Record<string, unknown>).lte = new Date(searchParams.hasta);
  }

  const [presupuestos, total, clientes, usuarios, criticos] = await Promise.all([
    prisma.presupuesto.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { fechaCreacion: 'desc' },
      include: { cliente: true, creadoPor: true, responsable: true, obra: true },
    }),
    prisma.presupuesto.count({ where }),
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { razonSocial: 'asc' }, select: { id: true, razonSocial: true } }),
    prisma.user.findMany({ where: { aprobado: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.presupuesto.findMany({
      where: { prioridad: 'ALTA', estado: { in: ['EN_PROCESO', 'PARA_ENVIAR'] } },
      orderBy: { fechaCreacion: 'asc' },
      include: { cliente: true, responsable: true },
      take: 10,
    }),
  ]);

  return (
    <PresupuestosTable
      presupuestos={presupuestos}
      total={total}
      page={page}
      perPage={perPage}
      clientes={clientes}
      usuarios={usuarios}
      criticos={criticos}
      filters={{ estado: searchParams.estado, clienteId: searchParams.clienteId, obraId: searchParams.obraId, desde: searchParams.desde, hasta: searchParams.hasta }}
    />
  );
}
