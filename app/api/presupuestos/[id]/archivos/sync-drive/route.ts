import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildPresupuestoFolderName,
  getOrCreatePresupuestoAdjuntosFolder,
  listFolderFiles,
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

    const driveFiles = await listFolderFiles(folderId);

    const existentes = await prisma.archivoPresupuesto.findMany({
      where: { presupuestoId: params.id },
      select: { driveFileId: true },
    });

    const registeredIds = new Set(existentes.map((a) => a.driveFileId).filter(Boolean));

    const huerfanos = driveFiles.filter((f) => !registeredIds.has(f.id));

    let creados = 0;
    for (const f of huerfanos) {
      const lastDot = f.name.lastIndexOf('.');
      const tipo = lastDot >= 0 ? f.name.slice(lastDot + 1).toLowerCase() : 'unknown';

      await prisma.archivoPresupuesto.create({
        data: {
          presupuestoId: params.id,
          nombre: f.name,
          url: f.webViewLink,
          tipo,
          tamanio: f.size,
          driveFileId: f.id,
          driveUrl: f.webViewLink,
          driveFolderId: folderId,
          storageProvider: 'DRIVE',
          uploadedBy: session.user.nombre ?? session.user.email ?? 'sync-drive',
        },
      });
      creados++;
    }

    console.log(
      '[SYNC-DRIVE]',
      'presupuestoId:', params.id,
      'driveFiles:', driveFiles.length,
      'registrados:', registeredIds.size,
      'creados:', creados,
    );

    return NextResponse.json({
      ok: true,
      creados,
      existentes: registeredIds.size,
      totalDrive: driveFiles.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error al sincronizar';
    console.error('[SYNC-DRIVE] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
