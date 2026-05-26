export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CuentasCorrientesContent } from '@/components/cuentas-corrientes/cuentas-corrientes-content';

export default async function CuentasCorrientesPage() {
  await auth();

  const [cuentas, clientes] = await Promise.all([
    prisma.cuentaCorriente.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    }),
    prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { razonSocial: 'asc' },
      select: { id: true, razonSocial: true },
    }),
  ]);

  return <CuentasCorrientesContent cuentasIniciales={cuentas} clientes={clientes} />;
}
