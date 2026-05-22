import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: {
      categoria: true,
      atributos: { include: { opciones: { where: { activo: true } } } },
    },
    orderBy: { nombre: 'asc' },
  });

  return NextResponse.json({ productos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, descripcion, categoriaId, atributos } = await req.json();

  const producto = await prisma.producto.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      categoriaId,
      atributos: {
        create: (atributos ?? []).map((a: { nombre: string; requerido: boolean; itemId?: string; opciones: { nombre: string; costoBase: number; indiceUtilidad: number; unidad: string }[] }) => ({
          nombre: a.nombre,
          requerido: a.requerido ?? true,
          itemId: a.itemId || null,
          opciones: {
            create: (a.opciones ?? []).map((o) => ({
              nombre: o.nombre,
              costoBase: o.costoBase,
              indiceUtilidad: o.indiceUtilidad ?? 1.30,
              precioVenta: Math.round(o.costoBase * (o.indiceUtilidad ?? 1.30)),
              unidad: o.unidad ?? 'unidad',
            })),
          },
        })),
      },
    },
    include: { categoria: true, atributos: { include: { opciones: true } } },
  });

  return NextResponse.json(producto, { status: 201 });
}
