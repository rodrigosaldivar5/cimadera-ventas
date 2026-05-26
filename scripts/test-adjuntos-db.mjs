import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const presupuesto = await prisma.presupuesto.findFirst({ orderBy: { fechaCreacion: 'desc' } });
if (!presupuesto) { console.error('No hay presupuestos en la DB.'); process.exit(1); }
console.log(`Usando presupuesto: #${presupuesto.numero} (${presupuesto.id})\n`);

const contenido = Buffer.from('%PDF-1.4 test content');
const archivoId_placeholder = 'temp';

// 1. Crear con contenido en DB
const archivo = await prisma.archivoPresupuesto.create({
  data: {
    presupuestoId: presupuesto.id,
    nombre: 'test.pdf',
    url: '',
    tipo: 'pdf',
    tamanio: contenido.length,
    contenido,
  },
});
console.log(`✓ Registro creado: id=${archivo.id}`);

// 2. Actualizar url con id real
const url = `/api/presupuestos/${presupuesto.id}/archivos/${archivo.id}/download`;
await prisma.archivoPresupuesto.update({ where: { id: archivo.id }, data: { url } });
console.log(`✓ URL actualizada: ${url}`);

// 3. Verificar contenido en DB
const found = await prisma.archivoPresupuesto.findUnique({ where: { id: archivo.id } });
if (!found?.contenido) { console.error('✗ Contenido no encontrado en DB'); process.exit(1); }
console.log(`✓ Contenido verificado: ${found.contenido.length} bytes`);
console.log(`✓ URL almacenada: ${found.url}`);

// 4. Limpiar
await prisma.archivoPresupuesto.delete({ where: { id: archivo.id } });
console.log(`\n✓ Limpieza completa`);
console.log('✓ Test de adjuntos en DB completado sin errores.');

await prisma.$disconnect();
