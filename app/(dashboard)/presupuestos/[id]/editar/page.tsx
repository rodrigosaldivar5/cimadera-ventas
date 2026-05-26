export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { EditarPresupuestoForm } from '@/components/presupuestos/editar-presupuesto-form';
import type { ItemProducto, OpcionSeleccionada } from '@/components/presupuestos/cotizador-dinamico';

export default async function EditarPresupuestoPage({ params }: { params: { id: string } }) {
  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      lineas: { include: { item: true, opciones: true } },
    },
  });

  if (!presupuesto) notFound();

  const itemsProducto: ItemProducto[] = presupuesto.lineas
    .filter((l) => l.productoId != null)
    .map((l) => ({
      productoId: l.productoId!,
      productoNombre: l.productoNombre ?? '',
      cantidad: Number(l.cantidad),
      opciones: l.opciones.map((o): OpcionSeleccionada => ({
        atributoNombre: o.atributoNombre,
        opcionId: '',
        opcionNombre: o.opcionNombre,
        precioUnitario: parseFloat(String(o.precioUnitario)),
        cantidad: parseFloat(String(o.cantidad)),
        unidad: '',
        subtotal: parseFloat(String(o.subtotal)),
      })),
      subtotal: Number(l.subtotal),
    }));

  const catalogLineas = presupuesto.lineas
    .filter((l) => l.itemId != null)
    .map((l) => ({
      itemId: l.itemId!,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      subtotal: Number(l.subtotal),
    }));

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
        itemsProducto,
        lineas: catalogLineas,
      }}
    />
  );
}
