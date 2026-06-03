import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  const isApiAuth = process.env.EXTERNAL_API_KEY && token === process.env.EXTERNAL_API_KEY;

  if (!isApiAuth) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [pending, retrying, failed] = await Promise.all([
    prisma.eventDestination.count({ where: { status: 'PENDING' } }),
    prisma.eventDestination.count({ where: { status: 'RETRYING' } }),
    prisma.eventDestination.count({ where: { status: 'FAILED' } }),
  ]);

  return NextResponse.json({ pending, retrying, failed });
}
