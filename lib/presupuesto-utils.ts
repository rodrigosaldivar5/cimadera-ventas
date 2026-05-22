import { prisma } from '@/lib/prisma';

export async function getNextNumeroPresupuesto(): Promise<number> {
  const result = await prisma.presupuesto.aggregate({ _max: { numero: true } });
  const max = result._max.numero;
  return max ? max + 1 : 1001;
}
