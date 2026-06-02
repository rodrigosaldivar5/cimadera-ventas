import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rolId = searchParams.get('rolId');
  if (!rolId) return NextResponse.json({ error: 'rolId requerido' }, { status: 400 });

  const [permisos, columnas] = await Promise.all([
    prisma.permisoRol.findMany({ where: { rolId } }),
    prisma.visibilidadColumna.findMany({ where: { rolId } }),
  ]);

  return NextResponse.json({ permisos, columnas });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { rolId, modulo, accion, permitido, columna, visible } = await req.json();

  // Column visibility update
  if (columna !== undefined) {
    const col = await prisma.visibilidadColumna.upsert({
      where: { rolId_modulo_columna: { rolId, modulo, columna } },
      update: { visible: !!visible },
      create: { rolId, modulo, columna, visible: !!visible },
    });
    return NextResponse.json(col);
  }

  // Action permission update
  const permiso = await prisma.permisoRol.upsert({
    where: { rolId_modulo_accion: { rolId, modulo, accion } },
    update: { permitido: !!permitido },
    create: { rolId, modulo, accion, permitido: !!permitido },
  });
  return NextResponse.json(permiso);
}
