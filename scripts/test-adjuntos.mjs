import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { writeFile, mkdir, unlink, rmdir, readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Obtener un presupuesto existente para el test
const presupuesto = await prisma.presupuesto.findFirst({ orderBy: { fechaCreacion: 'desc' } });
if (!presupuesto) {
  console.error('No hay presupuestos en la DB. Creá uno primero.');
  process.exit(1);
}
console.log(`Usando presupuesto: #${presupuesto.numero} (${presupuesto.id})\n`);

const presupuestoId = presupuesto.id;
const uploadDir = path.join(ROOT, 'public', 'adjuntos', presupuestoId);

// 1. Crear directorio
await mkdir(uploadDir, { recursive: true });
console.log(`✓ Directorio creado: public/adjuntos/${presupuestoId}/`);

// 2. Escribir archivo de prueba
const testFilename = `${Date.now()}-test_adjunto.pdf`;
const testFilepath = path.join(uploadDir, testFilename);
await writeFile(testFilepath, Buffer.from('%PDF-1.4 test file content'));
console.log(`✓ Archivo físico creado: ${testFilename}`);

// 3. Verificar que existe en disco
if (!existsSync(testFilepath)) {
  console.error('✗ El archivo no existe en disco');
  process.exit(1);
}
console.log(`✓ Archivo verificado en disco`);

// 4. Crear registro en DB
const archivo = await prisma.archivoPresupuesto.create({
  data: {
    presupuestoId,
    nombre: 'test_adjunto.pdf',
    url: `/adjuntos/${presupuestoId}/${testFilename}`,
    tipo: 'pdf',
    tamanio: 26,
  },
});
console.log(`✓ Registro creado en DB: id=${archivo.id}`);

// 5. Verificar en DB
const found = await prisma.archivoPresupuesto.findUnique({ where: { id: archivo.id } });
if (!found) {
  console.error('✗ Registro no encontrado en DB');
  process.exit(1);
}
console.log(`✓ Registro verificado en DB: nombre=${found.nombre}, tipo=${found.tipo}, tamanio=${found.tamanio}B`);

// Limpiar
await prisma.archivoPresupuesto.delete({ where: { id: archivo.id } });
await unlink(testFilepath);
try { await rmdir(uploadDir); } catch {}
console.log(`\n✓ Limpieza completa`);
console.log('\n✓ Test de adjuntos completado sin errores.');

await prisma.$disconnect();
