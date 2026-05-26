import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type FilaImport = {
  nombre: string;
  categoria: string;
  descripcion?: string;
  costoBase: number;
  indiceUtilidad: number;
  unidad: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { filas } = (await req.json()) as { filas: FilaImport[] };
  if (!Array.isArray(filas) || filas.length === 0)
    return NextResponse.json({ error: 'Sin datos' }, { status: 400 });

  let creados = 0;
  let actualizados = 0;

  for (const fila of filas) {
    let categoria = await prisma.categoriaItem.findFirst({ where: { nombre: fila.categoria } });
    if (!categoria) {
      categoria = await prisma.categoriaItem.create({ data: { nombre: fila.categoria } });
    }

    const precioVenta = parseFloat((fila.costoBase * fila.indiceUtilidad).toFixed(2));
    const existing = await prisma.item.findFirst({
      where: { nombre: fila.nombre, categoriaId: categoria.id },
    });

    if (existing) {
      await prisma.item.update({
        where: { id: existing.id },
        data: {
          descripcion: fila.descripcion ?? existing.descripcion,
          costoBase: fila.costoBase,
          indiceUtilidad: fila.indiceUtilidad,
          precioVenta,
          unidad: fila.unidad,
        },
      });
      actualizados++;
    } else {
      await prisma.item.create({
        data: {
          nombre: fila.nombre,
          descripcion: fila.descripcion ?? null,
          categoriaId: categoria.id,
          costoBase: fila.costoBase,
          indiceUtilidad: fila.indiceUtilidad,
          precioVenta,
          unidad: fila.unidad,
        },
      });
      creados++;
    }
  }

  return NextResponse.json({ creados, actualizados });
}
