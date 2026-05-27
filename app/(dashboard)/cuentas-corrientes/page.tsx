export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CuentasCorrientesContent } from '@/components/cuentas-corrientes/cuentas-corrientes-content';

export default async function CuentasCorrientesPage() {
  await auth();

  const [rawCuentas, clientes] = await Promise.all([
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

  // Serialize Prisma Decimal → number so Next.js can pass them to the Client Component
  const cuentas = rawCuentas.map((c) => ({
    ...c,
    montoOriginal: Number(c.montoOriginal),
    indiceInicio: Number(c.indiceInicio),
    indiceActual: Number(c.indiceActual),
    saldoActualizado: Number(c.saldoActualizado),
    presupuesto: c.presupuesto
      ? { ...c.presupuesto, totalFinal: Number(c.presupuesto.totalFinal) }
      : null,
    movimientos: c.movimientos.map((m) => ({
      ...m,
      monto: Number(m.monto),
      saldoResultante: Number(m.saldoResultante),
      indiceValor: m.indiceValor != null ? Number(m.indiceValor) : null,
    })),
  }));

  return <CuentasCorrientesContent cuentasIniciales={cuentas} clientes={clientes} />;
}
