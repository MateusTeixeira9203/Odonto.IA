'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { atualizarStatusAgendamento } from '@/app/dashboard/agendamentos/actions';

/**
 * Saída do hero para o paciente atendido FORA do sistema (ex.: restauração rápida
 * sem abrir o Modo Consulta). Marca o agendamento como 'completed' (Realizado) — o
 * hero então avança pro próximo não-concluído.
 *
 * Botão secundário visível (bordado, ícone + rótulo) — claro pro dentista veterano,
 * mas subordinado ao CTA teal principal na hierarquia. Confirmação em 2 passos evita
 * pular paciente por engano. Reversível pela agenda.
 */
export function MarkAttendedButton({ agendamentoId }: { agendamentoId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const marcarAtendido = () => {
    startTransition(async () => {
      const res = await atualizarStatusAgendamento(agendamentoId, 'completed');
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Paciente marcado como atendido.');
      setConfirming(false);
      router.refresh();
    });
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-center text-xs font-semibold text-text-secondary">
          Marcar este atendimento como realizado?
        </p>
        <div className="flex gap-2">
          <button
            onClick={marcarAtendido}
            disabled={pending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-white bg-teal hover:bg-teal-lt transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Sim, atendido
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="px-4 py-3 rounded-2xl text-sm font-semibold text-text-secondary border border-border hover:bg-surface-alt hover:text-text-primary transition-all disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-text-primary bg-surface border border-border hover:border-teal/50 hover:bg-surface-alt transition-all active:scale-[0.98]"
    >
      <CheckCircle2 className="w-[18px] h-[18px] text-teal shrink-0" />
      Já foi atendido
    </button>
  );
}
