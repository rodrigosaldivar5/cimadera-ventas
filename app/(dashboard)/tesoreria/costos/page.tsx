export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CostosFijosTable } from '@/components/tesoreria/costos-fijos-table';

const ROLES_EDICION = ['Administrador'];

export default async function CostosFijosPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!ROLES_EDICION.includes(session.user.rolNombre ?? '')) redirect('/tesoreria');

  const costos = await prisma.costoFijo.findMany({
    where: { activo: true },
    orderBy: { categoria: 'asc' },
  });

  const costosSerializados = costos.map((c) => ({ ...c, monto: Number(c.monto), moneda: c.moneda ?? 'ARS' }));

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/tesoreria" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Costos fijos</h1>
          <p className="text-slate-500 text-sm">Egresos mensuales fijos de CIMADERA</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CostosFijosTable costosIniciales={costosSerializados} />
      </div>
    </div>
  );
}
