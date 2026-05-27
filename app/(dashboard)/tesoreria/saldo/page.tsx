export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { SaldoForm } from '@/components/tesoreria/saldo-form';

const ROLES_EDICION = ['ADMIN', 'COORDINACION_ADMIN'];

export default async function SaldoCajaPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!ROLES_EDICION.includes(session.user.rolNombre ?? '')) redirect('/tesoreria');

  const registros = await prisma.saldoCaja.findMany({
    orderBy: { fecha: 'desc' },
    take: 12,
  });

  const historial = registros.map((r) => ({
    id: r.id,
    fecha: r.fecha.toISOString(),
    saldo: r.saldo,
    nota: r.nota,
    creadoPor: r.creadoPor,
  }));

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/tesoreria" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Saldo de caja</h1>
          <p className="text-slate-500 text-sm">Registro semanal del saldo líquido disponible</p>
        </div>
      </div>

      <SaldoForm historial={historial} />
    </div>
  );
}
