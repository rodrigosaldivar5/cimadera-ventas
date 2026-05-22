import { HardHat } from 'lucide-react';

export default function AluminioPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="rounded-full bg-amber-50 p-5">
        <HardHat className="h-12 w-12 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Aluminio</h1>
      <p className="text-lg font-medium text-slate-600">No veo el cheque aún 👀</p>
      <p className="text-sm text-slate-400">Esta sección estará disponible en breve.</p>
    </div>
  );
}
