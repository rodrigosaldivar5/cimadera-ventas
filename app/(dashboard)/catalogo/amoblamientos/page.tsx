import { Card, CardContent } from '@/components/ui/card';
import { HardHat } from 'lucide-react';

export default function AmoblamientosPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-sm w-full text-center shadow-md">
        <CardContent className="py-12 space-y-4">
          <HardHat className="mx-auto h-12 w-12 text-yellow-400" />
          <h2 className="text-xl font-semibold text-slate-700">Próximamente</h2>
          <p className="text-slate-400 text-sm">No veo el cheque aún 👀</p>
        </CardContent>
      </Card>
    </div>
  );
}
