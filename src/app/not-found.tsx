import Link from 'next/link';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-6 shadow-lg">
          <OdontoIALogo className="w-7 h-7" />
        </div>

        <div className="bg-surface rounded-3xl border border-border shadow-sm p-10 space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 border border-teal/20">
            <Compass className="w-8 h-8 text-teal" />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-semibold text-2xl text-text-primary">
              Página não encontrada
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              O endereço que você tentou acessar não existe ou foi movido.
            </p>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" size="lg" render={<Link href="/dashboard" />}>
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
