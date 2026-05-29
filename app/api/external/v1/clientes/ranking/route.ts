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
  const metrica = searchParams.get('metrica') ?? 'facturado';
  const periodo = searchParams.get('periodo') ?? 'anio_actual';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

  try {
    const now = new Date();
    let desde: Date | undefined;
    if (periodo === 'mes_actual') desde = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (periodo === 'anio_actual') desde = new Date(now.getFullYear(), 0, 1);
    else if (periodo === 'ultimos_12m') desde = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      include: {
        presupuestos: {
          where: desde ? { fechaCreacion: { gte: desde } } : undefined,
          select: {
            id: true, totalFinal: true, totalConIva: true, estado: true,
            fechaCreacion: true,
          },
        },
        obras: { where: { activo: true }, select: { id: true } },
        cuentasCorrientes: {
          select: { montoOriginal: true, movimientos: { select: { tipo: true, monto: true } } },
        },
      },
    });

    const ranking = clientes.map((c) => {
      const totalFacturado = c.presupuestos
        .filter((p) => ['APROBADO', 'ENVIADO', 'PARA_ENVIAR'].includes(p.estado))
        .reduce((s, p) => s + Number(p.totalFinal), 0);

      const totalCobrado = c.cuentasCorrientes
        .flatMap((cc) => cc.movimientos)
        .filter((m) => ['ANTICIPO', 'PAGO_PARCIAL'].includes(m.tipo))
        .reduce((s, m) => s + Number(m.monto), 0);

      const ultimaVenta = c.presupuestos.length > 0
        ? c.presupuestos.sort((a, b) => b.fechaCreacion.getTime() - a.fechaCreacion.getTime())[0].fechaCreacion
        : null;

      const diasSinComprar = ultimaVenta
        ? Math.floor((now.getTime() - ultimaVenta.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const valorMetrica =
        metrica === 'facturado' ? totalFacturado
        : metrica === 'cobrado' ? totalCobrado
        : metrica === 'obras' ? c.obras.length
        : c.presupuestos.length;

      return {
        clienteId: c.id,
        razonSocial: c.razonSocial,
        tipoCliente: c.tipoCliente,
        valorMetrica,
        cantidadPresupuestos: c.presupuestos.length,
        cantidadObras: c.obras.length,
        ultimaVenta,
        diasSinComprar,
      };
    });

    ranking.sort((a, b) => b.valorMetrica - a.valorMetrica);

    return jsonWithCors({ ranking: ranking.slice(0, limit) }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/clientes/ranking:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
