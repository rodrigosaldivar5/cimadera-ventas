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
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()));
  const mesParam = searchParams.get('mes');

  try {
    const registroWhere = mesParam
      ? { anio, mes: parseInt(mesParam) }
      : { anio };

    const costos = await prisma.costoFijo.findMany({
      where: { activo: true },
      orderBy: { categoria: 'asc' },
      include: {
        registros: { where: registroWhere, orderBy: { mes: 'asc' } },
        categoriaRel: true,
      },
    });

    const data = costos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      categoria: c.categoriaRel
        ? { id: c.categoriaRel.id, nombre: c.categoriaRel.nombre }
        : { id: null, nombre: c.categoria },
      moneda: c.moneda,
      observacion: c.observacion,
      registros: c.registros.map((r) => {
        const est = r.montoEstimado ? Number(r.montoEstimado) : null;
        const real = r.montoReal ? Number(r.montoReal) : null;
        const desvio = est && real ? parseFloat((((real - est) / est) * 100).toFixed(2)) : null;
        return { mes: r.mes, anio: r.anio, montoEstimado: est, montoReal: real, desvio };
      }),
    }));

    // Totals
    let estimadoARS = 0, realARS = 0, estimadoUSD = 0, realUSD = 0;
    let desviosARS: number[] = [];
    for (const c of data) {
      for (const r of c.registros) {
        if (c.moneda === 'USD') {
          estimadoUSD += r.montoEstimado ?? 0;
          realUSD += r.montoReal ?? 0;
        } else {
          estimadoARS += r.montoEstimado ?? 0;
          realARS += r.montoReal ?? 0;
          if (r.desvio != null) desviosARS.push(r.desvio);
        }
      }
    }
    const desvioPromedioARS = desviosARS.length
      ? parseFloat((desviosARS.reduce((s, d) => s + d, 0) / desviosARS.length).toFixed(2))
      : null;

    return jsonWithCors({ costos: data, totales: { estimadoARS, realARS, estimadoUSD, realUSD, desvioPromedioARS } }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/costos-fijos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
