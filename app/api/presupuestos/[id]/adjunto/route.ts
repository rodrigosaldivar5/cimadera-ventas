// Deprecated — superseded by /api/presupuestos/[id]/archivos
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/presupuestos/[id]/archivos' }, { status: 410 });
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ error: 'Use /api/presupuestos/[id]/archivos/[archivoId]' }, { status: 410 });
}
