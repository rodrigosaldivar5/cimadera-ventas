const config = {
  VERDE:    { color: '#28A745', label: 'Zona de expansión',   texto: 'Caja saludable' },
  AMARILLO: { color: '#FFC107', label: 'Zona segura',         texto: 'Monitorear ingresos' },
  ROJO:     { color: '#DC3545', label: 'Alerta crítica',      texto: 'Activar cobros urgentes' },
} as const;

interface SemaforoProps {
  estado: 'VERDE' | 'AMARILLO' | 'ROJO';
  runway: number;
}

export function Semaforo({ estado, runway }: SemaforoProps) {
  const c = config[estado];
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div
        className="h-20 w-20 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: c.color }}
      >
        <span className="text-white font-bold text-lg">{c.label.split(' ')[0]}</span>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-slate-800">{c.label}</p>
        <p className="text-slate-500 text-sm">{c.texto}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: c.color }}>
          Runway: {runway} semanas
        </p>
      </div>
    </div>
  );
}
