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
    const cuentas = await prisma.cuentaCorriente.findMany({
      include: { movimientos: true },
    });

    const now = new Date();
    let totalFacturado = 0, totalCobrado = 0, cuentasActivas = 0, cuentasSaldadas = 0;
    let menos30 = 0, de30a60 = 0, de60a90 = 0, mas90 = 0;

    for (const c of cuentas) {
      const monto = Number(c.montoOriginal);
      totalFacturado += monto;

      const cobros = c.movimientos
        .filter((m) => ['ANTICIPO', 'PAGO_PARCIAL'].includes(m.tipo))
        .reduce((s, m) => s + Number(m.monto), 0);
      totalCobrado += cobros;

      if (c.estado === 'CANCELADO') cuentasSaldadas++;
      else {
        cuentasActivas++;
        const saldo = Number(c.saldoActualizado);
        const diasDesde = Math.floor((now.getTime() - c.fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
        if (diasDesde < 30) menos30 += saldo;
        else if (diasDesde < 60) de30a60 += saldo;
        else if (diasDesde < 90) de60a90 += saldo;
        else mas90 += saldo;
      }
    }

    return jsonWithCors({
      totalFacturado,
      totalCobrado,
      saldoPendiente: totalFacturado - totalCobrado,
      cuentasActivas,
      cuentasSaldadas,
      saldosPorAntiguedad: {
        menos30dias: menos30,
        '30a60dias': de30a60,
        '60a90dias': de60a90,
        mas90dias: mas90,
      },
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/cuentas-corrientes/resumen:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
