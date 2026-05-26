import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      lineas: {
        include: {
          item: true,
          opciones: {
            include: {
              linea: { include: { presupuesto: true } },
            },
          },
        },
      },
    },
  });
  if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  let subtotalTotal = 0;

  for (const linea of presupuesto.lineas) {
    if (linea.itemId && linea.item) {
      // Línea de catálogo: actualizar desde Item.precioVenta
      const nuevoPrecio = parseFloat(String(linea.item.precioVenta));
      const nuevoSubtotal = parseFloat((Number(linea.cantidad) * nuevoPrecio).toFixed(2));
      await prisma.lineaPresupuesto.update({
        where: { id: linea.id },
        data: { precioUnitario: nuevoPrecio, subtotal: nuevoSubtotal },
      });
      subtotalTotal += nuevoSubtotal;
    } else if (linea.productoId && linea.opciones.length > 0) {
      // Línea de producto: actualizar cada opción desde OpcionAtributo
      let lineaSubtotal = 0;
      for (const opcion of linea.opciones) {
        const opcionAtributo = await prisma.opcionAtributo.findFirst({
          where: {
            nombre: opcion.opcionNombre,
            atributo: { nombre: opcion.atributoNombre, productoId: linea.productoId! },
          },
        });
        if (opcionAtributo) {
          const nuevoPrecio = parseFloat(String(opcionAtributo.precioVenta));
          const nuevoSubtotal = parseFloat((Number(opcion.cantidad) * nuevoPrecio).toFixed(2));
          await prisma.opcionLineaPresupuesto.update({
            where: { id: opcion.id },
            data: { precioUnitario: nuevoPrecio, subtotal: nuevoSubtotal },
          });
          lineaSubtotal += nuevoSubtotal;
        } else {
          lineaSubtotal += parseFloat(String(opcion.subtotal));
        }
      }
      const cantidadLinea = Number(linea.cantidad);
      const nuevoPrecioUnitario = cantidadLinea > 0
        ? parseFloat((lineaSubtotal / cantidadLinea).toFixed(2))
        : 0;
      await prisma.lineaPresupuesto.update({
        where: { id: linea.id },
        data: { precioUnitario: nuevoPrecioUnitario, subtotal: lineaSubtotal },
      });
      subtotalTotal += lineaSubtotal;
    } else {
      subtotalTotal += parseFloat(String(linea.subtotal));
    }
  }

  const descuento = parseFloat(String(presupuesto.descuento));
  const totalFinal = parseFloat((subtotalTotal * (1 - descuento / 100)).toFixed(2));

  const updated = await prisma.presupuesto.update({
    where: { id: params.id },
    data: { subtotal: subtotalTotal, totalFinal },
  });

  return NextResponse.json({ subtotal: Number(updated.subtotal), totalFinal: Number(updated.totalFinal) });
}
