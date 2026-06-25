import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { id } = await params;

  try {
    const p = await prisma.presupuesto.findUnique({
      where: { id },
      include: {
        cliente: true,
        obra: true,
        responsable: { select: { id: true, nombre: true, email: true } },
        creadoPor: { select: { id: true, nombre: true } },
        lineas: {
          include: {
            item: { select: { id: true, nombre: true, unidad: true } },
            opciones: true,
          },
        },
        archivos: {
          select: { id: true, nombre: true, tipo: true, tamanio: true, createdAt: true },
        },
      },
    });

    if (!p) return jsonWithCors({ error: 'Not found' }, 404, origin);

    return jsonWithCors({
      id: p.id,
      numero: p.numero,
      nombrePresupuesto: p.nombrePresupuesto,
      cliente: p.cliente,
      obra: p.obra,
      responsable: p.responsable,
      creadoPor: p.creadoPor,
      estado: p.estado,
      prioridad: p.prioridad,
      moneda: p.moneda,
      subtotal: Number(p.subtotal),
      descuento: Number(p.descuento),
      totalFinal: Number(p.totalFinal),
      tasaIva: Number(p.tasaIva),
      montoIva: Number(p.montoIva),
      totalConIva: Number(p.totalConIva),
      precioFinal: p.precioFinal ? Number(p.precioFinal) : null,
      monto: {
        moneda: p.moneda,
        subtotal: Number(p.subtotal),
        totalFinal: Number(p.totalFinal),
        totalConIva: Number(p.totalConIva),
      },
      preciosNetos: p.preciosNetos,
      observaciones: p.observaciones,
      fechaCreacion: p.fechaCreacion,
      fechaRecepcion: p.fechaRecepcion,
      fechaEnvio: p.fechaEnvio,
      fechaVencimiento: p.fechaVencimiento,
      lineas: p.lineas.map((l) => ({
        id: l.id,
        item: l.item,
        productoNombre: l.productoNombre,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        subtotal: Number(l.subtotal),
        opciones: l.opciones.map((o) => ({
          atributoNombre: o.atributoNombre,
          opcionNombre: o.opcionNombre,
          precioUnitario: Number(o.precioUnitario),
          cantidad: Number(o.cantidad),
          subtotal: Number(o.subtotal),
        })),
      })),
      archivos: p.archivos,
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/presupuestos/[id]:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
