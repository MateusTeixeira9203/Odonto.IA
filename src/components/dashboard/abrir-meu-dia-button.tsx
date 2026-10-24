'use client';

// R-46g — era o "Entrar no Modo Consulta" (consulta-cta-button.tsx). Renomeado porque o
// destino mudou: agora abre o Meu dia, que ganhou a saída pro atendimento por slot (D3).
// R-72 (07/08) aposentou `/consulta/{agendamentoId}` de vez — este já era o único destino.

import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';

interface AbrirMeuDiaButtonProps {
  agendamentoId: string;
  pacienteNome: string;
  horario: string;
}

export function AbrirMeuDiaButton({ agendamentoId, pacienteNome, horario }: AbrirMeuDiaButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/dashboard/meu-dia?ag=${agendamentoId}`)}
      className="inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-[8px] border border-teal-ink bg-teal-pale px-[13px] text-[13px] font-semibold text-teal-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20 group-has-[[data-confirmar-atendimento]]/acoes:border-border group-has-[[data-confirmar-atendimento]]/acoes:bg-transparent group-has-[[data-confirmar-atendimento]]/acoes:text-text-secondary"
    >
      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">Abrir meu dia → {pacienteNome}, {horario}</span>
    </button>
  );
}
