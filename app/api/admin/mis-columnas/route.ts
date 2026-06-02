import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISOS_CONFIG, type ModuloPermiso } from '@/lib/permisos-config';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const modulo = searchParams.get('modulo') as ModuloPermiso | null;
  if (!modulo || !(modulo in PERMISOS_CONFIG)) {
    return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rolId: true },
  });

  if (!user?.rolId) {
    // No role: return all columns visible by default
    const columnas = PERMISOS_CONFIG[modulo].columnas.map((c) => c.key);
    return NextResponse.json({ columnas });
  }

  const visibilidad = await prisma.visibilidadColumna.findMany({
    where: { rolId: user.rolId, modulo },
  });

  if (visibilidad.length === 0) {
    // No config for this role+module: return all columns
    const columnas = PERMISOS_CONFIG[modulo].columnas.map((c) => c.key);
    return NextResponse.json({ columnas });
  }

  const columnas = visibilidad.filter((v) => v.visible).map((v) => v.columna);
  return NextResponse.json({ columnas });
}
