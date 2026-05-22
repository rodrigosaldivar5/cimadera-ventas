import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    include: {
      categoria: true,
      atributos: {
        orderBy: { nombre: 'asc' },
        include: { opciones: { where: { activo: true }, orderBy: { nombre: 'asc' } } },
      },
    },
  });

  if (!producto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json(producto);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const data = await req.json();

  type OpcionInput = { nombre: string; costoBase: number; indiceUtilidad: number; unidad: string };
  type AtributoInput = { nombre: string; requerido: boolean; opciones: OpcionInput[] };

  await prisma.$transaction(async (tx) => {
    await tx.producto.update({
      where: { id: params.id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        categoriaId: data.categoriaId,
      },
    });

    // Delete existing atributos (cascades opciones)
    await tx.atributoProducto.deleteMany({ where: { productoId: params.id } });

    // Recreate atributos + opciones
    for (const a of (data.atributos ?? []) as AtributoInput[]) {
      await tx.atributoProducto.create({
        data: {
          productoId: params.id,
          nombre: a.nombre,
          requerido: a.requerido,
          opciones: {
            create: a.opciones.map((o) => ({
              nombre: o.nombre,
              costoBase: o.costoBase,
              indiceUtilidad: o.indiceUtilidad,
              precioVenta: Math.round(o.costoBase * o.indiceUtilidad),
              unidad: o.unidad,
            })),
          },
        },
      });
    }
  });

  const updated = await prisma.producto.findUnique({
    where: { id: params.id },
    include: { categoria: true, atributos: { include: { opciones: true } } },
  });

  return NextResponse.json(updated);
}
