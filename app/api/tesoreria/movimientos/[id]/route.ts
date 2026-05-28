import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const movimiento = await prisma.movimientoTesoreria.findUnique({ where: { id: params.id } });
  if (!movimiento) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  if (['TRASPASO_ENTRADA', 'TRASPASO_SALIDA'].includes(movimiento.tipo))
    return NextResponse.json({ error: 'No se pueden eliminar movimientos de traspaso' }, { status: 400 });

  await prisma.movimientoTesoreria.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
