export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { DescuentosForm } from '@/components/clientes/descuentos-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';

export default async function DescuentosPage() {
  const descuentos = await prisma.descuentoTipoCliente.findMany({
    orderBy: { tipoCliente: 'asc' },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Percent className="h-6 w-6 text-[#00ADEF]" />
          Descuentos por tipo de cliente
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configurá los descuentos que se aplican automáticamente según el tipo de cliente al crear un presupuesto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descuentos automáticos</CardTitle>
        </CardHeader>
        <CardContent>
          <DescuentosForm descuentos={descuentos.map((d) => ({
            id: d.id,
            tipoCliente: d.tipoCliente as string,
            descuento: Number(d.descuento),
            descripcion: d.descripcion,
          }))} />
        </CardContent>
      </Card>
    </div>
  );
}
