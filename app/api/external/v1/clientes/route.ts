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
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { razonSocial: 'asc' },
      include: {
        _count: { select: { presupuestos: true, obras: true } },
      },
    });

    return jsonWithCors(clientes.map((c) => ({
      id: c.id,
      razonSocial: c.razonSocial,
      cuit: c.cuit,
      email: c.email,
      telefono: c.telefono,
      ciudad: c.ciudad,
      provincia: c.provincia,
      tipoCliente: c.tipoCliente,
      cantidadPresupuestos: c._count.presupuestos,
      cantidadObras: c._count.obras,
      createdAt: c.createdAt,
    })), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/clientes:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
