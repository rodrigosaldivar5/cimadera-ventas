import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { rolId, modulo, campo, valor } = await req.json();

  // Buscar permiso existente para este rol+módulo, o crearlo
  const existing = await prisma.permisoRol.findFirst({ where: { rolId, modulo } });

  if (existing) {
    const permiso = await prisma.permisoRol.update({
      where: { id: existing.id },
      data: { [campo]: valor },
    });
    return NextResponse.json(permiso);
  } else {
    const permiso = await prisma.permisoRol.create({
      data: {
        rolId,
        modulo,
        puede_ver: campo === 'puede_ver' ? valor : false,
        puede_crear: campo === 'puede_crear' ? valor : false,
        puede_editar: campo === 'puede_editar' ? valor : false,
        puede_eliminar: campo === 'puede_eliminar' ? valor : false,
      },
    });
    return NextResponse.json(permiso);
  }
}
