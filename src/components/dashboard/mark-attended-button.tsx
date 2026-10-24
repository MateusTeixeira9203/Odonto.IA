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
      <div data-confirmar-atendimento className="flex flex-col gap-2">
        <p className="text-center text-[13px] text-text-secondary">
          Marcar este atendimento como realizado?
        </p>
        <div className="flex gap-2 max-[600px]:flex-col">
          <button
            onClick={marcarAtendido}
            disabled={pending}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[8px] border border-teal-ink bg-teal-pale px-[13px] text-[13px] font-semibold text-teal-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-40 max-[600px]:flex-none"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {pending ? 'Marcando…' : 'Sim, atendido'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="h-10 rounded-[8px] border border-border px-[13px] text-[13px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-40"
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
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-border px-[13px] text-[13px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      Já foi atendido
    </button>
  );
}
