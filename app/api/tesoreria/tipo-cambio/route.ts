import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const tc = await prisma.tipoCambio.findFirst({ orderBy: { fecha: 'desc' } });
  if (!tc) return NextResponse.json(null);

  return NextResponse.json({ ...tc, valor: parseFloat(tc.valor.toString()) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const { valor } = await req.json();
    const tc = await prisma.tipoCambio.create({
      data: {
        valor: parseFloat(valor),
        creadoPor: session.user.email ?? session.user.id,
      },
    });
    return NextResponse.json({ ...tc, valor: parseFloat(tc.valor.toString()) }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al actualizar tipo de cambio' }, { status: 500 });
  }
}
