export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getEstadosMiTrabajoForUser,
  getPerfilMiTrabajo,
  getFechaKeyArgentina,
  canManageTeamWork,
} from '@/lib/mi-trabajo';
import { MiTrabajoContent } from '@/components/presupuestos/mi-trabajo-content';
import { redirect } from 'next/navigation';

export default async function MiTrabajoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user;
  const perfil = getPerfilMiTrabajo(user);
  const isManager = canManageTeamWork(user);
  const fechaKey = getFechaKeyArgentina();

  const estadosAbiertos: Array<'PENDIENTE' | 'EN_PROCESO' | 'FRENADO' | 'FINALIZADO' | 'PARA_ENVIAR' | 'ENVIADO'> =
    ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO'];

  const presupuestosWhere = isManager
    ? { estado: { in: estadosAbiertos } }
    : {
        estado: { in: getEstadosMiTrabajoForUser(user) },
        responsableId: perfil === 'vendedor' ? user.id : undefined,
      };

  const [presupuestos, responsables] = await Promise.all([
    prisma.presupuesto.findMany({
      where: presupuestosWhere,
      orderBy: { fechaCreacion: 'desc' },
      select: {
        id: true,
        numero: true,
        nombrePresupuesto: true,
        estado: true,
        prioridad: true,
        cliente: { select: { razonSocial: true } },
        obra: { select: { nombre: true } },
        responsable: { select: { id: true, nombre: true } },
        fechaCreacion: true,
        fechaVencimiento: true,
        rubros: true,
      },
      take: 300,
    }),
    isManager
      ? prisma.user.findMany({
          where: { aprobado: true },
          select: { id: true, nombre: true },
          orderBy: { nombre: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  return (
    <MiTrabajoContent
      perfil={perfil}
      isManager={isManager}
      presupuestos={JSON.parse(JSON.stringify(presupuestos))}
      responsables={responsables}
      fechaKey={fechaKey}
      userId={user.id}
    />
  );
}
