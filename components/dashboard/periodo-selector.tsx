'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, format } from 'date-fns';
import { useState, useEffect } from 'react';

const now = new Date();

const PRESETS = [
  {
    label: 'Este mes',
    desde: () => format(startOfMonth(now), 'yyyy-MM-dd'),
    hasta: () => format(endOfMonth(now), 'yyyy-MM-dd'),
  },
  {
    label: 'Mes anterior',
    desde: () => format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
    hasta: () => format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
  },
  {
    label: 'Este año',
    desde: () => format(startOfYear(now), 'yyyy-MM-dd'),
    hasta: () => format(endOfYear(now), 'yyyy-MM-dd'),
  },
  {
    label: 'Año anterior',
    desde: () => format(startOfYear(subYears(now, 1)), 'yyyy-MM-dd'),
    hasta: () => format(endOfYear(subYears(now, 1)), 'yyyy-MM-dd'),
  },
];

export function PeriodoSelector({ desde, hasta }: { desde?: string; hasta?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customDesde, setCustomDesde] = useState(desde ?? '');
  const [customHasta, setCustomHasta] = useState(hasta ?? '');

  useEffect(() => {
    setCustomDesde(desde ?? '');
    setCustomHasta(hasta ?? '');
  }, [desde, hasta]);

  const navigate = (d: string, h: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('desde', d);
    params.set('hasta', h);
    router.push(`${pathname}?${params.toString()}`);
  };

  const activePreset = PRESETS.find((p) => p.desde() === desde && p.hasta() === hasta);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={activePreset?.label === preset.label ? 'default' : 'outline'}
          size="sm"
          className={activePreset?.label === preset.label ? 'bg-[#00ADEF] hover:bg-[#0089C7] text-white' : ''}
          onClick={() => navigate(preset.desde(), preset.hasta())}
        >
          {preset.label}
        </Button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <Input
          type="date"
          value={customDesde}
          onChange={(e) => setCustomDesde(e.target.value)}
          className="w-36 h-8 text-xs"
        />
        <span className="text-slate-400 text-xs">–</span>
        <Input
          type="date"
          value={customHasta}
          onChange={(e) => setCustomHasta(e.target.value)}
          className="w-36 h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => { if (customDesde && customHasta) navigate(customDesde, customHasta); }}
          disabled={!customDesde || !customHasta}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}
