'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, Receipt, TrendingUp, FileText, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Fila = {
  periodo: string;
  neto0: number;
  neto105: number;
  neto21: number;
  iva105: number;
  iva21: number;
  totalConIva: number;
};

type Totales = {
  netoTotal: number;
  neto0Total: number;
  neto105Total: number;
  neto21Total: number;
  iva105Total: number;
  iva21Total: number;
  ivaTotal: number;
  totalConIvaTotal: number;
};

type FiscalData = {
  filas: Fila[];
  totales: Totales;
  has105: boolean;
  inicio: string;
  fin: string;
};

function periodoLabel(key: string): string {
  if (/^\d{4}$/.test(key)) return key;
  const [yyyy, mm] = key.split('-');
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[Number(mm) - 1]} ${yyyy}`;
}

export function DashboardFiscal() {
  const now = new Date();
  const [tipoPeriodo, setTipoPeriodo] = useState<'mes_actual' | 'anio_actual' | 'mes' | 'anio'>('mes_actual');
  const [mesEspecifico, setMesEspecifico] = useState(String(now.getMonth() + 1));
  const [anioEspecifico, setAnioEspecifico] = useState(String(now.getFullYear()));
  const [data, setData] = useState<FiscalData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ periodo: tipoPeriodo });
    const agrupar = tipoPeriodo === 'anio_actual' || tipoPeriodo === 'anio' ? 'anio' : 'mes';
    params.set('agrupar', agrupar);
    if (tipoPeriodo === 'mes') params.set('mes', mesEspecifico);
    if (tipoPeriodo === 'mes' || tipoPeriodo === 'anio') params.set('anio', anioEspecifico);
    const res = await fetch(`/api/dashboard/fiscal?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [tipoPeriodo, mesEspecifico, anioEspecifico]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportarPDF = async () => {
    if (!data) return;
    const { generarResumenFiscalPDF } = await import('@/lib/pdf/generar-resumen-fiscal');
    const periodoStr =
      tipoPeriodo === 'mes_actual' ? 'Mes actual' :
      tipoPeriodo === 'anio_actual' ? 'Año actual' :
      tipoPeriodo === 'mes' ? `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][Number(mesEspecifico)-1]} ${anioEspecifico}` :
      `Año ${anioEspecifico}`;
    await generarResumenFiscalPDF({ filas: data.filas, totales: data.totales, has105: data.has105, periodo: periodoStr });
  };

  const t = data?.totales;

  return (
    <div className="space-y-5">
      {/* Selector de período */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoPeriodo} onValueChange={(v) => setTipoPeriodo(v as typeof tipoPeriodo)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes_actual">Este mes</SelectItem>
            <SelectItem value="anio_actual">Este año</SelectItem>
            <SelectItem value="mes">Mes específico</SelectItem>
            <SelectItem value="anio">Año específico</SelectItem>
          </SelectContent>
        </Select>

        {(tipoPeriodo === 'mes' || tipoPeriodo === 'anio') && (
          <Input
            type="number"
            min={2020}
            max={2099}
            value={anioEspecifico}
            onChange={(e) => setAnioEspecifico(e.target.value)}
            className="w-24"
            placeholder="Año"
          />
        )}
        {tipoPeriodo === 'mes' && (
          <Select value={mesEspecifico} onValueChange={setMesEspecifico}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}

        <Button variant="outline" size="sm" onClick={handleExportarPDF} disabled={!data || data.filas.length === 0} className="ml-auto">
          <Download className="mr-1.5 h-4 w-4" />
          Exportar PDF fiscal
        </Button>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              Neto total vendido
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(t?.netoTotal ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <FileText className="w-4 h-4" />
              Neto exento (0%)
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(t?.neto0Total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Receipt className="w-4 h-4" />
              Neto gravado 21%
            </div>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(t?.neto21Total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <DollarSign className="w-4 h-4" />
              IVA generado total
            </div>
            <p className="text-xl font-bold text-[#00ADEF]">{formatCurrency(t?.ivaTotal ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      {data && data.filas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10 border rounded-lg bg-white">
          No hay presupuestos aprobados en el período seleccionado.
        </p>
      ) : (
        <div className="rounded-2xl border border-[#D4B896]/40 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Neto 0%</TableHead>
                {data?.has105 && <TableHead className="text-right">Neto 10,5%</TableHead>}
                {data?.has105 && <TableHead className="text-right">IVA 10,5%</TableHead>}
                <TableHead className="text-right">Neto 21%</TableHead>
                <TableHead className="text-right">IVA 21%</TableHead>
                <TableHead className="text-right font-semibold">Total c/IVA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.filas ?? []).map((f) => (
                <TableRow key={f.periodo}>
                  <TableCell className="font-medium">{periodoLabel(f.periodo)}</TableCell>
                  <TableCell className="text-right">{f.neto0 > 0 ? formatCurrency(f.neto0) : '—'}</TableCell>
                  {data?.has105 && <TableCell className="text-right">{f.neto105 > 0 ? formatCurrency(f.neto105) : '—'}</TableCell>}
                  {data?.has105 && <TableCell className="text-right">{f.iva105 > 0 ? formatCurrency(f.iva105) : '—'}</TableCell>}
                  <TableCell className="text-right">{f.neto21 > 0 ? formatCurrency(f.neto21) : '—'}</TableCell>
                  <TableCell className="text-right">{f.iva21 > 0 ? formatCurrency(f.iva21) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold text-[#00ADEF]">{formatCurrency(f.totalConIva)}</TableCell>
                </TableRow>
              ))}
              {/* Fila totales */}
              {data && data.filas.length > 1 && (
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(t?.neto0Total ?? 0)}</TableCell>
                  {data.has105 && <TableCell className="text-right">{formatCurrency(t?.neto105Total ?? 0)}</TableCell>}
                  {data.has105 && <TableCell className="text-right">{formatCurrency(t?.iva105Total ?? 0)}</TableCell>}
                  <TableCell className="text-right">{formatCurrency(t?.neto21Total ?? 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t?.iva21Total ?? 0)}</TableCell>
                  <TableCell className="text-right text-[#00ADEF]">{formatCurrency(t?.totalConIvaTotal ?? 0)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


