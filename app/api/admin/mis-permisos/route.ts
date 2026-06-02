import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PERMISOS_CONFIG } from '@/lib/permisos-config';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rolId: true, rol: { select: { nombre: true } } },
  });

  const rolNombre = user?.rol?.nombre ?? null;

  if (!user?.rolId) {
    const permisos: Record<string, Record<string, boolean>> = {};
    for (const [modulo, config] of Object.entries(PERMISOS_CONFIG)) {
      permisos[modulo] = {};
      for (const accion of config.acciones) {
        permisos[modulo][accion.key] = true;
      }
    }
    return NextResponse.json({ permisos, rolNombre });
  }

  const permisosRol = await prisma.permisoRol.findMany({
    where: { rolId: user.rolId },
  });

  const permisos: Record<string, Record<string, boolean>> = {};
  for (const p of permisosRol) {
    if (!permisos[p.modulo]) permisos[p.modulo] = {};
    permisos[p.modulo][p.accion] = p.permitido;
  }

  for (const [modulo, config] of Object.entries(PERMISOS_CONFIG)) {
    if (!permisos[modulo]) permisos[modulo] = {};
    for (const accion of config.acciones) {
      if (permisos[modulo][accion.key] === undefined) {
        permisos[modulo][accion.key] = false;
      }
    }
  }

  return NextResponse.json({ permisos, rolNombre });
}
