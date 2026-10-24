'use client';

// R-46a — rail horizontal dos atendimentos do dia. Badge de status reusa a paleta e as
// classes literais já em produção (today-agenda.tsx / atendimentos-hoje.tsx); o ⚠ "sem
// registro" é sinal NOVO, camada extra sobre o status real do agendamento — G3 da spec:
// completed + sem ficha hoje, mesma régua do baseline medido em 31/07.
// R-72 (07/08) — o card era div PORQUE "iniciar consulta" era um 2º controle que não podia
// aninhar em botão (R-46g); esse link levava pro /consulta que R-72 aposentou. Selecionar o
// slot já é a ação inteira agora (você já ESTÁ no Meu dia) — sem 2º controle, sobrou só o
// seletor de status manual (R-74).
//
// C2 (contrato §5.2) — arrasta pro lado, sem barra visível (scrollbar-hide já existia, o
// scroll continua funcionando por teclado/wheel — só a barra some). Limiar de 5px: abaixo
// é clique, acima é arraste, e o clique correspondente é suprimido em fase de captura —
// sem isso, soltar o arraste em cima de um card troca de paciente sem querer.

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { MeuDiaSlot } from '@/server/dashboard/get-meu-dia';
import type { AgendamentoStatus } from '@/types/database';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Aguardando',
  confirmed: 'Confirmado',
  checked_in: 'Na recepção',
  in_progress: 'Em atendimento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Faltou',
};

// 07/08 — ordem de escolha manual (D1: sem "cancelled"/"no_show" no topo, são exceção, não
// fluxo comum). Salvar a visita já marca 'completed' via origem='modo_consulta' — este
// seletor é o escape hatch pra quando isso não aconteceu (ficha rápida, ordem fora do padrão)
// ou pra corrigir (reabrir um "concluído" clicado sem querer).
const STATUS_OPTIONS: AgendamentoStatus[] = [
  'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'no_show', 'cancelled',
];

export interface RailProps {
  slots: MeuDiaSlot[];
  selecionadoId: string | null;
  onSelecionar: (agendamentoId: string) => void;
  /** R-57 F1 — paciente sem agendamento (chegou sem marcar, urgência). Abre o mesmo modal
   *  "Atender agora" que a Agenda usa. */
  onEncaixe: () => void;
  /** 07/08 — troca manual de status (pedido dele: salvar nem sempre marca "atendido" —
   *  ficha rápida fora do fluxo, ou corrigir clique errado). Reusa `atualizarStatusAgendamento`
   *  já usado pela Agenda — mesma escrita, novo ponto de entrada. */
  onMudarStatus: (agendamentoId: string, status: AgendamentoStatus) => void;
  /** R-105a §4.2 — este dentista ainda não salvou ficha nenhuma. Troca a frase do estado
   *  vazio e o rótulo do botão, e acende o botão. Some sozinho na 2ª sessão. */
  primeiraSessao?: boolean;
}

const LIMIAR_ARRASTE_PX = 5;
// Distância sozinha classificava tremor de clique como arraste (ver comentário em
// onPointerMove) — exige também esse tempo mínimo percorrendo o limiar.
const TEMPO_MIN_ARRASTE_MS = 100;

/** R-57 F1 — fora do `<button>` do slot (nota do topo: não aninhar botão em botão). Mesmo
 *  recorte de tamanho do card de slot; borda tracejada marca "adicionar", não um card real.
 *
 *  R-105a §4.2 — na primeira sessão o rótulo vira "Atender agora" e a borda acende. "Encaixe"
 *  é jargão de agenda: é o único botão vivo da tela pro dentista que acabou de se cadastrar, e
 *  ele não tem como saber o que a palavra quer dizer (Krug: nomes usam a palavra do cliente).
 *  O realce é o MESMO `border-teal` que o slot selecionado já usa — nenhum estilo novo. */
