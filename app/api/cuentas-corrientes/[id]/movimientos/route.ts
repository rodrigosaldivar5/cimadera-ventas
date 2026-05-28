import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TipoMovimiento, EstadoCuenta } from '@prisma/client';

type RouteContext = { params: { id: string } };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const { tipo, descripcion, monto, numeroFactura, fecha, indiceValor, caja, tipoCambio, montoEnARS } = data;

    if (!tipo || !descripcion || monto === undefined || !fecha) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: { movimientos: true },
    });
    if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });

    const montoNum = Number(monto);
    // Para cuenta corriente siempre operamos en ARS
    const montoParaRestar = montoEnARS != null ? Number(montoEnARS) : montoNum;

    let saldoResultante: number;
    const updateCuenta: Record<string, unknown> = {};

    if (tipo === TipoMovimiento.ANTICIPO || tipo === TipoMovimiento.PAGO_PARCIAL) {
      const idxInicio   = parseFloat(cuenta.indiceInicio.toString());
      const idxActual   = parseFloat(cuenta.indiceActual.toString());
      const montoOriginal = parseFloat(cuenta.montoOriginal.toString());
      const totalPagadoAnterior = cuenta.movimientos
        .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
        .reduce((sum, m) => sum + parseFloat((m.montoEnARS ?? m.monto).toString()), 0);
      const totalPagadoNuevo = totalPagadoAnterior + montoParaRestar;
      // fórmula: (montoOriginal - totalPagado) × (idxActual / idxInicio)
      const saldoBase  = montoOriginal - totalPagadoNuevo;
      const nuevoSaldo = saldoBase * (idxActual / idxInicio);
      saldoResultante = nuevoSaldo;
      updateCuenta.saldoActualizado = nuevoSaldo;
      updateCuenta.estado = nuevoSaldo <= 0 ? EstadoCuenta.CANCELADO : EstadoCuenta.SALDO_PENDIENTE;
    } else if (tipo === TipoMovimiento.ACTUALIZACION) {
      const lastMovimiento = [...cuenta.movimientos].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      )[0];
      saldoResultante = lastMovimiento ? Number(lastMovimiento.saldoResultante) + montoNum : Number(cuenta.montoOriginal) + montoNum;
      if (indiceValor) {
        updateCuenta.indiceActual = Number(indiceValor);
        updateCuenta.saldoActualizado =
          Number(cuenta.montoOriginal) * (Number(indiceValor) / Number(cuenta.indiceInicio));
      }
      if (saldoResultante <= 0) updateCuenta.estado = EstadoCuenta.CANCELADO;
    } else {
      return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
    }

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoCuenta.create({
        data: {
          cuentaId: params.id,
          tipo,
          descripcion,
          monto: montoNum,
          saldoResultante,
          numeroFactura: numeroFactura || null,
          fecha: new Date(fecha),
          indiceValor: indiceValor ? Number(indiceValor) : null,
          caja: caja ?? null,
          tipoCambio: tipoCambio ? Number(tipoCambio) : null,
          montoEnARS: montoEnARS ? Number(montoEnARS) : null,
        },
      }),
      prisma.cuentaCorriente.update({
        where: { id: params.id },
        data: updateCuenta,
      }),
    ]);

    // Impactar en Tesorería solo para pagos (ANTICIPO / PAGO_PARCIAL) con caja definida
    if ((tipo === TipoMovimiento.ANTICIPO || tipo === TipoMovimiento.PAGO_PARCIAL) && caja) {
      const cajaKey = caja as 'ARS' | 'USD';
      const movsTesoreraHistoricos = await prisma.movimientoTesoreria.findMany({
        where: { caja: cajaKey },
        orderBy: { fecha: 'asc' },
      });
      const saldoCajaActual = movsTesoreraHistoricos.reduce((sum, m) => {
        if (['INGRESO', 'TRASPASO_ENTRADA', 'CANJE_REALIZADO'].includes(m.tipo)) {
          return sum + parseFloat(m.monto.toString());
        }
        return sum - parseFloat(m.monto.toString());
      }, 0);
      // Para tesorería se usa el monto en la moneda original de la caja
      const nuevoSaldoCaja = saldoCajaActual + montoNum;
      const cuentaInfo = await prisma.cuentaCorriente.findUnique({
        where: { id: params.id },
        include: { cliente: { select: { razonSocial: true } } },
      });
      await prisma.movimientoTesoreria.create({
        data: {
          caja: cajaKey,
          tipo: 'INGRESO',
          descripcion: `${tipo === 'ANTICIPO' ? 'Anticipo' : 'Pago parcial'} — ${cuentaInfo?.cliente?.razonSocial ?? 'Cliente'} (CC)`,
          monto: montoNum,
          saldoResultante: nuevoSaldoCaja,
          fecha: new Date(fecha),
        },
      });
    }

    const cuentaActualizada = await prisma.cuentaCorriente.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, cuit: true, email: true, telefono: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        presupuesto: { select: { id: true, numero: true, totalFinal: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    return NextResponse.json({ movimiento, cuenta: cuentaActualizada }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}
