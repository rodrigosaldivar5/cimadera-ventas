import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  buildPresupuestoFolderName,
  getOrCreatePresupuestoAdjuntosFolder,
  uploadPresupuestoAdjuntoToDrive,
} from '@/lib/integrations/google-drive';
import path from 'path';

const ALLOWED_EXTS = ['.pdf', '.xml', '.xlsx', '.xls', '.doc', '.docx'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const archivos = await prisma.archivoPresupuesto.findMany({
      where: { presupuestoId: params.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        url: true,
        tipo: true,
        tamanio: true,
        createdAt: true,
        driveUrl: true,
        storageProvider: true,
      },
    });
    return NextResponse.json(archivos);
  } catch {
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 });
  }
}

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
    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id: params.id },
      select: {
        numero: true,
        nombrePresupuesto: true,
        obra: { select: { nombre: true } },
        cliente: { select: { razonSocial: true } },
      },
    });
    if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const folderName = buildPresupuestoFolderName({
      numero: presupuesto.numero,
      obraNombre: presupuesto.obra?.nombre,
      clienteNombre: presupuesto.cliente?.razonSocial,
      presupuestoNombre: presupuesto.nombrePresupuesto,
    });

    const subFolderId = await getOrCreatePresupuestoAdjuntosFolder({
      parentFolderId: adjuntosFolderId,
      folderName,
    });

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0)
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });

    const archivosCreados = [];
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) continue;
      if (file.size > MAX_SIZE) continue;
      if (file.size === 0) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tipo = ext.replace('.', '');
      const mimeType = MIME_TYPES[tipo] ?? 'application/octet-stream';

      const { fileId, url: driveUrl } = await uploadPresupuestoAdjuntoToDrive({
        folderId: subFolderId,
        nombre: file.name,
        buffer,
        mimeType,
      });

      const archivo = await prisma.archivoPresupuesto.create({
        data: {
          presupuestoId: params.id,
          nombre: file.name,
          url: driveUrl,
          tipo,
          tamanio: file.size,
          driveFileId: fileId,
          driveUrl,
          driveFolderId: subFolderId,
          storageProvider: 'DRIVE',
          uploadedBy: session.user.nombre ?? session.user.email ?? 'Desconocido',
        },
        select: {
          id: true,
          nombre: true,
          url: true,
          tipo: true,
          tamanio: true,
          createdAt: true,
          driveUrl: true,
          storageProvider: true,
        },
      });

      archivosCreados.push(archivo);
    }

    if (archivosCreados.length > 0) {
      registrarAuditoria({
        presupuestoId: params.id,
        usuarioId: session.user.id,
        accion: 'ADJUNTO_SUBIDO',
        camposModificados: {
          archivos: archivosCreados.map((a) => a.nombre),
          storageProvider: 'DRIVE',
        },
      });
    }

    return NextResponse.json({ archivos: archivosCreados });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al subir archivo';
    console.error('[ADJUNTOS]', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
