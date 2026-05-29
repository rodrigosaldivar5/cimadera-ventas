import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type ImportItem = {
  nombre: string;
  categoria: string;
  moneda: string;
  montoMensual: number;
  observacion: string | null;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { items }: { items: ImportItem[] } = await req.json();
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Sin items' }, { status: 400 });
  }

  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (const item of items) {
    try {
      // Find or create category (case-insensitive)
      let cat = await prisma.categoriaCostoFijo.findFirst({
        where: { nombre: { equals: item.categoria, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await prisma.categoriaCostoFijo.create({
          data: { nombre: item.categoria },
        });
      }

      // Upsert by nombre + categoria (case-insensitive match)
      const existing = await prisma.costoFijo.findFirst({
        where: {
          nombre: { equals: item.nombre, mode: 'insensitive' },
          categoria: { equals: cat.nombre, mode: 'insensitive' },
          activo: true,
        },
      });

      if (existing) {
        await prisma.costoFijo.update({
          where: { id: existing.id },
          data: {
            moneda: item.moneda,
            monto: item.montoMensual,
            observacion: item.observacion,
          },
        });
        actualizados++;
      } else {
        await prisma.costoFijo.create({
          data: {
            nombre: item.nombre,
            categoria: cat.nombre,
            moneda: item.moneda,
            monto: item.montoMensual,
            observacion: item.observacion,
            activo: true,
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
