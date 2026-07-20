import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoCuenta, TipoMovimiento } from '@prisma/client';
import { getMontoFinalPresupuesto } from '@/lib/presupuestos/montos';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('clienteId');
  const estado = searchParams.get('estado') as EstadoCuenta | null;
  const search = searchParams.get('search');

  const where: Record<string, unknown> = {};
  if (clienteId) where.clienteId = clienteId;
  if (estado && Object.values(EstadoCuenta).includes(estado)) where.estado = estado;
  if (search) {
    where.cliente = { razonSocial: { contains: search, mode: 'insensitive' } };
  }

  const cuentas = await prisma.cuentaCorriente.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      cliente: { select: { id: true, razonSocial: true, cuit: true } },
      obra: { select: { id: true, nombre: true } },
      presupuesto: { select: { id: true, numero: true, totalFinal: true } },
      movimientos: {
        orderBy: { fecha: 'desc' },
        take: 1,
      },
    },
  });

  return NextResponse.json({ cuentas });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();

    const {
      clienteId,
      obraId,
      presupuestoId,
      montoOriginal,
      nombreIndice = 'ICC',
      indiceInicio,
      indiceActual,
      fechaInicio,
      observaciones,
      moneda,
      tasaIvaContrato,
      montoContratoNeto,
      montoContratoIva,
    } = data;

    if (!clienteId || !indiceInicio || !indiceActual || !fechaInicio) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    let monto = Number(montoOriginal);

    if (presupuestoId) {
      const presupuesto = await prisma.presupuesto.findUnique({
        where: { id: presupuestoId },
        select: { precioFinal: true, totalFinal: true, totalConIva: true },
      });
      if (presupuesto) {
        monto = getMontoFinalPresupuesto(presupuesto);
      }
    }

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    const idxInicio = Number(indiceInicio);
    const idxActual = Number(indiceActual);
    const saldoActualizado = monto * (idxActual / idxInicio);

    const cuenta = await prisma.cuentaCorriente.create({
      data: {
        clienteId,
        obraId: obraId || null,
        presupuestoId: presupuestoId || null,
        montoOriginal: monto,
        nombreIndice,
        indiceInicio: idxInicio,
        indiceActual: idxActual,
        saldoActualizado,
        estado: EstadoCuenta.SALDO_PENDIENTE,
        fechaInicio: new Date(fechaInicio),
        observaciones: observaciones || null,
        moneda: moneda === 'USD' ? 'USD' : 'ARS',
        tasaIvaContrato: tasaIvaContrato != null ? Number(tasaIvaContrato) : null,
        montoContratoNeto: montoContratoNeto != null ? Number(montoContratoNeto) : null,
        montoContratoIva: montoContratoIva != null ? Number(montoContratoIva) : null,
        movimientos: {
          create: {
            tipo: TipoMovimiento.CARGO_INICIAL,
            descripcion: 'Cargo inicial según presupuesto',
            monto,
            saldoResultante: monto,
            fecha: new Date(fechaInicio),
            indiceValor: idxInicio,
          },
        },
      },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true } },
        obra: { select: { id: true, nombre: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json(cuenta, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear cuenta corriente' }, { status: 500 });
  }
}
