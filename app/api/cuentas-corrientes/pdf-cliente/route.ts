import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('clienteId');
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { razonSocial: true, tipoCliente: true, cuit: true, email: true, telefono: true },
  });
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  const rawCuentas = await prisma.cuentaCorriente.findMany({
    where: { clienteId },
    orderBy: { fechaInicio: 'desc' },
    include: {
      obra: { select: { nombre: true, codigoObra: true } },
      presupuesto: { select: { numero: true } },
      movimientos: { orderBy: { fecha: 'asc' } },
    },
  });

  const cuentas = rawCuentas.map((c) => ({
    id: c.id,
    moneda: c.moneda ?? 'ARS',
    montoOriginal: Number(c.montoOriginal),
    indiceInicio: Number(c.indiceInicio),
    indiceActual: Number(c.indiceActual),
    nombreIndice: c.nombreIndice,
    saldoActualizado: Number(c.saldoActualizado),
    estado: c.estado,
    fechaInicio: c.fechaInicio.toISOString(),
    obra: c.obra ?? null,
    presupuesto: c.presupuesto ?? null,
    movimientos: c.movimientos.map((m) => ({
      fecha: m.fecha.toISOString(),
      tipo: m.tipo,
      descripcion: m.descripcion,
      monto: Number(m.monto),
      montoEnARS: m.montoEnARS != null ? Number(m.montoEnARS) : null,
      equivalenteUSD: m.equivalenteUSD != null ? Number(m.equivalenteUSD) : null,
      saldoResultante: Number(m.saldoResultante),
      numeroFactura: m.numeroFactura ?? null,
      tipoCambio: m.tipoCambio != null ? Number(m.tipoCambio) : null,
      caja: m.caja ?? null,
    })),
  }));

  return NextResponse.json({ cliente, cuentas });
}
