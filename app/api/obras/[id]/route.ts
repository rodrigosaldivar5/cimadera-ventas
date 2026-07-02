import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, razonSocial: true } },
      _count:  { select: { presupuestos: true, cuentasCorrientes: true } },
    },
  });

  if (!obra) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  return NextResponse.json(obra);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { nombre, codigoObra, direccion, descripcion, clienteId, activo } = body;

  const obraActual = await prisma.obra.findUnique({
    where: { id: params.id },
    include: { _count: { select: { presupuestos: true } } },
  });
  if (!obraActual) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  if (clienteId !== undefined && clienteId !== obraActual.clienteId) {
    if (obraActual._count.presupuestos > 0) {
      return NextResponse.json(
        {
          error: `No se puede cambiar el cliente: la obra tiene ${obraActual._count.presupuestos} presupuesto(s) vinculado(s)`,
        },
        { status: 422 }
      );
    }
  }

  if (codigoObra?.trim() && codigoObra.trim() !== obraActual.codigoObra) {
    const dup = await prisma.obra.findFirst({
      where: { codigoObra: codigoObra.trim(), id: { not: params.id } },
      select: { id: true },
    });
    if (dup)
      return NextResponse.json({ error: 'El código de obra ya está en uso' }, { status: 409 });
  }

  const data: Record<string, unknown> = {};
  if (nombre?.trim())          data.nombre      = nombre.trim();
  if (codigoObra !== undefined) data.codigoObra  = codigoObra?.trim()   || null;
  if (direccion !== undefined)  data.direccion   = direccion?.trim()    || null;
  if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null;
  if (clienteId !== undefined && obraActual._count.presupuestos === 0)
    data.clienteId = clienteId;
  if (activo !== undefined)     data.activo      = Boolean(activo);

  const obra = await prisma.obra.update({
    where: { id: params.id },
    data,
    include: {
      cliente: { select: { id: true, razonSocial: true } },
      _count:  { select: { presupuestos: true, cuentasCorrientes: true } },
    },
  });

  return NextResponse.json(obra);
}
