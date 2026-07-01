import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja } from '@/lib/tesoreria';

// Mapeo de tipos internos al formato CRM
const TIPO_MAP: Record<string, string> = {
  INGRESO:          'INGRESO',
  EGRESO:           'EGRESO',
  TRASPASO_ENTRADA: 'TRASPASO',
  TRASPASO_SALIDA:  'TRASPASO',
  CANJE_REALIZADO:  'CANJE',
};

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// ── GET /api/external/v1/tesoreria ───────────────────────────────────────────
//
// Espejo exacto de la UI Ventas /tesoreria.
// Usa getSaldoCaja() — misma función que la pantalla — en lugar de
// saldoResultante del último movimiento (snapshot que puede quedar desactualizado).

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  try {
    const [sARS, sUSD, canjes, tipoCambioActual, movimientosRecientes] = await Promise.all([
      getSaldoCaja('ARS'),
      getSaldoCaja('USD'),
      prisma.activoCanje.findMany(),
      prisma.tipoCambio.findFirst({ orderBy: { fecha: 'desc' } }),
      prisma.movimientoTesoreria.findMany({
        orderBy: { fecha: 'desc' },
        take: 20,
        include: { tipoCambio: true },
      }),
    ]);

    const tc = tipoCambioActual ? Number(tipoCambioActual.valor) : 0;

    const canjesActivos    = canjes.filter((c) => c.estado === 'NO_LIQUIDO');
    const canjesRealizados = canjes.filter((c) => c.estado === 'REALIZADO');
    const montoActivoUSD   = canjesActivos.reduce((s, c) => s + Number(c.valorEstimado), 0);

    return jsonWithCors({
      tipoCambioActivo:     tc,
      fechaActualizacionTC: tipoCambioActual?.fecha ?? null,
      cajas: {
        ARS: {
          saldo:          sARS,
          equivalenteUSD: tc > 0 ? Math.round((sARS / tc) * 100) / 100 : 0,
        },
        USD: {
          saldo:          sUSD,
          equivalenteARS: Math.round(sUSD * tc),
        },
      },
      canjes: {
        activos:       canjesActivos.length,
        realizados:    canjesRealizados.length,
        montoActivoUSD,
      },
      movimientosRecientes: movimientosRecientes.map((m) => ({
        id:            m.id,
        fecha:         m.fecha,
        tipo:          TIPO_MAP[m.tipo] ?? m.tipo,
        descripcion:   m.descripcion,
        caja:          m.caja,
        monto:         Number(m.monto),
        moneda:        m.caja,
        saldoPosterior: Number(m.saldoResultante),
        referencia:    null, // no disponible en schema actual
      })),
    }, 200, origin);

  } catch (error) {
    console.error('Error en /external/v1/tesoreria:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
