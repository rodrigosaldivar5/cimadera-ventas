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
    const historial = await prisma.tipoCambio.findMany({ orderBy: { fecha: 'desc' } });
    return jsonWithCors(historial.map((t) => ({
      id: t.id,
      valor: Number(t.valor),
      fecha: t.fecha,
      creadoPor: t.creadoPor,
    })), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/tesoreria/tipo-cambio/historico:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
