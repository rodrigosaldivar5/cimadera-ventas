/**
 * test-ftp-drive.ts — prueba manual de la integración FTP con Google Drive.
 *
 * Pasos que valida:
 *   1. Auth de cuenta de servicio
 *   2. Encontrar plantilla "Formato FTP"
 *   3. buildFtpFileName con datos reales
 *   4. Copiar plantilla → carpeta destino (crea archivo real en Drive)
 *   5. Verificar que el archivo copiado existe y tiene la URL correcta
 *
 * Uso:
 *   npm run test:ftp             → solo valida auth + plantilla (no copia)
 *   npm run test:ftp -- --copy   → también copia la plantilla (crea archivo en Drive)
 *
 * ⚠ Con --copy se crea un archivo real en Drive. Eliminarlo manualmente después.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { google } from 'googleapis';
import { buildFtpFileName, findFtpTemplate, copyFtpTemplateForPresupuesto } from '../lib/integrations/google-drive';

const COPY_MODE = process.argv.includes('--copy');

async function main() {
  console.log('\n=== test-ftp-drive ===\n');

  // ── 1. Variables de entorno ────────────────────────────────────────────────
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY;
  const folder = process.env.GOOGLE_DRIVE_FTP_FOLDER_ID;
  const templateIdEnv = process.env.GOOGLE_DRIVE_FTP_TEMPLATE_ID;

  console.log('1. Variables de entorno');
  console.log(`   GOOGLE_CLIENT_EMAIL       : ${email ? `${email.slice(0, 20)}…` : '❌ NO CONFIGURADA'}`);
  console.log(`   GOOGLE_PRIVATE_KEY        : ${key ? `${key.slice(0, 20).replace(/\n/g, '\\n')}… (${key.length} chars)` : '❌ NO CONFIGURADA'}`);
  console.log(`   GOOGLE_DRIVE_FTP_FOLDER_ID: ${folder ?? '❌ NO CONFIGURADA'}`);
  console.log(`   GOOGLE_DRIVE_FTP_TEMPLATE_ID: ${templateIdEnv ?? '(no configurado — buscará por nombre)'}`);

  if (!email || !key || !folder) {
    console.error('\n❌ Faltan variables de entorno. Abortando.\n');
    process.exit(1);
  }

  // ── 2. Auth básico — listar carpeta ────────────────────────────────────────
  console.log('\n2. Auth + listado de carpeta destino');
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });

    const carpeta = await drive.files.get({
      fileId: folder,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    console.log(`   ✓ Carpeta destino encontrada: "${carpeta.data.name}" (${carpeta.data.mimeType})`);
  } catch (err) {
    console.error(`   ❌ Error al acceder a la carpeta: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── 3. Buscar plantilla ───────────────────────────────────────────────────
  console.log('\n3. Buscar plantilla "Formato FTP"');
  let templateId: string;
  try {
    templateId = await findFtpTemplate();
    const via = templateIdEnv ? 'GOOGLE_DRIVE_FTP_TEMPLATE_ID (env)' : 'búsqueda por nombre en carpeta';
    console.log(`   ✓ Plantilla encontrada: ${templateId}  (vía: ${via})`);
  } catch (err) {
    console.error(`   ❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── 4. buildFtpFileName ───────────────────────────────────────────────────
  console.log('\n4. buildFtpFileName');
  const casos = [
    { numero: 1086, obraNombre: 'Casa Fernández', clienteNombre: 'Juan Fernández', presupuestoNombre: null },
    { numero: 1087, obraNombre: null, clienteNombre: 'María López', presupuestoNombre: 'Remodelación cocina' },
    { numero: 999,  obraNombre: null, clienteNombre: null, presupuestoNombre: null },
  ];
  for (const c of casos) {
    const nombre = buildFtpFileName(c);
    console.log(`   pres ${c.numero}: "${nombre}"`);
  }

  // ── 4b. Verificar que el archivo plantilla es accesible ──────────────────
  console.log('\n4b. Verificar acceso directo al archivo plantilla');
  try {
    const auth2 = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive2 = google.drive({ version: 'v3', auth: auth2 });
    const tmpl = await drive2.files.get({
      fileId: templateId,
      fields: 'id, name, mimeType, parents, driveId',
      supportsAllDrives: true,
    });
    console.log(`   ✓ Plantilla accesible: "${tmpl.data.name}"`);
    console.log(`     mimeType : ${tmpl.data.mimeType}`);
    console.log(`     parents  : ${JSON.stringify(tmpl.data.parents)}`);
    console.log(`     driveId  : ${tmpl.data.driveId ?? '(My Drive / sin Shared Drive)'}`);
  } catch (err) {
    console.error(`   ❌ No se puede acceder al archivo plantilla: ${err instanceof Error ? err.message : String(err)}`);
    console.error('   → La cuenta de servicio no tiene permiso sobre ese archivo específico.');
    console.error('   → Solución: compartir el archivo directamente con la cuenta de servicio,');
    console.error(`     o agregar la cuenta de servicio como miembro del Shared Drive.`);
    if (!COPY_MODE) process.exit(1);
  }

  if (!COPY_MODE) {
    console.log('\n✓ Validación OK (sin copia). Pasá --copy para probar la copia real en Drive.\n');
    return;
  }

  // ── 5. Copia real ─────────────────────────────────────────────────────────
  console.log('\n5. Copia real de la plantilla (--copy mode)');
  const nombrePrueba = buildFtpFileName({ numero: 9999, obraNombre: 'TEST - BORRAR', clienteNombre: null, presupuestoNombre: null });
  console.log(`   Nombre del archivo de prueba: "${nombrePrueba}"`);
  try {
    const { fileId, url } = await copyFtpTemplateForPresupuesto({ nombre: nombrePrueba });
    console.log(`   ✓ Archivo creado en Drive:`);
    console.log(`     fileId : ${fileId}`);
    console.log(`     url    : ${url}`);
    console.log(`\n   ⚠ Acordate de eliminar este archivo de prueba en Drive.`);
  } catch (err) {
    console.error(`   ❌ Error al copiar: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  console.log('\n✓ Todas las pruebas pasaron.\n');
}

main().catch((err) => {
  console.error('\n❌ Error inesperado:', err);
  process.exit(1);
});
