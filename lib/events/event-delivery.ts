import { prisma } from '@/lib/prisma';

export async function deliverEvent(
  eventLogId: string,
  destinationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const destination = await prisma.eventDestination.findUnique({
    where: { id: destinationId },
  });
  if (!destination) return;

  const maxAttempts = 3;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(destination.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Event-Type': String(payload.eventType ?? ''),
          'X-Event-Version': String(payload.version ?? '1.0'),
          'X-Correlation-Id': String(payload.correlationId ?? ''),
          'X-Payload-Hash': String(payload.hash ?? ''),
          'X-Source': String(payload.source ?? 'ventas.cimadera.net'),
          Authorization: `Bearer ${process.env.EXTERNAL_API_KEY ?? ''}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        await prisma.eventDestination.update({
          where: { id: destinationId },
          data: { status: 'DELIVERED', deliveredAt: new Date(), attempts: attempt },
        });
        const allDone = await prisma.eventDestination.findMany({
          where: { eventLogId },
          select: { status: true },
        });
        if (allDone.every((d) => d.status === 'DELIVERED')) {
          await prisma.eventLog.update({
            where: { id: eventLogId },
            data: { status: 'DELIVERED', processedAt: new Date() },
          });
        }
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }

  await prisma.eventDestination.update({
    where: { id: destinationId },
    data: { status: 'FAILED', lastError, attempts: maxAttempts },
  });
  await prisma.eventLog.update({
    where: { id: eventLogId },
    data: { status: 'FAILED' },
  });
}
