export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEstadosMiTrabajoForUser, getPerfilMiTrabajo, getFechaKeyArgentina } from '@/lib/mi-trabajo';
import { MiTrabajoContent } from '@/components/presupuestos/mi-trabajo-content';
import { redirect } from 'next/navigation';

export default async function MiTrabajoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user;
  const estados = getEstadosMiTrabajoForUser(user);
  const perfil = getPerfilMiTrabajo(user);
  const fechaKey = getFechaKeyArgentina();

  const [misPresupuestos, trabajoHoy, pendientesAnteriores] = await Promise.all([
    prisma.presupuesto.findMany({
      where: {
        estado: { in: estados },
        ...(perfil === 'vendedor' ? { responsableId: user.id } : {}),
      },
      orderBy: { fechaCreacion: 'desc' },
      select: {
        id: true,
        numero: true,
        nombrePresupuesto: true,
        estado: true,
        cliente: { select: { razonSocial: true } },
        obra: { select: { nombre: true } },
        responsable: { select: { nombre: true } },
        fechaCreacion: true,
      },
      take: 100,
    }),
    prisma.presupuestoTrabajoDia.findMany({
      where: { userId: user.id, fechaKey },
      orderBy: { orden: 'asc' },
      include: {
        presupuesto: {
          select: {
            id: true,
            numero: true,
            nombrePresupuesto: true,
            estado: true,
            cliente: { select: { razonSocial: true } },
            obra: { select: { nombre: true } },
          },
        },
      },
    }),
    prisma.presupuestoTrabajoDia.findMany({
      where: {
        userId: user.id,
        fechaKey: { lt: fechaKey },
        completado: false,
      },
      orderBy: [{ fechaKey: 'desc' }, { orden: 'asc' }],
      include: {
        presupuesto: {
          select: {
            id: true,
            numero: true,
            nombrePresupuesto: true,
            estado: true,
            cliente: { select: { razonSocial: true } },
            obra: { select: { nombre: true } },
          },
        },
      },
    }),
  ]);

  return (
    <MiTrabajoContent
      perfil={perfil}
      misPresupuestos={JSON.parse(JSON.stringify(misPresupuestos))}
      trabajoHoyInicial={JSON.parse(JSON.stringify(trabajoHoy))}
      pendientesAnterioresInicial={JSON.parse(JSON.stringify(pendientesAnteriores))}
      fechaKey={fechaKey}
    />
  );
}
