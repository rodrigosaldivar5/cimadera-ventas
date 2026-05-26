import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; archivoId: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const archivo = await prisma.archivoPresupuesto.findUnique({ where: { id: params.archivoId } });
  if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try {
    await unlink(path.join(process.cwd(), 'public', archivo.url));
  } catch {
    // file may not exist on disk
  }

  await prisma.archivoPresupuesto.delete({ where: { id: params.archivoId } });
  return NextResponse.json({ ok: true });
}