function BotaoEncaixe(
  { onEncaixe, primeiraSessao, aceso }:
  { onEncaixe: () => void; primeiraSessao?: boolean; aceso?: boolean },
) {
  return (
    <button
      type="button"
      data-rail-alvo="encaixe"
      onClick={onEncaixe}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-[13px] py-2 transition-colors [scroll-snap-align:start] ${
        aceso
          ? 'border-teal bg-teal-pale text-teal-ink'
          : 'border-dashed border-border text-text-secondary hover:border-teal/40 hover:text-teal'
      }`}
    >
      <Plus className="h-4 w-4" />
      <span className="text-[13px] font-semibold">{primeiraSessao ? 'Atender agora' : 'Encaixe'}</span>
    </button>
  );
}

interface ArrasteState {
  x: number;
  scrollLeft: number;
  t: number;
  moveu: boolean;
  /** 07/08 — resolvido no PRÓPRIO pointerdown (ver comentário grande abaixo), não no click
   *  nativo que vem depois. `null` = pointerdown fora de qualquer alvo reconhecido (padding,
   *  divisor). */
  alvo: string | null;
}

export function Rail({ slots, selecionadoId, onSelecionar, onEncaixe, onMudarStatus, primeiraSessao }: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const arraste = useRef<ArrasteState | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [temMais, setTemMais] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checar = () => setTemMais(el.scrollWidth > el.clientWidth);
    checar();
    const ro = new ResizeObserver(checar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slots.length]);

  // BUG real (07/08, achado com instrumentação ao vivo, os 2 fixes anteriores não bastavam):
  // o `click` nativo mira em quem estiver na coordenada de tela NO MOMENTO DO POINTERUP, não
  // em quem estava lá no pointerdown. Se QUALQUER coisa reflui o rail entre pressionar e
  // soltar (um card ganha/perde largura, a lista ganha um item), o clique acerta um elemento
  // diferente do que o dedo/mouse mirou — sem erro nenhum, o clique só "morre" num alvo errado
  // (foi assim que o Encaixe, sempre o item mais à direita — o mais exposto a qualquer
  // deslocamento — parou de responder mesmo depois da ref de arrasto parar de vazar). Fix:
  // resolve QUAL alvo foi pressionado aqui, no pointerdown (antes de qualquer reflow ter
  // chance de acontecer), guarda em `alvo`, e dispara a ação no pointerup por esse alvo
  // guardado — nunca pelo que o `click` nativo decidir depois.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!scrollRef.current) return;
    const alvoEl = e.target instanceof HTMLElement ? e.target : null;
    // `<select>` de status (abaixo) tem interação nativa própria — não entra no arrasto nem
    // na resolução de alvo, senão o menu nativo do sistema operacional se comporta esquisito.
    if (alvoEl?.closest('select')) return;
    arraste.current = {
      x: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
      t: e.timeStamp,
      moveu: false,
      alvo: alvoEl?.closest<HTMLElement>('[data-rail-alvo]')?.dataset.railAlvo ?? null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // Distância sozinha classificava tremor de clique (mouse/trackpad) como arraste — exige
  // também um tempo mínimo percorrendo o limiar (arraste de verdade leva tempo pra
  // percorrer 5px; tremor de clique percorre a mesma distância em poucos ms).
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!arraste.current || !scrollRef.current) return;
    const dx = e.clientX - arraste.current.x;
    if (!arraste.current.moveu) {
      const dt = e.timeStamp - arraste.current.t;
      if (Math.abs(dx) < LIMIAR_ARRASTE_PX || dt < TEMPO_MIN_ARRASTE_MS) return;
      arraste.current.moveu = true;
      setArrastando(true);
    }
    scrollRef.current.scrollLeft = arraste.current.scrollLeft - dx;
  }

  // Dispara a ação AQUI, pelo alvo capturado no pointerdown — não espera o click nativo
  // (que já provou mirar errado quando o rail reflui no meio do gesto). `setTimeout(0)` zera
  // a ref DEPOIS que `onClickCapture` (mesmo gesto, dispara logo em seguida) já leu e
  // suprimiu o clique nativo redundante — zerar síncrono aqui deixaria esse clique passar
  // batido e disparar a ação uma 2ª vez.
  function onPointerUp() {
    setArrastando(false);
    const a = arraste.current;
    if (a && !a.moveu && a.alvo) {
      if (a.alvo === 'encaixe') onEncaixe();
      else onSelecionar(a.alvo);
    }
    setTimeout(() => { arraste.current = null; }, 0);
  }

  // Fase de captura: todo clique nativo que segue um gesto de ponteiro rastreado aqui já foi
  // despachado (ou ignorado, se foi arraste de verdade) no onPointerUp acima — deixá-lo
  // seguir dispararia a ação 2×, ou pior, no alvo ERRADO se o layout mudou por baixo do
  // cursor. `arraste.current` só fica `null` aqui pra clique por TECLADO (Enter/Espaço no
  // botão focado nunca passa por pointerdown) — esse não é tocado.
  function onClickCapture(e: React.MouseEvent) {
    if (arraste.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-6 py-5">
        {/* R-105a §4.2 — "Nenhum atendimento hoje." é uma frase de beco sem saída pra quem
            acabou de se cadastrar; na primeira sessão ela vira o convite. */}
        <p className={`flex-1 text-sm font-medium ${primeiraSessao ? 'text-text-primary' : 'text-text-secondary'}`}>
          {primeiraSessao ? 'Seu primeiro paciente entra por aqui.' : 'Nenhum atendimento hoje.'}
        </p>
        {/* I2 — rail vazio na primeira sessão é o ÚNICO estado em que o Encaixe é o realce
            (com slot na tela, quem acende é o campo mágico). */}
        <BotaoEncaixe onEncaixe={onEncaixe} primeiraSessao={primeiraSessao} aceso={primeiraSessao} />
      </div>
    );
  }

  const atual = slots.find((slot) => slot.agendamentoId === selecionadoId);
  return (
    <div className="relative min-w-0" data-meu-dia-fila>
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        className={`flex min-w-0 items-center gap-6 overflow-x-auto py-[11.25px] scrollbar-hide [scroll-snap-type:x_proximity] ${
          arrastando ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {slots.map((slot) => {
          const selecionado = slot.agendamentoId === selecionadoId;
          const semRegistro = slot.statusAgendamento === 'completed' && !slot.atendimentoRegistrado;
          return (
            <button
              key={slot.agendamentoId}
              type="button"
              data-rail-alvo={slot.agendamentoId}
              aria-pressed={selecionado}
              onClick={() => onSelecionar(slot.agendamentoId)}
              className={`min-h-10 shrink-0 rounded py-2 text-left text-[15px] [scroll-snap-align:start] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                selecionado ? 'font-bold text-teal-ink' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{slot.horario} · {slot.pacienteNome} · {STATUS_LABEL[slot.statusAgendamento] ?? slot.statusAgendamento}</span>
              {slot.atendimentoRegistrado && <span className="ml-2 text-[11px] text-teal-ink">✓ registrado</span>}
              {semRegistro && <span className="ml-2 text-[11px] text-coral">⚠ sem registro</span>}
            </button>
          );
        })}
        {atual && !atual.atendimentoRegistrado && (
          <select
            aria-label="Mudar status do atendimento"
            value={atual.statusAgendamento}
            onChange={(e) => onMudarStatus(atual.agendamentoId, e.target.value as AgendamentoStatus)}
            onClick={(e) => e.stopPropagation()}
            className="min-h-10 shrink-0 rounded-lg border border-border bg-surface px-3 text-[13px] text-text-secondary focus-visible:outline-2 focus-visible:outline-teal"
          >
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABEL[status] ?? status}</option>)}
          </select>
        )}
        <BotaoEncaixe onEncaixe={onEncaixe} primeiraSessao={primeiraSessao} />
      </div>
      {temMais && <span aria-hidden className="pointer-events-none absolute right-0 top-0 text-xs text-text-secondary">→</span>}
    </div>
  );
}
