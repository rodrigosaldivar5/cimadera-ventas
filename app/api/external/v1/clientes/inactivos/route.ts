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
  const diasMinimos = parseInt(searchParams.get('diasMinimos') ?? '90');

  try {
    const corte = new Date(Date.now() - diasMinimos * 24 * 60 * 60 * 1000);

    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      include: {
        presupuestos: {
          orderBy: { fechaCreacion: 'desc' },
          take: 1,
          select: { fechaCreacion: true, estado: true },
        },
        _count: { select: { presupuestos: true } },
      },
    });

    const inactivos = clientes
      .filter((c) => {
        const ultima = c.presupuestos[0]?.fechaCreacion;
        return !ultima || ultima < corte;
      })
      .map((c) => {
        const ultima = c.presupuestos[0]?.fechaCreacion ?? null;
        const diasSinActividad = ultima
          ? Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        return {
          id: c.id,
          razonSocial: c.razonSocial,
          tipoCliente: c.tipoCliente,
          email: c.email,
          telefono: c.telefono,
          ultimaActividad: ultima,
          diasSinActividad,
          totalPresupuestos: c._count.presupuestos,
        };
      })
      .sort((a, b) => (b.diasSinActividad ?? Infinity) - (a.diasSinActividad ?? Infinity));

    return jsonWithCors({ diasMinimos, total: inactivos.length, clientes: inactivos }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/clientes/inactivos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
