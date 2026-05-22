export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PresupuestoAcciones } from '@/components/presupuestos/presupuesto-acciones';
import type { EstadoPresupuesto } from '@prisma/client';
import Link from 'next/link';
import { ArrowLeft, Building2, User2, Calendar } from 'lucide-react';

const estadoBadgeVariant: Record<EstadoPresupuesto, 'default' | 'info' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' | 'purple'> = {
  PENDIENTE: 'secondary',
  EN_PROCESO: 'info',
  FINALIZADO: 'success',
  PARA_ENVIAR: 'warning',
  ENVIADO: 'outline',
  APROBADO: 'success',
  RECHAZADO: 'destructive',
};

const estadoLabel: Record<EstadoPresupuesto, string> = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', FINALIZADO: 'Finalizado',
  PARA_ENVIAR: 'Para enviar', ENVIADO: 'Enviado', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado',
};

export default async function PresupuestoDetallePage({ params }: { params: { id: string } }) {
  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      creadoPor: true,
      lineas: { include: { item: true, opciones: true } },
      puertas: { include: { tipoPuerta: true } },
    },
  });

  if (!presupuesto) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/presupuestos"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link>
        </Button>
        <div className="flex items-center gap-3">
          <Badge variant={estadoBadgeVariant[presupuesto.estado]} className="text-sm px-3 py-1">
            {estadoLabel[presupuesto.estado]}
          </Badge>
          <PresupuestoAcciones
            presupuesto={{ id: presupuesto.id, estado: presupuesto.estado, numero: presupuesto.numero }}
            presupuestoPDF={{
              numero: presupuesto.numero,
              nombrePresupuesto: presupuesto.nombrePresupuesto,
              fechaCreacion: presupuesto.fechaCreacion,
              fechaVencimiento: presupuesto.fechaVencimiento,
              observaciones: presupuesto.observaciones,
              subtotal: Number(presupuesto.subtotal),
              descuento: Number(presupuesto.descuento),
              totalFinal: Number(presupuesto.totalFinal),
              cliente: {
                razonSocial: presupuesto.cliente.razonSocial,
                cuit: presupuesto.cliente.cuit,
                email: presupuesto.cliente.email,
                telefono: presupuesto.cliente.telefono,
                ciudad: presupuesto.cliente.ciudad,
                provincia: presupuesto.cliente.provincia,
                tipoCliente: presupuesto.cliente.tipoCliente,
              },
              creadoPor: { nombre: presupuesto.creadoPor.nombre },
              lineas: presupuesto.lineas.map((l) => ({
                nombre: l.item?.nombre ?? l.productoNombre ?? '—',
                cantidad: Number(l.cantidad),
                precioUnitario: Number(l.precioUnitario),
                subtotal: Number(l.subtotal),
                unidad: l.item?.unidad,
                opciones: l.opciones.map((o) => ({ atributoNombre: o.atributoNombre, opcionNombre: o.opcionNombre })),
              })),
              puertas: presupuesto.puertas.map((pu) => ({
                tipoPuerta: { nombre: pu.tipoPuerta.nombre },
                ancho: Number(pu.ancho),
                alto: Number(pu.alto),
                cantidad: pu.cantidad,
                colorMarca: pu.colorMarca,
                precioUnitario: Number(pu.precioUnitario),
                subtotal: Number(pu.subtotal),
              })),
            }}
          />
        </div>
      </div>

      {/* Documento */}
      <Card className="shadow-lg">
        <CardContent className="p-8 space-y-8">
          {/* Header del documento */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">CIMAdera S.A.</h1>
              <p className="text-slate-500 text-sm mt-1">Carpintería Industrial</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-sky-500">Presupuesto #{presupuesto.numero}</div>
              <div className="flex items-center gap-1 text-sm text-slate-500 justify-end mt-1">
                <Calendar className="h-4 w-4" />
                {formatDate(presupuesto.fechaCreacion)}
              </div>
              {presupuesto.fechaVencimiento && (
                <p className="text-xs text-slate-400">Vence: {formatDate(presupuesto.fechaVencimiento)}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Info cliente */}
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
                <Building2 className="h-4 w-4" /> Cliente
              </div>
              <p className="font-semibold text-slate-800">{presupuesto.cliente.razonSocial}</p>
              {presupuesto.cliente.cuit && <p className="text-sm text-slate-500">CUIT: {presupuesto.cliente.cuit}</p>}
              {presupuesto.cliente.email && <p className="text-sm text-slate-500">{presupuesto.cliente.email}</p>}
              {presupuesto.cliente.telefono && <p className="text-sm text-slate-500">{presupuesto.cliente.telefono}</p>}
              {presupuesto.cliente.ciudad && (
                <p className="text-sm text-slate-500">{presupuesto.cliente.ciudad}{presupuesto.cliente.provincia ? `, ${presupuesto.cliente.provincia}` : ''}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
                <User2 className="h-4 w-4" /> Elaborado por
              </div>
              <p className="font-semibold text-slate-800">{presupuesto.creadoPor.nombre}</p>
              <p className="text-sm text-slate-500">{presupuesto.creadoPor.email}</p>
            </div>
          </div>

          <Separator />

          {/* Puertas */}
          {presupuesto.puertas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-700">Puertas</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Medidas</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">P. Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presupuesto.puertas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.tipoPuerta.nombre}</TableCell>
                      <TableCell>{Number(p.ancho).toFixed(2)}m × {Number(p.alto).toFixed(2)}m</TableCell>
                      <TableCell>{p.colorMarca ?? '—'}</TableCell>
                      <TableCell className="text-center">{p.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(p.precioUnitario))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(p.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Materiales adicionales */}
          {presupuesto.lineas.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-700">Materiales adicionales</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presupuesto.lineas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.item?.nombre ?? l.productoNombre ?? '—'}</TableCell>
                      <TableCell className="text-center">{Number(l.cantidad).toFixed(2)} {l.item?.unidad ?? 'u.'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.precioUnitario))}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(l.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Separator />

          {/* Totales */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatCurrency(Number(presupuesto.subtotal))}</span>
              </div>
              {Number(presupuesto.descuento) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento ({Number(presupuesto.descuento)}%)</span>
                  <span>-{formatCurrency(Number(presupuesto.subtotal) * Number(presupuesto.descuento) / 100)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg text-sky-600">
                <span>Total Final</span>
                <span>{formatCurrency(Number(presupuesto.totalFinal))}</span>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          {presupuesto.observaciones && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-500 mb-1">Observaciones</p>
              <p className="text-sm text-slate-700">{presupuesto.observaciones}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
