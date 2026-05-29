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
  const mesParam = searchParams.get('mes');

  try {
    const desde = mesParam
      ? new Date(anio, parseInt(mesParam) - 1, 1)
      : new Date(anio, 0, 1);
    const hasta = mesParam
      ? new Date(anio, parseInt(mesParam), 0, 23, 59, 59)
      : new Date(anio, 11, 31, 23, 59, 59);

    const presupuestos = await prisma.presupuesto.findMany({
      where: {
        estado: { in: ['APROBADO', 'ENVIADO', 'PARA_ENVIAR'] },
        fechaCreacion: { gte: desde, lte: hasta },
      },
      select: {
        id: true, numero: true, totalFinal: true, tasaIva: true, montoIva: true,
        totalConIva: true, precioFinal: true, preciosNetos: true, fechaCreacion: true,
      },
    });

    // Group by IVA rate
    const porTasaIva: Record<string, { tasa: number; cantidad: number; netoTotal: number; ivaTotal: number; totalConIvaTotal: number }> = {};
    for (const p of presupuestos) {
      const tasa = Number(p.tasaIva);
      const key = String(tasa);
      if (!porTasaIva[key]) porTasaIva[key] = { tasa, cantidad: 0, netoTotal: 0, ivaTotal: 0, totalConIvaTotal: 0 };
      porTasaIva[key].cantidad++;
      porTasaIva[key].netoTotal += Number(p.totalFinal);
      porTasaIva[key].ivaTotal += Number(p.montoIva);
      porTasaIva[key].totalConIvaTotal += Number(p.totalConIva);
    }

    return jsonWithCors({
      anio,
      mes: mesParam ? parseInt(mesParam) : null,
      totalPresupuestos: presupuestos.length,
      netoTotal: presupuestos.reduce((s, p) => s + Number(p.totalFinal), 0),
      ivaTotal: presupuestos.reduce((s, p) => s + Number(p.montoIva), 0),
      totalConIvaTotal: presupuestos.reduce((s, p) => s + Number(p.totalConIva), 0),
      porTasaIva: Object.values(porTasaIva).sort((a, b) => a.tasa - b.tasa),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/presupuestos/resumen-fiscal:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
