import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  try {
    const cuentas = await prisma.cuentaCorriente.findMany({
      orderBy: { fechaInicio: 'desc' },
      include: {
        cliente: { select: { id: true, razonSocial: true, tipoCliente: true } },
        obra: { select: { id: true, nombre: true } },
        presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true } },
        movimientos: { orderBy: { fecha: 'desc' }, take: 1 },
      },
    });

    return jsonWithCors(cuentas.map((c) => {
      const totalCobrado = c.movimientos.length > 0 ? 0 : 0; // calculated below
      const cobros = c.movimientos.filter((m) =>
        ['ANTICIPO', 'PAGO_PARCIAL'].includes(m.tipo)
      ).reduce((s, m) => s + Number(m.monto), 0);

      return {
        id: c.id,
        cliente: c.cliente,
        obra: c.obra,
        presupuesto: c.presupuesto,
        montoOriginal: Number(c.montoOriginal),
        indiceInicio: Number(c.indiceInicio),
        indiceActual: Number(c.indiceActual),
        nombreIndice: c.nombreIndice,
        saldoActualizado: Number(c.saldoActualizado),
        estado: c.estado,
        fechaInicio: c.fechaInicio,
        observaciones: c.observaciones,
        proximoCobro: c.proximoCobro,
        probabilidadCobro: c.probabilidadCobro,
        totalCobrado: cobros,
        ultimoMovimiento: c.movimientos[0]
          ? { tipo: c.movimientos[0].tipo, monto: Number(c.movimientos[0].monto), fecha: c.movimientos[0].fecha }
          : null,
      };
    }), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/cuentas-corrientes:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
