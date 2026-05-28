import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.valorEstimado !== undefined) data.valorEstimado = parseFloat(body.valorEstimado);
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.observaciones !== undefined) data.observaciones = body.observaciones;

    const canje = await prisma.activoCanje.update({ where: { id: params.id }, data });

    return NextResponse.json({
      ...canje,
      valorEntrada: parseFloat(canje.valorEntrada.toString()),
      valorEstimado: parseFloat(canje.valorEstimado.toString()),
      valorVenta: canje.valorVenta ? parseFloat(canje.valorVenta.toString()) : null,
      gananciaUSD: canje.gananciaUSD ? parseFloat(canje.gananciaUSD.toString()) : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al actualizar canje' }, { status: 500 });
  }
}
