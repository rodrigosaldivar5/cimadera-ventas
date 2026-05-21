export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { EditarPresupuestoForm } from '@/components/presupuestos/editar-presupuesto-form';

export default async function EditarPresupuestoPage({
  params,
}: {
  params: { id: string };
}) {
  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      lineas: { include: { item: true } },
      puertas: { include: { tipoPuerta: true } },
    },
  });

  if (!presupuesto) notFound();

  return (
    <EditarPresupuestoForm
      presupuesto={{
        id: presupuesto.id,
        numero: presupuesto.numero,
        clienteId: presupuesto.clienteId,
        fechaVencimiento: presupuesto.fechaVencimiento
          ? presupuesto.fechaVencimiento.toISOString().split('T')[0]
          : '',
        observaciones: presupuesto.observaciones ?? '',
        descuento: Number(presupuesto.descuento),
        estado: presupuesto.estado,
        puertas: presupuesto.puertas.map((p) => ({
          tipoPuertaId: p.tipoPuertaId,
          cantidad: p.cantidad,
          ancho: Number(p.ancho),
          alto: Number(p.alto),
          bisagraId: p.bisagraId ?? '',
          cerraduraId: p.cerraduraId ?? '',
          chapaId: p.chapaId ?? '',
          marcoId: p.marcoId ?? '',
          hojaId: p.hojaId ?? '',
          colorMarca: p.colorMarca ?? '',
          observaciones: p.observaciones ?? '',
          precioUnitario: Number(p.precioUnitario),
          subtotal: Number(p.subtotal),
        })),
        lineas: presupuesto.lineas.map((l) => ({
          itemId: l.itemId ?? '',
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precioUnitario),
          subtotal: Number(l.subtotal),
        })),
      }}
    />
  );
}
