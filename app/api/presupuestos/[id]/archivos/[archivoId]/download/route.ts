import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; archivoId: string } },
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('No autorizado', { status: 401 });

  const archivo = await prisma.archivoPresupuesto.findUnique({
    where: { id: params.archivoId },
  });

  if (!archivo || !archivo.contenido)
    return new NextResponse('No encontrado', { status: 404 });

  return new NextResponse(archivo.contenido, {
    headers: {
      'Content-Type': MIME[archivo.tipo] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(archivo.nombre)}"`,
      'Content-Length': String(archivo.tamanio),
    },
  });
}
