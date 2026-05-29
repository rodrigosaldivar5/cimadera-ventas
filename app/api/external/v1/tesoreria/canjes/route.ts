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
    const canjes = await prisma.activoCanje.findMany({ orderBy: { fechaRecepcion: 'desc' } });
    return jsonWithCors(canjes.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      descripcion: c.descripcion,
      fechaRecepcion: c.fechaRecepcion,
      valorEntrada: Number(c.valorEntrada),
      valorEstimado: Number(c.valorEstimado),
      estado: c.estado,
      fechaRealizacion: c.fechaRealizacion,
      valorVenta: c.valorVenta ? Number(c.valorVenta) : null,
      gananciaUSD: c.gananciaUSD ? Number(c.gananciaUSD) : null,
      observaciones: c.observaciones,
    })), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/tesoreria/canjes:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
