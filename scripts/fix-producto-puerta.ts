import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const producto = await prisma.producto.findFirst({
    where: { nombre: { contains: 'Puerta para pintar' } },
    include: { atributos: { include: { opciones: true } } },
  });

  if (!producto) {
    console.log('Producto "Puerta para pintar" no encontrado. Creando...');
    const categoria = await prisma.categoriaProducto.findFirst({ where: { nombre: { contains: 'Puerta' } } });
    if (!categoria) {
      console.error('No hay categoría de producto para puertas.');
      return;
    }
    await prisma.producto.create({
      data: {
        nombre: 'Puerta para pintar',
        categoriaId: categoria.id,
        atributos: {
          create: [
            {
              nombre: 'Bisagra',
              requerido: true,
              opciones: {
                create: [
                  { nombre: 'Bisagra estándar', costoBase: 800, indiceUtilidad: 1.3, precioVenta: 1040, unidad: 'juego' },
                  { nombre: 'Bisagra reforzada', costoBase: 1500, indiceUtilidad: 1.3, precioVenta: 1950, unidad: 'juego' },
                ],
              },
            },
            {
              nombre: 'Cerradura',
              requerido: true,
              opciones: {
                create: [
                  { nombre: 'Cerradura simple', costoBase: 2000, indiceUtilidad: 1.3, precioVenta: 2600, unidad: 'unidad' },
                  { nombre: 'Cerradura doble paleta', costoBase: 4500, indiceUtilidad: 1.3, precioVenta: 5850, unidad: 'unidad' },
                ],
              },
            },
            {
              nombre: 'Acabado',
              requerido: false,
              opciones: {
                create: [
                  { nombre: 'Sin pintura', costoBase: 0, indiceUtilidad: 1, precioVenta: 0, unidad: 'unidad' },
                  { nombre: 'Pintura blanca', costoBase: 3000, indiceUtilidad: 1.3, precioVenta: 3900, unidad: 'unidad' },
                  { nombre: 'Pintura a elección', costoBase: 4000, indiceUtilidad: 1.3, precioVenta: 5200, unidad: 'unidad' },
                ],
              },
            },
            {
              nombre: 'Marco',
              requerido: false,
              opciones: {
                create: [
                  { nombre: 'Sin marco', costoBase: 0, indiceUtilidad: 1, precioVenta: 0, unidad: 'ml' },
                  { nombre: 'Marco pino', costoBase: 1200, indiceUtilidad: 1.3, precioVenta: 1560, unidad: 'ml' },
                  { nombre: 'Marco MDF', costoBase: 2000, indiceUtilidad: 1.3, precioVenta: 2600, unidad: 'ml' },
                ],
              },
            },
          ],
        },
      },
    });
    console.log('Producto creado con atributos.');
    return;
  }

  console.log(`Producto encontrado: ${producto.nombre} (${producto.atributos.length} atributos)`);

  const tieneOpcionesValidas = producto.atributos.some((a) => a.opciones.length > 0 && a.nombre.trim());

  if (producto.atributos.length === 0 || !tieneOpcionesValidas) {
    console.log('Atributos vacíos o sin opciones. Recreando...');
    await prisma.atributoProducto.deleteMany({ where: { productoId: producto.id } });
  }

  if (producto.atributos.length === 0 || !tieneOpcionesValidas) {
    console.log('Sin atributos. Agregando...');
    await prisma.atributoProducto.createMany({
      data: [
        { productoId: producto.id, nombre: 'Bisagra', requerido: true },
        { productoId: producto.id, nombre: 'Cerradura', requerido: true },
        { productoId: producto.id, nombre: 'Acabado', requerido: false },
        { productoId: producto.id, nombre: 'Marco', requerido: false },
      ],
    });

    const atributos = await prisma.atributoProducto.findMany({ where: { productoId: producto.id } });

    for (const a of atributos) {
      if (a.nombre === 'Bisagra') {
        await prisma.opcionAtributo.createMany({
          data: [
            { atributoId: a.id, nombre: 'Bisagra estándar', costoBase: 800, indiceUtilidad: 1.3, precioVenta: 1040, unidad: 'juego' },
            { atributoId: a.id, nombre: 'Bisagra reforzada', costoBase: 1500, indiceUtilidad: 1.3, precioVenta: 1950, unidad: 'juego' },
          ],
        });
      } else if (a.nombre === 'Cerradura') {
        await prisma.opcionAtributo.createMany({
          data: [
            { atributoId: a.id, nombre: 'Cerradura simple', costoBase: 2000, indiceUtilidad: 1.3, precioVenta: 2600, unidad: 'unidad' },
            { atributoId: a.id, nombre: 'Cerradura doble paleta', costoBase: 4500, indiceUtilidad: 1.3, precioVenta: 5850, unidad: 'unidad' },
          ],
        });
      } else if (a.nombre === 'Acabado') {
        await prisma.opcionAtributo.createMany({
          data: [
            { atributoId: a.id, nombre: 'Sin pintura', costoBase: 0, indiceUtilidad: 1, precioVenta: 0, unidad: 'unidad' },
            { atributoId: a.id, nombre: 'Pintura blanca', costoBase: 3000, indiceUtilidad: 1.3, precioVenta: 3900, unidad: 'unidad' },
            { atributoId: a.id, nombre: 'Pintura a elección', costoBase: 4000, indiceUtilidad: 1.3, precioVenta: 5200, unidad: 'unidad' },
          ],
        });
      } else if (a.nombre === 'Marco') {
        await prisma.opcionAtributo.createMany({
          data: [
            { atributoId: a.id, nombre: 'Sin marco', costoBase: 0, indiceUtilidad: 1, precioVenta: 0, unidad: 'ml' },
            { atributoId: a.id, nombre: 'Marco pino', costoBase: 1200, indiceUtilidad: 1.3, precioVenta: 1560, unidad: 'ml' },
            { atributoId: a.id, nombre: 'Marco MDF', costoBase: 2000, indiceUtilidad: 1.3, precioVenta: 2600, unidad: 'ml' },
          ],
        });
      }
    }
    console.log('Atributos y opciones creados.');
  } else {
    console.log('El producto ya tiene atributos con opciones:');
    for (const a of producto.atributos) {
      console.log(`  - ${a.nombre}: ${a.opciones.length} opciones`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
