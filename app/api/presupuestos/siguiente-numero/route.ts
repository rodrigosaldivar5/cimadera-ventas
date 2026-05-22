import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNextNumeroPresupuesto } from '@/lib/presupuesto-utils';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const numero = await getNextNumeroPresupuesto();
  return NextResponse.json({ numero });
}
