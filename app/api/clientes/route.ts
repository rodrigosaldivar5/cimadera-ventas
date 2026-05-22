import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const all = searchParams.get('all') === 'true';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage = 10;

  if (all) {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { razonSocial: 'asc' },
      select: { id: true, razonSocial: true },
    });
    return NextResponse.json({ clientes });
  }

  const where = q
    ? {
        activo: true,
        OR: [
          { razonSocial: { contains: q, mode: 'insensitive' as const } },
          { cuit: { contains: q, mode: 'insensitive' as const } },
          { ciudad: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : { activo: true };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({ where, skip: (page - 1) * perPage, take: perPage, orderBy: { razonSocial: 'asc' } }),
    prisma.cliente.count({ where }),
  ]);

  return NextResponse.json({ clientes, total, page, perPage });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const cliente = await prisma.cliente.create({
      data: {
        razonSocial: data.razonSocial,
        cuit: data.cuit || null,
        email: data.email || null,
        telefono: data.telefono || null,
        direccion: data.direccion || null,
        ciudad: data.ciudad || null,
        provincia: data.provincia || null,
        tipoCliente: data.tipoCliente || 'PARTICULAR',
      },
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
