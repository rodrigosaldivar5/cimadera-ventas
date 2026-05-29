import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

const ESTADOS_ACTIVOS = ['PENDIENTE', 'EN_PROCESO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO'] as const;

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  try {
    const presupuestos = await prisma.presupuesto.findMany({
      where: { estado: { in: [...ESTADOS_ACTIVOS] } },
      select: { estado: true, totalFinal: true },
    });

    const pipeline = ESTADOS_ACTIVOS.map((estado) => {
      const items = presupuestos.filter((p) => p.estado === estado);
      return {
        estado,
        cantidad: items.length,
        montoTotal: items.reduce((s, p) => s + Number(p.totalFinal), 0),
      };
    });

    const totalActivos = presupuestos.length;
    const montoTotalPipeline = presupuestos.reduce((s, p) => s + Number(p.totalFinal), 0);

    return jsonWithCors({ pipeline, totalActivos, montoTotalPipeline }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/pipeline:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
