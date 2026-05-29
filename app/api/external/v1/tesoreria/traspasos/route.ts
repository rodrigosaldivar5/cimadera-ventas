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
    const traspasos = await prisma.traspaso.findMany({ orderBy: { fecha: 'desc' } });
    return jsonWithCors(traspasos.map((t) => ({
      id: t.id,
      cajaOrigen: t.cajaOrigen,
      cajaDestino: t.cajaDestino,
      montoOrigen: Number(t.montoOrigen),
      montoDestino: Number(t.montoDestino),
      tipoCambioUsado: Number(t.tipoCambioUsado),
      descripcion: t.descripcion,
      fecha: t.fecha,
    })), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/tesoreria/traspasos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
