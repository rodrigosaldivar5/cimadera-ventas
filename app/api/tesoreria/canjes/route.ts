import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTesoreriaAuthorized } from '@/lib/tesoreria';

const serialize = (c: Awaited<ReturnType<typeof prisma.activoCanje.findFirst>>) => {
  if (!c) return null;
  return {
    ...c,
    valorEntrada: parseFloat(c.valorEntrada.toString()),
    valorEstimado: parseFloat(c.valorEstimado.toString()),
    valorVenta: c.valorVenta ? parseFloat(c.valorVenta.toString()) : null,
    gananciaUSD: c.gananciaUSD ? parseFloat(c.gananciaUSD.toString()) : null,
  };
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const canjes = await prisma.activoCanje.findMany({ orderBy: { fechaRecepcion: 'desc' } });
  return NextResponse.json(canjes.map((c) => serialize(c)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const { nombre, tipo, descripcion, fechaRecepcion, valorEntrada, valorEstimado, observaciones } = await req.json();
    const veNum = parseFloat(valorEntrada);
    const canje = await prisma.activoCanje.create({
      data: {
        nombre,
        tipo,
        descripcion: descripcion || null,
        fechaRecepcion: new Date(fechaRecepcion),
        valorEntrada: veNum,
        valorEstimado: valorEstimado !== undefined ? parseFloat(valorEstimado) : veNum,
        observaciones: observaciones || null,
      },
    });
    return NextResponse.json(serialize(canje), { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear canje' }, { status: 500 });
  }
}
