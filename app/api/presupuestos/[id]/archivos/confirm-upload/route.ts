import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import { verifyDriveFile } from '@/lib/integrations/google-drive';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = (await req.json()) as {
      driveFileId?: string;
      nombre?: string;
      tipo?: string;
      tamano?: number;
      folderId?: string;
    };
    const { driveFileId, nombre, tipo, tamano, folderId } = body;

    if (!driveFileId || !nombre || !tipo || !tamano || !folderId) {
      return NextResponse.json({ error: 'Faltan datos del archivo' }, { status: 400 });
    }

    const presupuesto = await prisma.presupuesto.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const driveFile = await verifyDriveFile(driveFileId);

    if (!driveFile.parents.includes(folderId)) {
      return NextResponse.json(
        { error: 'El archivo no pertenece a la carpeta del presupuesto' },
        { status: 403 },
      );
    }

    const sizeDiff = Math.abs(driveFile.size - tamano);
    if (sizeDiff > tamano * 0.1 && sizeDiff > 1024) {
      return NextResponse.json(
        { error: 'El tamaño del archivo no coincide con lo esperado' },
        { status: 400 },
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
        driveFolderId: folderId,
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
    console.error('[CONFIRM-UPLOAD]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
