export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CriteriosTab } from '@/components/clientes/criterios-tab';
import { ObrasTab } from '@/components/clientes/obras-tab';
import { TIPO_CLIENTE_LABEL, estadoBadgeClass, estadoLabel, type TipoCliente } from '@/lib/enums';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Hash, FileText } from 'lucide-react';

export default async function ClienteDetallePage({ params }: { params: { id: string } }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: {
      presupuestos: {
        orderBy: { fechaCreacion: 'desc' },
        take: 20,
        include: { creadoPor: { select: { nombre: true } } },
      },
      criterios: { orderBy: { createdAt: 'asc' } },
      obras: {
        where: { activo: true },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { presupuestos: true } } },
      },
    },
  });

  if (!cliente || !cliente.activo) notFound();

  const totalAprobado = cliente.presupuestos
    .filter((p) => p.estado === 'APROBADO')
    .reduce((sum, p) => sum + Number(p.totalFinal), 0);

  const criteriosActivos = cliente.criterios.filter((c) => c.activo).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/clientes">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Clientes
          </Link>
        </Button>
        <Button asChild className="bg-sky-500 hover:bg-sky-600">
          <Link href={`/presupuestos/nuevo?clienteId=${cliente.id}`}>
            <FileText className="mr-2 h-4 w-4" /> Nuevo Presupuesto
          </Link>
        </Button>
      </div>

      {/* Card datos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-500" />
            {cliente.razonSocial}
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {TIPO_CLIENTE_LABEL[(cliente.tipoCliente as TipoCliente) ?? 'PARTICULAR']}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {cliente.cuit && (
              <div className="flex items-center gap-2 text-slate-600">
                <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                <span>CUIT: {cliente.cuit}</span>
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{cliente.email}</span>
              </div>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{cliente.telefono}</span>
              </div>
            )}
            {(cliente.ciudad || cliente.provincia) && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                <span>
                  {[cliente.direccion, cliente.ciudad, cliente.provincia].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-800">{cliente.presupuestos.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Presupuestos totales</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {cliente.presupuestos.filter((p) => p.estado === 'APROBADO').length}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Aprobados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-sky-600">{formatCurrency(totalAprobado)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Facturado aprobado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="presupuestos">
        <TabsList>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="obras">
            Obras
            {cliente.obras.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{cliente.obras.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="criterios">
            Criterios
            {criteriosActivos > 0 && (
              <Badge variant="warning" className="ml-2 text-xs">{criteriosActivos}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presupuestos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nro</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Creado por</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliente.presupuestos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/presupuestos/${p.id}`} className="text-sky-600 hover:underline">
                          #{p.numero}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estadoBadgeClass[p.estado]}>{estadoLabel[p.estado]}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(p.fechaCreacion)}</TableCell>
                      <TableCell>{p.fechaVencimiento ? formatDate(p.fechaVencimiento) : '—'}</TableCell>
                      <TableCell>{p.creadoPor.nombre}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(p.totalFinal))}</TableCell>
                    </TableRow>
                  ))}
                  {cliente.presupuestos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-400 py-10">
                        Este cliente no tiene presupuestos aún
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obras">
          <ObrasTab clienteId={cliente.id} obras={cliente.obras} />
        </TabsContent>

        <TabsContent value="criterios">
          <CriteriosTab clienteId={cliente.id} criterios={cliente.criterios} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
