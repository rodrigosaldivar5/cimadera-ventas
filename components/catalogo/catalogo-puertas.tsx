'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, ImageOff, ZoomIn } from 'lucide-react';

const CATEGORIAS = ['Interior', 'Exterior', 'Placard', 'Otro'] as const;
type Categoria = typeof CATEGORIAS[number];

const categoriaBadgeClass: Record<string, string> = {
  Interior: 'bg-sky-100 text-[#0089C7] border-sky-200',
  Exterior: 'bg-amber-100 text-amber-700 border-amber-200',
  Placard: 'bg-purple-100 text-purple-700 border-purple-200',
  Otro: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface Puerta {
  id: string;
  nombre: string;
  descripcion: string | null;
  imageUrl: string;
  categoria: string;
}

interface Props {
  initialPuertas: Puerta[];
  isAdmin: boolean;
}

function ImagenConFallback({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <ImageOff className="h-8 w-8 mb-1" />
        <span className="text-xs">Sin imagen</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover transition-transform group-hover:scale-105"
      onError={() => setError(true)}
    />
  );
}

export function CatalogoPuertas({ initialPuertas, isAdmin }: Props) {
  const [puertas, setPuertas] = useState<Puerta[]>(initialPuertas);
  const [filtro, setFiltro] = useState<string>('Todas');
  const [vistaOpen, setVistaOpen] = useState(false);
  const [pUerta, setPUerta] = useState<Puerta | null>(null);
  const [agregarOpen, setAgregarOpen] = useState(false);
  const [form, setForm] = useState({ nombre: '', imageUrl: '', categoria: 'Interior' as Categoria, descripcion: '' });
  const [isLoading, setIsLoading] = useState(false);

  const filtradas = filtro === 'Todas' ? puertas : puertas.filter((p) => p.categoria === filtro);

  const abrirVista = (p: Puerta) => { setPUerta(p); setVistaOpen(true); };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.imageUrl.trim()) return;
    setIsLoading(true);
    const res = await fetch('/api/catalogo/puertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const nueva = await res.json();
      setPuertas((prev) => [...prev, nueva]);
      setAgregarOpen(false);
      setForm({ nombre: '', imageUrl: '', categoria: 'Interior', descripcion: '' });
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {['Todas', ...CATEGORIAS].map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filtro === cat
                  ? 'bg-[#00ADEF] text-white border-[#00ADEF]'
                  : 'bg-white border-slate-300 text-slate-600 hover:border-sky-400 hover:text-[#00ADEF]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button onClick={() => setAgregarOpen(true)} className="bg-[#00ADEF] hover:bg-[#0089C7]">
            <Plus className="mr-1.5 h-4 w-4" /> Agregar imagen
          </Button>
        )}
      </div>

      {/* Grid */}
      {filtradas.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <ImageOff className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay imágenes en esta categoría aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtradas.map((p) => (
            <div
              key={p.id}
              className="group rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => abrirVista(p)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <ImagenConFallback src={p.imageUrl} alt={p.nombre} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{p.nombre}</p>
                  <Badge variant="outline" className={`shrink-0 text-xs ${categoriaBadgeClass[p.categoria] ?? ''}`}>
                    {p.categoria}
                  </Badge>
                </div>
                {p.descripcion && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.descripcion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog vista */}
      <Dialog open={vistaOpen} onOpenChange={setVistaOpen}>
        <DialogContent className="max-w-2xl">
          {pUerta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {pUerta.nombre}
                  <Badge variant="outline" className={`text-xs font-normal ${categoriaBadgeClass[pUerta.categoria] ?? ''}`}>
                    {pUerta.categoria}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="rounded-lg overflow-hidden bg-slate-100 aspect-[4/3]">
                <ImagenConFallback src={pUerta.imageUrl} alt={pUerta.nombre} />
              </div>
              {pUerta.descripcion && (
                <p className="text-sm text-slate-600">{pUerta.descripcion}</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog agregar (solo admin) */}
      <Dialog open={agregarOpen} onOpenChange={setAgregarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agregar imagen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Puerta con vidrio repartido"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL de imagen *</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
              {form.imageUrl && (
                <div className="rounded-lg overflow-hidden bg-slate-100 aspect-[4/3] mt-2">
                  <ImagenConFallback src={form.imageUrl} alt="Preview" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as Categoria }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                rows={2}
                placeholder="Descripción opcional..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgregarOpen(false)}>Cancelar</Button>
            <Button
              onClick={guardar}
              disabled={!form.nombre.trim() || !form.imageUrl.trim() || isLoading}
              className="bg-[#00ADEF] hover:bg-[#0089C7]"
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
