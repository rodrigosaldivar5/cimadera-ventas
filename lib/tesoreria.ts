import { prisma } from '@/lib/prisma';

export const TESORERIA_EMAILS = [
  'coordinacion.general@cimadera.net',
  'admin@cimadera.net',
];

export function isTesoreriaAuthorized(email: string | null | undefined): boolean {
  return TESORERIA_EMAILS.includes(email ?? '');
}

export async function getSaldoCaja(caja: 'ARS' | 'USD'): Promise<number> {
  const movimientos = await prisma.movimientoTesoreria.findMany({
    where: { caja },
    orderBy: { fecha: 'asc' },
  });
  return movimientos.reduce((saldo, m) => {
    if (['INGRESO', 'TRASPASO_ENTRADA', 'CANJE_REALIZADO'].includes(m.tipo)) {
      return saldo + parseFloat(m.monto.toString());
    }
    return saldo - parseFloat(m.monto.toString());
  }, 0);
}
