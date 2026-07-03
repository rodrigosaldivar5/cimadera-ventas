import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import { trashDriveFile } from '@/lib/integrations/google-drive';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; archivoId: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const archivo = await prisma.archivoPresupuesto.findUnique({
    where: { id: params.archivoId },
    select: { id: true, nombre: true, driveFileId: true, storageProvider: true },
  });
  if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  // Mover a papelera en Drive si aplica (fire-and-forget — no bloquea el delete de DB)
  if (archivo.driveFileId) {
    trashDriveFile(archivo.driveFileId).catch((err) => {
      console.error('[ADJUNTOS] No se pudo mover a papelera en Drive:', err instanceof Error ? err.message : err);
    });
  }

  await prisma.archivoPresupuesto.delete({ where: { id: params.archivoId } });

  registrarAuditoria({
    presupuestoId: params.id,
    usuarioId: session.user.id,
    accion: 'ADJUNTO_ELIMINADO',
    camposModificados: {
      nombre: archivo.nombre,
      storageProvider: archivo.storageProvider ?? 'DB',
      driveFileId: archivo.driveFileId ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
