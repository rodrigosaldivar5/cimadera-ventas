import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get('mes') ?? String(new Date().getMonth() + 1));
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()));

  const costos = await prisma.costoFijo.findMany({
    where: { activo: true },
    orderBy: { categoria: 'asc' },
    include: {
      registros: { where: { mes, anio } },
      categoriaRel: true,
    },
  });

  return NextResponse.json(costos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    categoria: c.categoria,
    categoriaId: c.categoriaId,
    moneda: c.moneda,
    observacion: c.observacion,
    registro: c.registros[0] ? {
      id: c.registros[0].id,
      montoEstimado: c.registros[0].montoEstimado ? Number(c.registros[0].montoEstimado) : null,
      montoReal: c.registros[0].montoReal ? Number(c.registros[0].montoReal) : null,
      observacion: c.registros[0].observacion,
    } : null,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { nombre, categoria, moneda, observacion, monto, tipoMonto, mes, anio } = await req.json();
  if (!nombre || !categoria) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const now = new Date();
  const mesActual = mes ?? now.getMonth() + 1;
  const anioActual = anio ?? now.getFullYear();

  let cat = await prisma.categoriaCostoFijo.findFirst({
    where: { nombre: { equals: categoria, mode: 'insensitive' } },
  });
  if (!cat) {
    cat = await prisma.categoriaCostoFijo.create({ data: { nombre: categoria } });
  }

  const costo = await prisma.costoFijo.create({
    data: {
      nombre,
      categoria: cat.nombre,
      categoriaId: cat.id,
      moneda: moneda ?? 'ARS',
      monto: Number(monto ?? 0),
      observacion: observacion || null,
    },
  });

  let registro = null;
  if (monto) {
    const data: Record<string, unknown> = { costoFijoId: costo.id, mes: mesActual, anio: anioActual };
    if (tipoMonto === 'estimado') data.montoEstimado = Number(monto);
    else data.montoReal = Number(monto);
    registro = await prisma.registroCostoFijo.create({ data: data as Parameters<typeof prisma.registroCostoFijo.create>[0]['data'] });
  }

  return NextResponse.json({ ...costo, registro }, { status: 201 });
}
