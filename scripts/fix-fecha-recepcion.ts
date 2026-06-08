import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const sinFecha = await prisma.presupuesto.findMany({
    where: { fechaRecepcion: null },
    select: { id: true, numero: true, fechaCreacion: true },
  });

  console.log(`${sinFecha.length} presupuestos sin fecha de recepción`);

  for (const p of sinFecha) {
    await prisma.presupuesto.update({
      where: { id: p.id },
      data: { fechaRecepcion: p.fechaCreacion },
    });
    console.log(`#${p.numero}: fechaRecepcion = ${p.fechaCreacion.toISOString().split('T')[0]}`);
  }

  console.log('Done');
  await prisma.$disconnect();
}

main().catch(console.error);
