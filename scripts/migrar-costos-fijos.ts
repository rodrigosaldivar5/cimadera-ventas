import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const costos = await prisma.costoFijo.findMany();
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  for (const c of costos) {
    if (!c.categoriaId && c.categoria) {
      let cat = await prisma.categoriaCostoFijo.findFirst({
        where: { nombre: { equals: c.categoria, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await prisma.categoriaCostoFijo.create({ data: { nombre: c.categoria } });
      }
      await prisma.costoFijo.update({ where: { id: c.id }, data: { categoriaId: cat.id } });
    }

    const existe = await prisma.registroCostoFijo.findFirst({
      where: { costoFijoId: c.id, mes, anio },
    });
    if (!existe && c.monto) {
      await prisma.registroCostoFijo.create({
        data: { costoFijoId: c.id, mes, anio, montoReal: c.monto },
      });
      console.log(`Migrado: ${c.nombre}`);
    }
  }

  console.log('Migración completa.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
