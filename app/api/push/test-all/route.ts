import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { enviarPush } from '@/lib/push';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const resultados: { tipo: string; ok: boolean; error?: string }[] = [];

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subs.length === 0) {
    return NextResponse.json(
      { error: 'No tenés suscripciones push activas. Activá las notificaciones primero.', suscripciones: 0 },
      { status: 400 }
    );
  }

  // Test 1: Push directo
  try {
    await enviarPush(session.user.id, {
      title: '🔔 Test 1: Push directo',
      body: 'Este es un test de envío directo',
      url: '/dashboard',
      tag: 'test-directo-' + Date.now(),
    });
    resultados.push({ tipo: 'push_directo', ok: true });
  } catch (e: unknown) {
    resultados.push({ tipo: 'push_directo', ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  // Test 2: presupuesto_asignado
  try {
    const { enviarNotificacion } = await import('@/lib/notificaciones');
    await enviarNotificacion({
      evento: 'presupuesto_asignado',
      userId: session.user.id,
      titulo: '📋 Test: Presupuesto asignado',
      mensaje: 'Test — Se te asignó el presupuesto #9999',
      linkUrl: '/presupuestos',
    });
    resultados.push({ tipo: 'presupuesto_asignado', ok: true });
  } catch (e: unknown) {
    resultados.push({ tipo: 'presupuesto_asignado', ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  // Test 3: alta_prioridad
  try {
    const { enviarNotificacion } = await import('@/lib/notificaciones');
    await enviarNotificacion({
      evento: 'alta_prioridad',
      userId: session.user.id,
      titulo: '🔴 Test: Alta prioridad',
      mensaje: 'Test — Presupuesto #9999 marcado como ALTA prioridad',
      linkUrl: '/presupuestos',
    });
    resultados.push({ tipo: 'alta_prioridad', ok: true });
  } catch (e: unknown) {
    resultados.push({ tipo: 'alta_prioridad', ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  const ok = resultados.filter((r) => r.ok).length;
  return NextResponse.json({
    suscripciones: subs.length,
    resultados,
    mensaje: `${ok}/${resultados.length} tests OK. Deberías recibir ${ok} notificaciones push.`,
  });
}
