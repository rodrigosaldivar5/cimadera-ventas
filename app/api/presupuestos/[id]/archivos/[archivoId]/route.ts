import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; archivoId: string } },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const archivo = await prisma.archivoPresupuesto.findUnique({ where: { id: params.archivoId } });
  if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await prisma.archivoPresupuesto.delete({ where: { id: params.archivoId } });
  return NextResponse.json({ success: true });
}
