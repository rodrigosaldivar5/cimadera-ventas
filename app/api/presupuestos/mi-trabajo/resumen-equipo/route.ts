import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageTeamWork, getFechaKeyArgentina } from '@/lib/mi-trabajo';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canManageTeamWork(session.user)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

  const fechaKey = getFechaKeyArgentina();

  const [presupuestos, trabajoHoy] = await Promise.all([
    prisma.presupuesto.groupBy({
      by: ['responsableId', 'estado'],
      _count: { id: true },
      where: {
        responsableId: { not: null },
        estado: { in: ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO'] },
      },
    }),
    prisma.presupuestoTrabajoDia.findMany({
      where: { fechaKey },
      select: { userId: true, completado: true },
    }),
  ]);

  const responsableIds = Array.from(new Set(presupuestos.map((p) => p.responsableId).filter(Boolean))) as string[];
  const trabajoUserIds = Array.from(new Set(trabajoHoy.map((t) => t.userId)));
  const allUserIds = Array.from(new Set([...responsableIds, ...trabajoUserIds]));

  const usuarios = await prisma.user.findMany({
    where: { id: { in: allUserIds }, aprobado: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  const resumen = usuarios.map((u) => {
    const counts: Record<string, number> = {};
    for (const row of presupuestos) {
      if (row.responsableId === u.id) {
        counts[row.estado] = (counts[row.estado] ?? 0) + row._count.id;
      }
    }
    const trabajoItems = trabajoHoy.filter((t) => t.userId === u.id);
    return {
      id: u.id,
      nombre: u.nombre,
      pendientes: counts['PENDIENTE'] ?? 0,
      enProceso: counts['EN_PROCESO'] ?? 0,
      frenados: counts['FRENADO'] ?? 0,
      finalizados: counts['FINALIZADO'] ?? 0,
      paraEnviar: counts['PARA_ENVIAR'] ?? 0,
      enviados: counts['ENVIADO'] ?? 0,
      abiertos: (counts['PENDIENTE'] ?? 0) + (counts['EN_PROCESO'] ?? 0) + (counts['FRENADO'] ?? 0)
        + (counts['FINALIZADO'] ?? 0) + (counts['PARA_ENVIAR'] ?? 0) + (counts['ENVIADO'] ?? 0),
      aTerminarHoy: trabajoItems.length,
      completadosHoy: trabajoItems.filter((t) => t.completado).length,
    };
  }).filter((u) => u.abiertos > 0 || u.aTerminarHoy > 0);

  return NextResponse.json(resumen);
}
