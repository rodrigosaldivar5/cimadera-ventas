import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const MAX_ATTEMPTS = 3;

function hmacSignature(body: string, secret: string): string {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

function buildHeaders(
  target: string,
  payload: Record<string, unknown>,
  body: string,
): Record<string, string> {
  if (target === 'crm') {
    return {
      'Content-Type': 'application/json',
      'X-CIMADERA-Origin': 'ventas',
      'X-CIMADERA-Signature': hmacSignature(body, process.env.CRM_WEBHOOK_SECRET ?? ''),
    };
  }
  return {
    'Content-Type': 'application/json',
    'X-Event-Type': String(payload.eventType ?? ''),
    'X-Event-Version': String(payload.version ?? '1.0'),
    'X-Correlation-Id': String(payload.correlationId ?? ''),
    'X-Payload-Hash': String(payload.hash ?? ''),
    'X-Source': 'ventas.cimadera.net',
    'X-Signature': hmacSignature(body, process.env.EXTERNAL_API_KEY ?? ''),
    Authorization: `Bearer ${process.env.EXTERNAL_API_KEY ?? ''}`,
  };
}

async function syncEventLogStatus(eventLogId: string): Promise<void> {
  const dests = await prisma.eventDestination.findMany({
    where: { eventLogId },
    select: { status: true },
  });
  const allDelivered = dests.every((d) => d.status === 'DELIVERED');
  const allResolved = dests.every((d) => d.status === 'DELIVERED' || d.status === 'FAILED');

  if (allDelivered) {
    await prisma.eventLog.update({
      where: { id: eventLogId },
      data: { status: 'DELIVERED', processedAt: new Date() },
    });
  } else if (allResolved) {
    await prisma.eventLog.update({
      where: { id: eventLogId },
      data: { status: 'FAILED' },
    });
  }
}

export async function deliverEvent(destinationId: string): Promise<void> {
  const dest = await prisma.eventDestination.findUnique({
    where: { id: destinationId },
    include: { eventLog: { select: { id: true, payload: true } } },
  });
  if (!dest) return;

  const { attempts: prevAttempts } = await prisma.eventDestination.update({
    where: { id: destinationId },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  const payload = dest.eventLog.payload as Record<string, unknown>;
  const body = JSON.stringify(payload);

  try {
    const res = await fetch(dest.targetUrl, {
      method: 'POST',
      headers: buildHeaders(dest.target, payload, body),
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      await prisma.eventDestination.update({
        where: { id: destinationId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      await syncEventLogStatus(dest.eventLog.id);
      return;
    }

    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const lastError = err instanceof Error ? err.message : String(err);
    const newStatus = prevAttempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRYING';
    await prisma.eventDestination.update({
      where: { id: destinationId },
      data: { status: newStatus, lastError },
    });
    if (newStatus === 'FAILED') {
      await syncEventLogStatus(dest.eventLog.id);
    }
  }
}
