import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const filas = [
  { nombre: 'Bisagra 3" acero TEST', descripcion: 'Bisagra de acero inoxidable con tornillos', categoria: 'Test Bisagras', costoBase: 120, indiceUtilidad: 1.3, unidad: 'par' },
  { nombre: 'Marco MDF 90mm TEST', descripcion: 'Marco de MDF melaminado blanco', categoria: 'Test Marcos', costoBase: 2400, indiceUtilidad: 1.4, unidad: 'ml' },
  { nombre: 'Cerradura embutir TEST', descripcion: 'Con manija y llaves', categoria: 'Test Cerraduras', costoBase: 3100, indiceUtilidad: 1.35, unidad: 'unidad' },
  { nombre: 'Sellador PU 300ml TEST', descripcion: 'Para juntas exteriores', categoria: 'Test Selladores', costoBase: 850, indiceUtilidad: 1.5, unidad: 'unidad' },
  { nombre: 'Varilla M8 1m TEST', descripcion: null, categoria: 'Test Herrajes', costoBase: 180, indiceUtilidad: 1.25, unidad: 'unidad' },
];

console.log('--- Ejecutando importación de prueba ---\n');

let creados = 0;
let actualizados = 0;
const errores = [];

for (const fila of filas) {
  try {
    let categoria = await prisma.categoriaItem.findFirst({
      where: { nombre: { equals: fila.categoria, mode: 'insensitive' } },
    });
    if (!categoria) {
      categoria = await prisma.categoriaItem.create({ data: { nombre: fila.categoria } });
      console.log(`  ✓ Categoría creada: ${categoria.nombre}`);
    }

    const precioVenta = parseFloat((fila.costoBase * fila.indiceUtilidad).toFixed(2));
    const existing = await prisma.item.findFirst({
      where: { nombre: { equals: fila.nombre, mode: 'insensitive' }, categoriaId: categoria.id },
    });

    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: {
          descripcion: fila.descripcion ?? existing.descripcion,
          costoBase: fila.costoBase,
          indiceUtilidad: fila.indiceUtilidad,
          precioVenta,
          unidad: fila.unidad,
        },
      });
      actualizados++;
      console.log(`  ~ Actualizado: ${fila.nombre} → $${precioVenta}`);
    } else {
      await prisma.item.create({
        data: {
          nombre: fila.nombre,
          descripcion: fila.descripcion ?? null,
          categoriaId: categoria.id,
          costoBase: fila.costoBase,
          indiceUtilidad: fila.indiceUtilidad,
          precioVenta,
          unidad: fila.unidad,
        },
      });
      creados++;
      console.log(`  + Creado: ${fila.nombre} → $${precioVenta}`);
    }
  } catch (e) {
    errores.push(`${fila.nombre}: ${e.message}`);
    console.error(`  ✗ Error: ${fila.nombre}: ${e.message}`);
  }
}

console.log(`\nResultado: ${creados} creados, ${actualizados} actualizados, ${errores.length} errores`);

// Verificar en DB
console.log('\n--- Verificación en DB ---');
const categoriasTest = await prisma.categoriaItem.findMany({
  where: { nombre: { contains: 'Test' } },
  include: { items: { where: { nombre: { contains: 'TEST' } } } },
});
for (const cat of categoriasTest) {
  console.log(`  Categoría: ${cat.nombre}`);
  for (const item of cat.items) {
    console.log(`    - ${item.nombre} | costo: $${item.costoBase} | precio: $${item.precioVenta} | unidad: ${item.unidad}`);
  }
}

// Limpiar
console.log('\n--- Limpiando datos de test ---');
for (const cat of categoriasTest) {
  await prisma.item.deleteMany({ where: { categoriaId: cat.id, nombre: { contains: 'TEST' } } });
  const remaining = await prisma.item.count({ where: { categoriaId: cat.id } });
  if (remaining === 0) {
    await prisma.categoriaItem.delete({ where: { id: cat.id } });
    console.log(`  Eliminada categoría: ${cat.nombre}`);
  }
}
console.log('Limpieza completa.\n');

await prisma.$disconnect();

if (errores.length > 0) {
  console.error('ERRORES:', errores);
  process.exit(1);
}
console.log('✓ Test completado sin errores.');
