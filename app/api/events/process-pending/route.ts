import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deliverEvent } from '@/lib/events/event-delivery';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  const validToken =
    (process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (process.env.EXTERNAL_API_KEY && token === process.env.EXTERNAL_API_KEY);

  if (!validToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const destinations = await prisma.eventDestination.findMany({
    where: { status: { in: ['PENDING', 'RETRYING'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let delivered = 0;
  let retrying = 0;
  let failed = 0;

  await Promise.allSettled(
    destinations.map(async (dest) => {
      await deliverEvent(dest.id);
      const updated = await prisma.eventDestination.findUnique({
        where: { id: dest.id },
        select: { status: true },
      });
      if (updated?.status === 'DELIVERED') delivered++;
      else if (updated?.status === 'RETRYING') retrying++;
      else if (updated?.status === 'FAILED') failed++;
    }),
  );

  return NextResponse.json({
    processed: destinations.length,
    delivered,
    retrying,
    failed,
  });
}
