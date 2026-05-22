import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  console.log('[API] GET /api/productos/:id →', params.id);

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    include: {
      categoria: true,
      atributos: {
        include: { opciones: { where: { activo: true } } },
      },
    },
  });

  if (!producto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  console.log('[API] producto:', producto.nombre, '| atributos:', producto.atributos.length, '| opciones por atributo:', producto.atributos.map((a) => a.opciones.length));

  return NextResponse.json(producto);
}
