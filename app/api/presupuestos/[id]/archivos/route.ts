import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const archivos = await prisma.archivoPresupuesto.findMany({
    where: { presupuestoId: params.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(archivos);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) return NextResponse.json({ error: 'No hay archivos' }, { status: 400 });

  const uploadDir = path.join(process.cwd(), 'public', 'adjuntos', params.id);
  await mkdir(uploadDir, { recursive: true });

  const created = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}_${safeName}`;
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const tipo =
      ext === 'pdf' ? 'pdf'
      : ['doc', 'docx'].includes(ext) ? 'word'
      : ['xls', 'xlsx'].includes(ext) ? 'excel'
      : ext === 'xml' ? 'xml'
      : 'otro';

    const archivo = await prisma.archivoPresupuesto.create({
      data: {
        presupuestoId: params.id,
        nombre: file.name,
        url: `/adjuntos/${params.id}/${filename}`,
        tipo,
        tamanio: file.size,
      },
    });
    created.push(archivo);
  }

  return NextResponse.json(created);
}
