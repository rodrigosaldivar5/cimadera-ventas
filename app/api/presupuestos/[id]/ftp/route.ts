import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import {
  buildFtpFileName,
  copyFtpTemplateForPresupuesto,
} from '@/lib/integrations/google-drive';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      numero: true,
      nombrePresupuesto: true,
      ftpDriveFileId: true,
      ftpDriveUrl: true,
      ftpNombreArchivo: true,
      cliente: { select: { razonSocial: true } },
      obra: { select: { nombre: true } },
    },
  });

  if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

  // Si ya existe FTP, devolver sin crear otro
  if (presupuesto.ftpDriveFileId && presupuesto.ftpDriveUrl) {
    return NextResponse.json({
      ok: true,
      created: false,
      url: presupuesto.ftpDriveUrl,
      fileId: presupuesto.ftpDriveFileId,
      nombre: presupuesto.ftpNombreArchivo,
    });
  }

  // Validar variables de entorno antes de llamar a Drive
  if (!process.env.GOOGLE_CLIENT_EMAIL) {
    return NextResponse.json({ error: 'Falta configurar: GOOGLE_CLIENT_EMAIL' }, { status: 500 });
  }
  if (!process.env.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Falta configurar: GOOGLE_PRIVATE_KEY' }, { status: 500 });
  }
  if (!process.env.GOOGLE_DRIVE_FTP_FOLDER_ID) {
    return NextResponse.json({ error: 'Falta configurar: GOOGLE_DRIVE_FTP_FOLDER_ID' }, { status: 500 });
  }

  try {
    const nombre = buildFtpFileName({
      numero: presupuesto.numero,
      obraNombre: presupuesto.obra?.nombre,
      clienteNombre: presupuesto.cliente?.razonSocial,
      presupuestoNombre: presupuesto.nombrePresupuesto,
    });

    const { fileId, url } = await copyFtpTemplateForPresupuesto({ nombre });

    const now = new Date();
    await prisma.presupuesto.update({
      where: { id: params.id },
      data: {
        ftpDriveFileId: fileId,
        ftpDriveUrl: url,
        ftpNombreArchivo: nombre,
        ftpCreatedAt: now,
        ftpUpdatedAt: now,
        ftpCreatedBy: session.user.nombre ?? session.user.email ?? 'Desconocido',
      },
    });

    registrarAuditoria({
      presupuestoId: params.id,
      usuarioId: session.user.id,
      accion: 'FTP_GENERADA',
      camposModificados: { fileId, nombreArchivo: nombre },
    });

    return NextResponse.json({ ok: true, created: true, url, fileId, nombre });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error al generar la FTP en Google Drive';
    console.error('[FTP]', mensaje);
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
