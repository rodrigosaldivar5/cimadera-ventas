import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildPresupuestoFolderName,
  getOrCreatePresupuestoAdjuntosFolder,
  initResumableUpload,
} from '@/lib/integrations/google-drive';

const ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp',
  '.dwg', '.dxf',
  '.zip', '.rar',
  '.skp', '.step', '.stp',
]);

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const DRIVE_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  dwg: 'application/octet-stream',
  dxf: 'application/octet-stream',
  skp: 'application/octet-stream',
  step: 'application/octet-stream',
  stp: 'application/octet-stream',
};

const BLOCKED_CONTENT_TYPES = new Set([
  'text/html', 'text/javascript',
  'application/javascript', 'application/x-javascript',
  'application/x-httpd-php', 'application/x-php',
  'application/x-sh', 'application/x-shellscript',
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const adjuntosFolderId = process.env.GOOGLE_DRIVE_ADJUNTOS_PRESUPUESTOS_FOLDER_ID;
  if (!adjuntosFolderId) {
    return NextResponse.json(
      { error: 'Falta configurar: GOOGLE_DRIVE_ADJUNTOS_PRESUPUESTOS_FOLDER_ID' },
      { status: 500 },
    );
  }
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Faltan credenciales de Google Drive' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as { nombre?: string; tipo?: string; tamano?: number; contentType?: string };
    const { nombre, tamano, contentType } = body;

    if (!nombre || typeof nombre !== 'string') {
      return NextResponse.json({ error: 'Falta nombre del archivo' }, { status: 400 });
    }
    if (!tamano || typeof tamano !== 'number' || tamano <= 0) {
      return NextResponse.json({ error: 'Falta tamaño del archivo' }, { status: 400 });
    }

    const lastDot = nombre.lastIndexOf('.');
    const ext = lastDot >= 0 ? nombre.slice(lastDot).toLowerCase() : '';
    if (!ext) {
      return NextResponse.json({ error: 'El archivo no tiene extensión' }, { status: 400 });
    }
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
    }
    if (contentType && BLOCKED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: `Tipo de contenido bloqueado (${contentType})` }, { status: 400 });
    }
    if (tamano > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el máximo permitido de 20 MB' }, { status: 400 });
    }

    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id: params.id },
      select: {
        numero: true,
        nombrePresupuesto: true,
        obra: { select: { nombre: true } },
        cliente: { select: { razonSocial: true } },
      },
    });
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const folderName = buildPresupuestoFolderName({
      numero: presupuesto.numero,
      obraNombre: presupuesto.obra?.nombre,
      clienteNombre: presupuesto.cliente?.razonSocial,
      presupuestoNombre: presupuesto.nombrePresupuesto,
    });

    const folderId = await getOrCreatePresupuestoAdjuntosFolder({
      parentFolderId: adjuntosFolderId,
      folderName,
    });

    const tipo = ext.replace('.', '');
    const mimeType = DRIVE_MIME[tipo] ?? 'application/octet-stream';

    const uploadUrl = await initResumableUpload({
      folderId,
      nombre,
      mimeType,
    });

    console.log('[INIT-UPLOAD] OK:', 'presupuestoId:', params.id, 'nombre:', nombre, 'tamano:', tamano, 'mimeType:', mimeType, 'folderId:', folderId);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      folderId,
      nombre,
      mimeType,
      tamano,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al iniciar upload';
    console.error('[INIT-UPLOAD] Error:', 'presupuestoId:', params.id, msg);
    return NextResponse.json({ error: 'No se pudo preparar la subida. Intentá nuevamente.' }, { status: 500 });
  }
}
