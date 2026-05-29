import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type ImportItem = {
  mes?: number;
  anio?: number;
  nombre: string;
  categoria: string;
  moneda: string;
  montoEstimado?: number | null;
  montoReal?: number | null;
  observacion: string | null;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { items }: { items: ImportItem[] } = await req.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Sin items' }, { status: 400 });
  }

  const now = new Date();
  let creados = 0, actualizados = 0, errores = 0;

  for (const item of items) {
    try {
      const mes = item.mes ?? now.getMonth() + 1;
      const anio = item.anio ?? now.getFullYear();

      let cat = await prisma.categoriaCostoFijo.findFirst({
        where: { nombre: { equals: item.categoria, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await prisma.categoriaCostoFijo.create({ data: { nombre: item.categoria } });
      }

      let costo = await prisma.costoFijo.findFirst({
        where: {
          nombre: { equals: item.nombre, mode: 'insensitive' },
          categoriaId: cat.id,
          activo: true,
        },
      });

      if (!costo) {
        costo = await prisma.costoFijo.create({
          data: {
            nombre: item.nombre,
            categoria: cat.nombre,
            categoriaId: cat.id,
            moneda: item.moneda,
            observacion: item.observacion,
            monto: 0,
          },
        });
      }

      const existing = await prisma.registroCostoFijo.findFirst({
        where: { costoFijoId: costo.id, mes, anio },
      });

      if (existing) {
        await prisma.registroCostoFijo.update({
          where: { id: existing.id },
          data: {
            ...(item.montoEstimado !== undefined && { montoEstimado: item.montoEstimado }),
            ...(item.montoReal !== undefined && { montoReal: item.montoReal }),
            observacion: item.observacion,
          },
        });
        actualizados++;
      } else {
        await prisma.registroCostoFijo.create({
          data: {
            costoFijoId: costo.id,
            mes,
            anio,
            montoEstimado: item.montoEstimado ?? null,
            montoReal: item.montoReal ?? null,
            observacion: item.observacion,
          },
        });
        creados++;
      }
    } catch {
      errores++;
    }
  }

  return NextResponse.json({ creados, actualizados, errores });
}
