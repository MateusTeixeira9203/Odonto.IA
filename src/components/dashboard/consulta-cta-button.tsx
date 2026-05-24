'use client';

import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';

export function ConsultaCtaButton() {
  return (
    <button
      onClick={() => toast.info('Modo consulta será implementado em breve')}
      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95"
      style={{
        background: '#2f9c85',
        boxShadow: '0 4px 20px rgba(47,156,133,0.35)',
      }}
    >
      <Stethoscope className="w-4 h-4" />
      Entrar no Modo Consulta
    </button>
  );
}
