import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function PendientePage() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <div className="flex justify-center">
            <Logo variant="dark" />
          </div>
          <Clock className="h-12 w-12 text-[#00ADEF] mx-auto" />
          <h2 className="text-xl font-semibold text-slate-800">Cuenta pendiente de aprobación</h2>
          <p className="text-slate-500">
            Tu cuenta fue registrada y está siendo revisada por un administrador.
            Recibirás acceso una vez que sea aprobada.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
