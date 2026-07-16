import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  buildPresupuestoFolderName,
  getOrCreatePresupuestoAdjuntosFolder,
  verifyDriveFile,
} from '@/lib/integrations/google-drive';

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

  try {
    const body = (await req.json()) as {
      driveFileId?: string;
      nombre?: string;
      tipo?: string;
      tamano?: number;
    };
    const { driveFileId, nombre, tipo, tamano } = body;

    if (!driveFileId || !nombre || !tipo || !tamano) {
      return NextResponse.json({ error: 'Faltan datos del archivo' }, { status: 400 });
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

    const expectedFolderId = await getOrCreatePresupuestoAdjuntosFolder({
      parentFolderId: adjuntosFolderId,
      folderName,
    });

    let driveFile;
    try {
      driveFile = await verifyDriveFile(driveFileId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[CONFIRM-UPLOAD] No se pudo verificar driveFileId:', driveFileId, msg);
      return NextResponse.json(
        { error: 'No se pudo verificar el archivo en Google Drive' },
        { status: 400 },
      );
    }

    if (!driveFile.parents.includes(expectedFolderId)) {
      console.error(
        '[CONFIRM-UPLOAD] Parent mismatch:',
        'driveFileId:', driveFileId,
        'parents:', driveFile.parents,
        'expected:', expectedFolderId,
      );
      return NextResponse.json(
        { error: 'El archivo no pertenece a la carpeta del presupuesto' },
        { status: 403 },
      );
    }

    const sizeDiff = Math.abs(driveFile.size - tamano);
    if (sizeDiff > tamano * 0.1 && sizeDiff > 1024) {
      console.warn(
        '[CONFIRM-UPLOAD] Size mismatch:',
        'driveSize:', driveFile.size,
        'expected:', tamano,
        'diff:', sizeDiff,
      );
    }

    const driveUrl = driveFile.webViewLink;

    const archivo = await prisma.archivoPresupuesto.create({
      data: {
        presupuestoId: params.id,
        nombre,
        url: driveUrl,
        tipo,
        tamanio: tamano,
        driveFileId,
        driveUrl,
        driveFolderId: expectedFolderId,
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

    console.log('[CONFIRM-UPLOAD] OK:', 'presupuestoId:', params.id, 'archivo:', nombre, 'driveFileId:', driveFileId);

    registrarAuditoria({
      presupuestoId: params.id,
      usuarioId: session.user.id,
      accion: 'ADJUNTO_SUBIDO',
      camposModificados: {
        archivos: [nombre],
        storageProvider: 'DRIVE',
      },
    });

    return NextResponse.json({ ok: true, archivo });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al confirmar upload';
    console.error('[CONFIRM-UPLOAD] Error:', msg);
    return NextResponse.json(
      { error: 'El archivo se subió a Drive pero no se pudo registrar en la app. Abrí la carpeta de Drive o reintentá.' },
      { status: 500 },
    );
  }
}
