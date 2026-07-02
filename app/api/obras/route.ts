import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q              = searchParams.get('q') ?? '';
  const clienteId      = searchParams.get('clienteId') ?? '';
  const soloArchivadas = searchParams.get('activo') === 'false';
  const page           = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage        = 20;

  const where: Record<string, unknown> = {
    activo: soloArchivadas ? false : true,
  };
  if (clienteId) where.clienteId = clienteId;
  if (q) {
    where.OR = [
      { nombre:    { contains: q, mode: 'insensitive' } },
      { direccion: { contains: q, mode: 'insensitive' } },
      { cliente:   { razonSocial: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [total, obras] = await Promise.all([
    prisma.obra.count({ where }),
    prisma.obra.findMany({
      where,
      include: {
        cliente: { select: { id: true, razonSocial: true } },
        _count:  { select: { presupuestos: true, cuentasCorrientes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json({ obras, total, page, perPage });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { nombre, clienteId, codigoObra, direccion, descripcion } = body;

  if (!nombre?.trim())
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  if (!clienteId)
    return NextResponse.json({ error: 'El cliente es requerido' }, { status: 400 });

  const clienteExiste = await prisma.cliente.findUnique({
    where: { id: clienteId }, select: { id: true },
  });
  if (!clienteExiste)
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  if (codigoObra?.trim()) {
    const dup = await prisma.obra.findUnique({
      where: { codigoObra: codigoObra.trim() }, select: { id: true },
    });
    if (dup)
      return NextResponse.json({ error: 'El código de obra ya está en uso' }, { status: 409 });
  }

  const obra = await prisma.obra.create({
    data: {
      nombre:      nombre.trim(),
      clienteId,
      codigoObra:  codigoObra?.trim()   || null,
      direccion:   direccion?.trim()    || null,
      descripcion: descripcion?.trim()  || null,
    },
    include: {
      cliente: { select: { id: true, razonSocial: true } },
      _count:  { select: { presupuestos: true, cuentasCorrientes: true } },
    },
  });

  return NextResponse.json(obra, { status: 201 });
}
