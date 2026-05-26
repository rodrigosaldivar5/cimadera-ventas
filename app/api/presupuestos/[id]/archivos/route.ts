import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import path from 'path';

const ALLOWED_EXTS = ['.pdf', '.xml', '.xlsx', '.xls', '.doc', '.docx'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const archivos = await prisma.archivoPresupuesto.findMany({
      where: { presupuestoId: params.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombre: true, url: true, tipo: true, tamanio: true, createdAt: true },
    });
    return NextResponse.json(archivos);
  } catch {
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0)
      return NextResponse.json({ error: 'No se recibieron archivos' }, { status: 400 });

    const archivosCreados = [];
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) continue;
      if (file.size > MAX_SIZE) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tipo = ext.replace('.', '');

      const archivo = await prisma.archivoPresupuesto.create({
        data: {
          presupuestoId: params.id,
          nombre: file.name,
          url: '', // se actualiza abajo con el id generado
          tipo,
          tamanio: file.size,
          contenido: buffer,
        },
      });

      // La URL apunta a la ruta de descarga usando el id real
      const url = `/api/presupuestos/${params.id}/archivos/${archivo.id}/download`;
      const actualizado = await prisma.archivoPresupuesto.update({
        where: { id: archivo.id },
        data: { url },
        select: { id: true, nombre: true, url: true, tipo: true, tamanio: true, createdAt: true },
      });

      archivosCreados.push(actualizado);
    }

    return NextResponse.json({ archivos: archivosCreados });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}
