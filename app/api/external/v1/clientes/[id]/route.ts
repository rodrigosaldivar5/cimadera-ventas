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
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        obras: { where: { activo: true } },
        presupuestos: {
          orderBy: { fechaCreacion: 'desc' },
          select: {
            id: true, numero: true, nombrePresupuesto: true, estado: true,
            totalFinal: true, totalConIva: true, fechaCreacion: true,
          },
        },
        cuentasCorrientes: {
          select: {
            id: true, estado: true, montoOriginal: true, saldoActualizado: true, fechaInicio: true,
          },
        },
      },
    });

    if (!cliente) return jsonWithCors({ error: 'Not found' }, 404, origin);

    return jsonWithCors({
      ...cliente,
      presupuestos: cliente.presupuestos.map((p) => ({
        ...p,
        totalFinal: Number(p.totalFinal),
        totalConIva: Number(p.totalConIva),
      })),
      cuentasCorrientes: cliente.cuentasCorrientes.map((c) => ({
        ...c,
        montoOriginal: Number(c.montoOriginal),
        saldoActualizado: Number(c.saldoActualizado),
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/clientes/[id]:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
