export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CatalogoPuertas } from '@/components/catalogo/catalogo-puertas';

export default async function CatalogoPuertasPage() {
  const session = await auth();
  const isAdmin = session?.user?.rolNombre === 'Administrador';

  const puertas = await prisma.catalogoPuerta.findMany({
    where: { activo: true },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">Catálogo — Puertas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Imágenes de referencia para presupuestar</p>
      </div>
      <CatalogoPuertas initialPuertas={puertas} isAdmin={isAdmin} />
    </div>
  );
}
