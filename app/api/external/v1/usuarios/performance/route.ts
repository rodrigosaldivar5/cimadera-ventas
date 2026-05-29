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
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const usuarioId = searchParams.get('usuarioId');

  try {
    const fechaWhere = desde || hasta ? {
      fechaCreacion: {
        ...(desde && { gte: new Date(desde) }),
        ...(hasta && { lte: new Date(hasta) }),
      },
    } : {};

    const userWhere = usuarioId ? { id: usuarioId, aprobado: true } : { aprobado: true };

    const usuarios = await prisma.user.findMany({
      where: userWhere,
      include: {
        presupuestosCreados: {
          where: fechaWhere,
          select: {
            id: true, estado: true, totalFinal: true,
            fechaCreacion: true, fechaEnvio: true, fechaRecepcion: true,
          },
        },
      },
    });

    const performance = usuarios.map((u) => {
      const presupuestos = u.presupuestosCreados;
      const aprobados = presupuestos.filter((p) => p.estado === 'APROBADO');
      const rechazados = presupuestos.filter((p) => p.estado === 'RECHAZADO');
      const montoAprobado = aprobados.reduce((s, p) => s + Number(p.totalFinal), 0);

      const tiemposRespuesta = presupuestos
        .filter((p) => p.fechaEnvio && p.fechaRecepcion)
        .map((p) => Math.abs(
          (p.fechaEnvio!.getTime() - p.fechaRecepcion!.getTime()) / (1000 * 60 * 60 * 24)
        ));
      const tiempoPromedio = tiemposRespuesta.length
        ? parseFloat((tiemposRespuesta.reduce((s, t) => s + t, 0) / tiemposRespuesta.length).toFixed(1))
        : null;

      return {
        usuarioId: u.id,
        nombre: u.nombre,
        presupuestosCreados: presupuestos.length,
        presupuestosAprobados: aprobados.length,
        presupuestosRechazados: rechazados.length,
        tasaConversion: presupuestos.length > 0
          ? parseFloat(((aprobados.length / presupuestos.length) * 100).toFixed(1))
          : 0,
        montoTotalAprobado: montoAprobado,
        ticketPromedio: aprobados.length > 0 ? Math.round(montoAprobado / aprobados.length) : 0,
        tiempoPromedioRespuestaDias: tiempoPromedio,
      };
    });

    performance.sort((a, b) => b.montoTotalAprobado - a.montoTotalAprobado);
    return jsonWithCors({ performance }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/usuarios/performance:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
