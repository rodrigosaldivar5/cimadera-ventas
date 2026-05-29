import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { id } = await params;

  try {
    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id },
      include: {
        cliente: true,
        obra: true,
        presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true, totalFinal: true } },
        movimientos: { orderBy: { fecha: 'asc' } },
      },
    });

    if (!cuenta) return jsonWithCors({ error: 'Not found' }, 404, origin);

    return jsonWithCors({
      id: cuenta.id,
      cliente: cuenta.cliente,
      obra: cuenta.obra,
      presupuesto: cuenta.presupuesto,
      montoOriginal: Number(cuenta.montoOriginal),
      indiceInicio: Number(cuenta.indiceInicio),
      indiceActual: Number(cuenta.indiceActual),
      nombreIndice: cuenta.nombreIndice,
      saldoActualizado: Number(cuenta.saldoActualizado),
      estado: cuenta.estado,
      fechaInicio: cuenta.fechaInicio,
      observaciones: cuenta.observaciones,
      proximoCobro: cuenta.proximoCobro,
      probabilidadCobro: cuenta.probabilidadCobro,
      movimientos: cuenta.movimientos.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        saldoResultante: Number(m.saldoResultante),
        numeroFactura: m.numeroFactura,
        fecha: m.fecha,
        indiceValor: m.indiceValor ? Number(m.indiceValor) : null,
        tipoCambio: m.tipoCambio ? Number(m.tipoCambio) : null,
        montoEnARS: m.montoEnARS ? Number(m.montoEnARS) : null,
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/cuentas-corrientes/[id]:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
