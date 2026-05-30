import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { NeuralBackground } from '@/components/layout/NeuralBackground';

export default function ConviteExpiradoPage() {
  return (
    <div
      className="relative min-h-screen bg-bg flex flex-col items-center justify-center p-4"
      style={{
        '--color-bg': '#f5f3ef',
        '--color-surface': '#ffffff',
        '--color-surface-alt': '#eceae4',
        '--color-border': '#d4d1ca',
        '--color-text-primary': '#0d0d0d',
        '--color-text-secondary': '#8a8a8a',
      } as React.CSSProperties}
    >
      <NeuralBackground />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-6 shadow-lg">
          <OdontoIALogo className="w-7 h-7" />
        </div>

        <div className="bg-surface rounded-3xl border border-border shadow-sm p-10 space-y-6">
          {/* Ícone */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <h1 className="font-heading font-semibold text-2xl text-text-primary">
              Convite expirado
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              Este convite expirou e não pode mais ser utilizado.
              <br />
              Solicite um novo convite ao administrador da clínica.
            </p>
          </div>

          {/* CTA */}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-teal text-white rounded-xl font-bold px-6 py-3 hover:bg-teal-dark transition-all text-sm"
            style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
