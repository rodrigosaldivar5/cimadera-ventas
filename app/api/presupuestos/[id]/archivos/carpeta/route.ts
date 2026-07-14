import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildPresupuestoFolderName,
  getOrCreatePresupuestoAdjuntosFolder,
} from '@/lib/integrations/google-drive';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
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
        obra:    { select: { nombre: true } },
        cliente: { select: { razonSocial: true } },
      },
    });
    if (!presupuesto) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const folderName = buildPresupuestoFolderName({
      numero:            presupuesto.numero,
      obraNombre:        presupuesto.obra?.nombre,
      clienteNombre:     presupuesto.cliente?.razonSocial,
      presupuestoNombre: presupuesto.nombrePresupuesto,
    });

    const folderId = await getOrCreatePresupuestoAdjuntosFolder({
      parentFolderId: adjuntosFolderId,
      folderName,
    });

    return NextResponse.json({
      ok: true,
      folderId,
      url: `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (error) {
    console.error('[CARPETA_DRIVE]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'No se pudo acceder a la carpeta de Drive' },
      { status: 500 },
    );
  }
}
