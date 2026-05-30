'use client';

import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';

export function ConsultaCtaButton() {
  return (
    <button
      onClick={() => toast.info('Modo consulta será implementado em breve')}
      className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.98]"
      style={{
        background: 'linear-gradient(135deg, #2f9c85 0%, #258872 50%, #1d7a65 100%)',
        boxShadow:
          '0 8px 32px rgba(47,156,133,0.45), 0 2px 8px rgba(47,156,133,0.2), inset 0 1px 0 rgba(255,255,255,0.16)',
      }}
    >
      <Stethoscope className="w-5 h-5 shrink-0" />
      Entrar no Modo Consulta
    </button>
  );
}
