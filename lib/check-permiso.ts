import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export async function requirePermiso(modulo: string, accion: string, redirectTo = '/dashboard') {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { rolId: true },
  });

  if (!user?.rolId) return;

  const permiso = await prisma.permisoRol.findUnique({
    where: { rolId_modulo_accion: { rolId: user.rolId, modulo, accion } },
  });

  if (!permiso || !permiso.permitido) {
    redirect(redirectTo);
  }
}
