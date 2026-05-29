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
  const { searchParams } = new URL(request.url);
  const anioParam = searchParams.get('anio');
  if (!anioParam) return jsonWithCors({ error: 'Param "anio" requerido' }, 400, origin);

  const anio = parseInt(anioParam);
  const categoriaId = searchParams.get('categoriaId');
  const costoId = searchParams.get('costoId');

  try {
    const costoWhere: Record<string, unknown> = { activo: true };
    if (categoriaId) costoWhere.categoriaId = categoriaId;
    if (costoId) costoWhere.id = costoId;

    const costos = await prisma.costoFijo.findMany({
      where: costoWhere,
      orderBy: { categoria: 'asc' },
      include: {
        registros: { where: { anio }, orderBy: { mes: 'asc' } },
        categoriaRel: true,
      },
    });

    // Group by month
    const meses = Array.from({ length: 12 }, (_, i) => i + 1);
    const porMes = meses.map((mes) => {
      let estARS = 0, realARS = 0, estUSD = 0, realUSD = 0;
      const items: { costoId: string; nombre: string; moneda: string; estimado: number | null; real: number | null }[] = [];
      for (const c of costos) {
        const r = c.registros.find((r) => r.mes === mes);
        if (!r) continue;
        const est = r.montoEstimado ? Number(r.montoEstimado) : null;
        const real = r.montoReal ? Number(r.montoReal) : null;
        items.push({ costoId: c.id, nombre: c.nombre, moneda: c.moneda, estimado: est, real });
        if (c.moneda === 'USD') { estUSD += est ?? 0; realUSD += real ?? 0; }
        else { estARS += est ?? 0; realARS += real ?? 0; }
      }
      return { mes, estimadoARS: estARS, realARS, estimadoUSD: estUSD, realUSD, items };
    }).filter((m) => m.items.length > 0);

    return jsonWithCors({ anio, porMes }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/costos-fijos/historico:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
