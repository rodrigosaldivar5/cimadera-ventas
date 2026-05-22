'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { Cliente } from '@prisma/client';
import { TIPO_CLIENTE, TIPO_CLIENTE_LABEL, type TipoCliente } from '@/lib/enums';

const clienteSchema = z.object({
  razonSocial: z.string().min(2, 'Razón social requerida'),
  cuit: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
  provincia: z.string().optional(),
  tipoCliente: z.enum(['CONSTRUCTORA', 'DESARROLLADOR', 'PARTICULAR']).optional(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

interface ClientesTableProps {
  clientes: Cliente[];
  total: number;
  page: number;
  perPage: number;
  q: string;
}

export function ClientesTable({ clientes, total, page, perPage, q }: ClientesTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalPages = Math.ceil(total / perPage);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { tipoCliente: 'PARTICULAR' },
  });

  const openNew = () => {
    setEditingCliente(null);
    reset({});
    setDialogOpen(true);
  };

  const openEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    reset({
      razonSocial: cliente.razonSocial,
      cuit: cliente.cuit ?? '',
      email: cliente.email ?? '',
      telefono: cliente.telefono ?? '',
      direccion: cliente.direccion ?? '',
      ciudad: cliente.ciudad ?? '',
      provincia: cliente.provincia ?? '',
      tipoCliente: (cliente.tipoCliente as TipoCliente) ?? 'PARTICULAR',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ClienteFormData) => {
    setIsSubmitting(true);
    const url = editingCliente ? `/api/clientes/${editingCliente.id}` : '/api/clientes';
    const method = editingCliente ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    setIsSubmitting(false);
    setDialogOpen(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/clientes?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, CUIT, ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Button onClick={openNew} className="bg-sky-500 hover:bg-sky-600">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razón Social</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Provincia</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.razonSocial}</TableCell>
                <TableCell>{c.cuit ?? '—'}</TableCell>
                <TableCell>{c.email ?? '—'}</TableCell>
                <TableCell>{c.telefono ?? '—'}</TableCell>
                <TableCell>{c.ciudad ?? '—'}</TableCell>
                <TableCell>{c.provincia ?? '—'}</TableCell>
                <TableCell className="text-sm text-slate-500">{TIPO_CLIENTE_LABEL[(c.tipoCliente as TipoCliente) ?? 'PARTICULAR']}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clientes.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-400 py-10">
                  No se encontraron clientes
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} clientes en total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => router.push(`/clientes?q=${q}&page=${page - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => router.push(`/clientes?q=${q}&page=${page + 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Razón Social *</Label>
                <Input {...register('razonSocial')} />
                {errors.razonSocial && <p className="text-xs text-red-500">{errors.razonSocial.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>CUIT</Label>
                <Input {...register('cuit')} placeholder="20-12345678-9" />
              </div>
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input {...register('telefono')} placeholder="+54 11 1234-5678" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register('email')} />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Dirección</Label>
                <Input {...register('direccion')} />
              </div>
              <div className="space-y-1">
                <Label>Ciudad</Label>
                <Input {...register('ciudad')} />
              </div>
              <div className="space-y-1">
                <Label>Provincia</Label>
                <Input {...register('provincia')} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Tipo de cliente</Label>
                <Select
                  defaultValue={editingCliente?.tipoCliente ?? 'PARTICULAR'}
                  onValueChange={(v) => setValue('tipoCliente', v as TipoCliente)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TIPO_CLIENTE).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCliente ? 'Guardar cambios' : 'Crear cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
