import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enviarPush } from '@/lib/push';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userId = body.userId ?? session.user.id;

  await enviarPush(userId, {
    title: body.titulo ?? 'Test de notificación',
    body: body.mensaje ?? '✅ Las notificaciones push están funcionando correctamente.',
    url: body.url ?? '/dashboard',
  });

  return NextResponse.json({ success: true });
}
