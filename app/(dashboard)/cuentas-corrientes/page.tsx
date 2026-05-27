export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CuentasCorrientesContent } from '@/components/cuentas-corrientes/cuentas-corrientes-content';

export default async function CuentasCorrientesPage() {
  await auth();

  const [rawCuentas, clientes, rawSinCuenta] = await Promise.all([
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
    prisma.presupuesto.findMany({
      where: { estado: 'APROBADO', cuentaCorriente: null },
      select: {
        id: true,
        numero: true,
        nombrePresupuesto: true,
        precioFinal: true,
        totalFinal: true,
        fechaCreacion: true,
        clienteId: true,
        cliente: { select: { razonSocial: true } },
        obraId: true,
        obra: { select: { nombre: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
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

  const presupuestosSinCuenta = rawSinCuenta.map((p) => ({
    ...p,
    precioFinal: p.precioFinal != null ? Number(p.precioFinal) : null,
    totalFinal: Number(p.totalFinal),
  }));

  return (
    <CuentasCorrientesContent
      cuentasIniciales={cuentas}
      clientes={clientes}
      presupuestosSinCuenta={presupuestosSinCuenta}
    />
  );
}
