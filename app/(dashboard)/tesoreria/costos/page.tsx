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

  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();

  const costos = await prisma.costoFijo.findMany({
    where: { activo: true },
    orderBy: { categoria: 'asc' },
    include: { registros: { where: { mes, anio } } },
  });

  const costosSerializados = costos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    categoria: c.categoria,
    categoriaId: c.categoriaId,
    moneda: c.moneda,
    observacion: c.observacion,
    registro: c.registros[0] ? {
      id: c.registros[0].id,
      montoEstimado: c.registros[0].montoEstimado ? Number(c.registros[0].montoEstimado) : null,
      montoReal: c.registros[0].montoReal ? Number(c.registros[0].montoReal) : null,
      observacion: c.registros[0].observacion,
    } : null,
  }));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/tesoreria" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Costos fijos</h1>
          <p className="text-slate-500 text-sm">Estimado vs real por mes — CIMADERA S.A.</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CostosFijosTable costosIniciales={costosSerializados} />
      </div>
    </div>
  );
}
