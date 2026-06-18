import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ADMIN_EMAILS = ['coordinacion.general@cimadera.net', 'admin@cimadera.net'];

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, nombre: true, email: true },
    });

    if (!user) return NextResponse.json({ success: true });

    const pendiente = await prisma.solicitudRestablecimiento.findFirst({
      where: { userId: user.id, estado: 'PENDIENTE' },
    });

    if (pendiente) return NextResponse.json({ success: true });

    await prisma.solicitudRestablecimiento.create({
      data: { userId: user.id },
    });

    try {
      const { crearYEnviarNotificacion } = await import('@/lib/notificaciones');
      const admins = await prisma.user.findMany({
        where: { email: { in: ADMIN_EMAILS }, aprobado: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await crearYEnviarNotificacion(admin.id, {
          titulo: 'Solicitud de restablecimiento',
          mensaje: `${user.nombre} (${user.email}) solicita restablecer su contraseña`,
          tipo: 'solicitud_restablecimiento',
          linkUrl: '/admin/usuarios',
        });
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error al procesar solicitud' }, { status: 500 });
  }
}
