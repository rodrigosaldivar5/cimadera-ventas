import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// ── GET /api/external/v1/cashflow/ingresos ────────────────────────────────────
//
// Devuelve ingresos reales (cobros registrados) e ingresos proyectados
// (saldos pendientes de cuentas corrientes activas) separados por moneda.
// Reglas: no sumar ARS + USD; no convertir moneda; ingreso real solo si hay
// cobro registrado en MovimientoCuenta; no inventar fecha de cobro.

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { searchParams } = new URL(request.url);

  const desde        = searchParams.get('desde');
  const hasta        = searchParams.get('hasta');
  const monedaFilter = searchParams.get('moneda');   // 'ARS' | 'USD'
  const estadoFilter = searchParams.get('estado');   // 'COBRADO' | 'PENDIENTE' | 'VENCIDO' | 'PROYECTADO'
  const clienteId    = searchParams.get('clienteId');
  const obraId       = searchParams.get('obraId');

  const ahora = new Date();

  try {
    // ── 1. INGRESOS REALES — MovimientoCuenta tipo ANTICIPO | PAGO_PARCIAL ───
    const movWhere: Record<string, unknown> = {
      tipo: { in: ['ANTICIPO', 'PAGO_PARCIAL'] },
    };

    if (desde || hasta) {
      movWhere.fecha = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      };
    }

    const cuentaFiltro: Record<string, unknown> = {};
    if (monedaFilter) cuentaFiltro.moneda  = monedaFilter;
    if (clienteId)    cuentaFiltro.clienteId = clienteId;
    if (obraId)       cuentaFiltro.obraId    = obraId;
    if (Object.keys(cuentaFiltro).length > 0) movWhere.cuenta = cuentaFiltro;

    const movimientos = await prisma.movimientoCuenta.findMany({
      where: movWhere,
      orderBy: { fecha: 'desc' },
      include: {
        cuenta: {
          select: {
            moneda:    true,
            clienteId: true,
            obraId:    true,
            cliente:   { select: { razonSocial: true } },
            obra:      { select: { nombre: true } },
            presupuesto: {
              select: {
                numero:      true,
                responsable: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });

    // ── 2. INGRESOS PROYECTADOS — CuentaCorriente con saldo activo ────────────
    const ccWhere: Record<string, unknown> = {
      estado:          { not: 'CANCELADO' },
      saldoActualizado: { gt: 0 },
    };
    if (monedaFilter) ccWhere.moneda    = monedaFilter;
    if (clienteId)    ccWhere.clienteId = clienteId;
    if (obraId)       ccWhere.obraId    = obraId;

    const cuentas = await prisma.cuentaCorriente.findMany({
      where: ccWhere,
      select: {
        id:                  true,
        moneda:              true,
        saldoActualizado:    true,
        estado:              true,
        fechaEstimadaCobro:  true,
        proximoCobro:        true,
        clienteId:           true,
        obraId:              true,
        cliente:             { select: { razonSocial: true } },
        obra:                { select: { nombre: true } },
        presupuesto: {
          select: {
            numero:      true,
            responsable: { select: { nombre: true } },
          },
        },
      },
    });

    // ── 3. Construir items ────────────────────────────────────────────────────
    type EstadoItem = 'COBRADO' | 'PENDIENTE' | 'VENCIDO' | 'PROYECTADO';
    type TipoItem   = 'COBRO'   | 'CUENTA_CORRIENTE';

    type Item = {
      id:                  string;
      tipo:                TipoItem;
      estado:              EstadoItem;
      cliente:             string | null;
      clienteId:           string | null;
      obra:                string | null;
      obraId:              string | null;
      responsable:         string | null;
      fecha:               string | null;
      fechaEsperadaCobro:  string | null;
      monto:               number;
      moneda:              string;
      esReal:              boolean;
      esProyectado:        boolean;
      referencia:          string | null;
    };

    const items: Item[] = [];

    // Cobros reales
    for (const mov of movimientos) {
      const c = mov.cuenta;
      const monedaCuenta = c.moneda ?? 'ARS';

      // Monto en la moneda de la cuenta.
      // Cuenta ARS: montoEnARS ?? monto (cubre datos históricos donde monto=pesos)
      // Cuenta USD: equivalenteUSD ?? monto
      const monto = monedaCuenta === 'USD'
        ? Math.abs(Number(mov.equivalenteUSD ?? mov.monto))
        : Math.abs(Number(mov.montoEnARS    ?? mov.monto));

      items.push({
        id:                 mov.id,
        tipo:               'COBRO',
        estado:             'COBRADO',
        cliente:            c.cliente.razonSocial,
        clienteId:          c.clienteId,
        obra:               c.obra?.nombre ?? null,
        obraId:             c.obraId ?? null,
        responsable:        c.presupuesto?.responsable?.nombre ?? null,
        fecha:              mov.fecha.toISOString(),
        fechaEsperadaCobro: null,
        monto,
        moneda:             monedaCuenta,
        esReal:             true,
        esProyectado:       false,
        referencia:         c.presupuesto
          ? `Pres. N°${String(c.presupuesto.numero).padStart(4, '0')}`
          : null,
      });
    }

    // Saldos proyectados
    for (const cc of cuentas) {
      const monedaCuenta = cc.moneda ?? 'ARS';
      // Prioridad: fechaEstimadaCobro > proximoCobro > null ("sin fecha")
      const fechaCobro = cc.fechaEstimadaCobro ?? cc.proximoCobro ?? null;

      let estado: EstadoItem;
      if (fechaCobro && fechaCobro < ahora) {
        estado = 'VENCIDO';
      } else if (fechaCobro) {
        estado = 'PENDIENTE';
      } else {
        estado = 'PROYECTADO'; // sin fecha estimada
      }

      items.push({
        id:                 `cc_${cc.id}`,
        tipo:               'CUENTA_CORRIENTE',
        estado,
        cliente:            cc.cliente.razonSocial,
        clienteId:          cc.clienteId,
        obra:               cc.obra?.nombre ?? null,
        obraId:             cc.obraId ?? null,
        responsable:        cc.presupuesto?.responsable?.nombre ?? null,
        fecha:              fechaCobro?.toISOString() ?? null,
        fechaEsperadaCobro: fechaCobro?.toISOString() ?? null,
        monto:              Math.abs(Number(cc.saldoActualizado)),
        moneda:             monedaCuenta,
        esReal:             false,
        esProyectado:       true,
        referencia:         cc.presupuesto
          ? `Pres. N°${String(cc.presupuesto.numero).padStart(4, '0')}`
          : null,
      });
    }

    // Filtrar por estado si se indicó
    const filtered = estadoFilter
      ? items.filter((i) => i.estado === estadoFilter)
      : items;

    // Ordenar: fecha más reciente primero; sin fecha al final
    filtered.sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha.localeCompare(a.fecha);
    });

    // ── 4. Resumen separado por moneda ─────────────────────────────────────────
    const sumPorMoneda = (arr: Item[]) => ({
      ARS: arr.filter((i) => i.moneda === 'ARS').reduce((s, i) => s + i.monto, 0),
      USD: arr.filter((i) => i.moneda === 'USD').reduce((s, i) => s + i.monto, 0),
    });

    const reales      = filtered.filter((i) => i.esReal);
    const proyectados = filtered.filter((i) => i.esProyectado);
    const vencidos    = filtered.filter((i) => i.estado === 'VENCIDO');

    return jsonWithCors({
      desde: desde ?? null,
      hasta: hasta ?? null,
      resumen: {
        ingresosRealesPorMoneda:      sumPorMoneda(reales),
        ingresosProyectadosPorMoneda: sumPorMoneda(proyectados),
        vencidosPorMoneda:            sumPorMoneda(vencidos),
      },
      items: filtered,
    }, 200, origin);

  } catch (error) {
    console.error('Error en /external/v1/cashflow/ingresos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
