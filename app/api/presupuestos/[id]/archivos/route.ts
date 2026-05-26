import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
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

    const uploadDir = path.join(process.cwd(), 'public', 'adjuntos', params.id);
    await mkdir(uploadDir, { recursive: true });

    const archivosCreados = [];
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) continue;
      if (file.size > MAX_SIZE) continue;

      const bytes = await file.arrayBuffer();
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${timestamp}-${safeName}`;
      await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

      const tipo = ext.replace('.', '');
      const archivo = await prisma.archivoPresupuesto.create({
        data: {
          presupuestoId: params.id,
          nombre: file.name,
          url: `/adjuntos/${params.id}/${filename}`,
          tipo,
          tamanio: file.size,
        },
      });
      archivosCreados.push(archivo);
    }

    return NextResponse.json({ archivos: archivosCreados });
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}
