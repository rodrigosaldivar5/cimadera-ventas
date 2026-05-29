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
    const [actual, historico] = await Promise.all([
      prisma.indiceGlobal.findFirst({ orderBy: { fecha: 'desc' } }),
      prisma.indiceGlobal.findMany({ orderBy: { fecha: 'desc' }, take: 24 }),
    ]);

    return jsonWithCors({
      actual: actual ? { id: actual.id, nombre: actual.nombre, valor: Number(actual.valor), fecha: actual.fecha } : null,
      historico: historico.map((i) => ({ id: i.id, nombre: i.nombre, valor: Number(i.valor), fecha: i.fecha })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/indices/actual:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
