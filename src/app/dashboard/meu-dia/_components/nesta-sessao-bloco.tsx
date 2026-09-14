'use client';

// R-78 F1 (08/08) — "Nesta ficha" vira o mesmo card-fonte da ficha salva (`RegistroCard`,
// R-02 I1: "o mesmo componente desenha criação E leitura"), em vez do `ToothGroupList`
// só-leitura que F0 usou como placeholder. Pill de status clicável, observação editável
// inline, detalhe de especialidade colapsável — tudo já pronto no `RegistroCard`
// (`editavel`), só faltava alguém no Meu dia chamar com os handlers certos. Mesmo padrão
// que `FichasTab.tsx` já usa pro rascunho dela (`draftsParaCards`/`renderCardDraft`) — aqui
// reusa `eventosParaCards` (a versão genérica e exportada, R-58) com o adaptador inline em
// vez de duplicar uma função idêntica só pra este card.
//
// `onDenteClick` SAIU: o gesto de abrir o perfil do dente agora é só tocar o dente no
// espelho (F2) — a lista não tem mais motivo pra abrir o mesmo painel por um caminho
// paralelo.
//
// R-78 (achado dele 08/08, testando ao vivo) — tabela de especialidade (endo/implante)
// NÃO expande mais inline aqui: essa coluna (~832px, mas o card em si é bem mais estreito
// que isso) espreme demais uma ficha endodôntica de verdade (mesmo problema §1.4/§1.5 da
// spec, agora concreto). O card com detalhe vira `onAbrirGrande` — ⤢ leva pro perfil do
// dente (`ToothDetailPanel`, mais largo, já testado como o editor de faces/chips) com a
// tabela já expandida, em vez de `children` (que só sobra pros cards sem detalhe — hoje
// nenhum, mas o mecanismo do RegistroCard continua aí pra quem precisar).

import { useState } from 'react';
import { Forward } from 'lucide-react';
import type { OdontogramaEventoDraft } from '@/types/odontograma';
import { RegistroCard } from '@/components/fichas/registro-card';
import { OrtoCard } from '@/components/fichas/orto-card';
import { EncaminharBar } from '@/components/fichas/encaminhar-bar';
import { eventosParaCards, type EventoParaCard } from '@/lib/odontograma/eventos-para-cards';
import { hojeBRT } from '@/lib/hora-brt';
import type { OrtoManutencaoDetalhe } from '@/lib/especialidades/orto';

export interface NestaSessaoBlocoProps {
  vazio: string;
  eventosDraft: OdontogramaEventoDraft[];
  onEventosDraftChange: (eventos: OdontogramaEventoDraft[]) => void;
  textoVisita: string;
  onTextoVisitaChange: (texto: string) => void;
  ortoManutencao: OrtoManutencaoDetalhe | null;
  onEditarOrto: () => void;
  /** R-78 — ⤢ num card com tabela de especialidade chama isto em vez de expandir aqui. */
  onAbrirDenteGrande: (dente: number, eventoId: string) => void;
  /** R-84 §3/§4 — ids que JÁ EXISTIAM no banco antes desta sessão (boca, R-61). Card com
   *  qualquer id aqui é trabalho de ficha anterior sendo fechado hoje, não indicação nova
   *  desta ficha — ganha a legenda "de consulta anterior", mesmo card, mesma lista. */
  idsDeAntes: ReadonlySet<string>;
  /** Destinos clínicos já filtrados no servidor: dentistas ativos da mesma clínica, sem o autor. */
  destinosEncaminhar: { id: string; nome: string; especialidade?: string }[];
  /** R-108b (artefato bloco 7) — `eventoId → nome do tratamento`. A legenda genérica "de
   *  consulta anterior" vira "→ Reabilitação inf. direita": a pendência passa a dizer PRA ONDE
   *  ela volta, que é a pergunta que a tela deixa de fazer. Fica no fallback antigo quando o
   *  evento não tem tratamento resolvível (ficha só-texto). */
  nomeTratamentoPorEvento: Readonly<Record<string, string>>;
}

/** `OdontogramaEventoDraft` é snake_case (`grupo_id`/`realizado_em`) — `EventoParaCard` não
 *  é. Mesmo adaptador que `historico-bloco.tsx`/`corpo-especialidade` já fazem pros seus
 *  tipos; `registradoEm` usa "agora" porque o rascunho ainda não foi salvo (mesma lógica
 *  de `draftsParaCards` no FichasTab). */
function paraCard(
  e: OdontogramaEventoDraft,
  destinosEncaminhar: NestaSessaoBlocoProps['destinosEncaminhar'],
): EventoParaCard {
  return {
    id: e.id,
    grupoId: e.grupo_id,
    tipo: e.tipo,
    procedimentoNome: e.procedimentoNome,
    status: e.status,
    ancora: e.ancora,
    origem: e.origem,
    momentoPlanejado: e.momento_planejado,
    observacao: e.observacao,
    detalhe: e.detalhe,
    realizadoEm: e.realizado_em,
    registradoEm: new Date().toISOString(),
    assinaturaId: e.assinaturaId ?? null,
    encaminhadoPara: e.encaminhadoParaId
      ? destinosEncaminhar.find((destino) => destino.id === e.encaminhadoParaId) ?? null
      : null,
    revisar_status: e.revisar_status,
  };
}

const TEM_DETALHE = new Set(['endodontia', 'implante', 'exame_periodontal']);

export function NestaSessaoBloco({
  vazio,
  eventosDraft,
  onEventosDraftChange,
  textoVisita,
  onTextoVisitaChange,
  ortoManutencao,
  onEditarOrto,
  onAbrirDenteGrande,
  idsDeAntes,
  destinosEncaminhar,
  nomeTratamentoPorEvento,
}: NestaSessaoBlocoProps) {
  const [modoEncaminhar, setModoEncaminhar] = useState(false);
  const [selecionadosEncaminhar, setSelecionadosEncaminhar] = useState<Set<string>>(new Set());
  const [destinoEncaminhar, setDestinoEncaminhar] = useState<string | null>(null);
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [modoAlterarVarios, setModoAlterarVarios] = useState(false);
  const [selecionadosSituacao, setSelecionadosSituacao] = useState<Set<string>>(new Set());
  const [eventosAntesDaAcao, setEventosAntesDaAcao] = useState<OdontogramaEventoDraft[] | null>(null);

  function sairModoEncaminhar() {
    setModoEncaminhar(false);
    setSelecionadosEncaminhar(new Set());
    setDestinoEncaminhar(null);
  }
  function definirSituacao(
    ids: string[],
    situacao: 'sessao_atual' | 'proxima_sessao' | 'realizado',
  ) {
    onEventosDraftChange(eventosNaSituacao(ids, situacao));
  }
  function eventosNaSituacao(
    ids: string[],
    situacao: 'sessao_atual' | 'proxima_sessao' | 'realizado',
  ): OdontogramaEventoDraft[] {
    return eventosDraft.map((evento) => {
      if (!ids.includes(evento.id)) return evento;
      if (situacao === 'realizado') {
        return {
          ...evento,
          status: 'realizado',
          origem: 'clinica',
          momento_planejado: 'sessao_atual',
          revisar_status: false,
          realizado_em: evento.realizado_em ?? hojeBRT(),
        };
      }
      return {
        ...evento,
        status: 'indicado',
        momento_planejado: situacao,
        revisar_status: false,
        realizado_em: null,
      };
    });
  }
  function updateObservacao(ids: string[], observacao: string) {
    onEventosDraftChange(eventosDraft.map((e) => (ids.includes(e.id) ? { ...e, observacao } : e)));
  }
  function remover(ids: string[]) {
    onEventosDraftChange(eventosDraft.filter((e) => !ids.includes(e.id)));
    setCardAberto(null);
  }
  function aplicarSituacaoSelecionados(situacao: 'sessao_atual' | 'proxima_sessao' | 'realizado') {
    const idsSelecionados = cards
      .filter(({ key }) => selecionadosSituacao.has(key))
      .flatMap(({ ids }) => ids);
    if (idsSelecionados.length === 0) return;
    setEventosAntesDaAcao(eventosDraft);
    onEventosDraftChange(eventosNaSituacao(idsSelecionados, situacao));
    setModoAlterarVarios(false);
    setSelecionadosSituacao(new Set());
  }
  function desfazerAcaoEmMassa() {
    if (!eventosAntesDaAcao) return;
    onEventosDraftChange(eventosAntesDaAcao);
    setEventosAntesDaAcao(null);
  }

  if (eventosDraft.length === 0 && !textoVisita.trim() && ortoManutencao == null) {
    return <p className="text-sm text-text-secondary">{vazio}</p>;
  }

  const cards = eventosParaCards(
    eventosDraft.map((evento) => paraCard(evento, destinosEncaminhar)),
    'Você',
    null,
  );
  const temIndicado = eventosDraft.some((e) => e.status === 'indicado');
  const temRealizado = eventosDraft.some((e) => e.status === 'realizado');
  const totalRegistros = cards.length + (ortoManutencao ? 1 : 0);
  // R-140b — a revisão é organizada pelo estado clínico; a origem da ficha anterior
  // continua aparecendo como metadado do card, sem criar uma quarta seção.
  const cardsFeitos = cards.filter(({ data }) => data.status === 'realizado' && data.origem === 'clinica');
  const cardsAFazer = cards.filter(({ data }) => data.status === 'indicado');
  const cardsCondicoes = cards.filter(({ data }) => data.status === 'realizado' && data.origem === 'preexistente');
  const cardsEncaminhaveis = cards.filter(({ ids, data }) =>
    data.status === 'indicado'
    && data.encaminhadoPara == null
    && ids.every((id) => !idsDeAntes.has(id)),
  );
  const cardsComSituacao = cards.filter(({ data }) => data.origem === 'clinica' && !data.statusMisto);

  function sairModoAlterarVarios() {
    setModoAlterarVarios(false);
    setSelecionadosSituacao(new Set());
  }

  function toggleSelecaoSituacao(key: string) {
    setSelecionadosSituacao((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(key)) proximo.delete(key); else proximo.add(key);
      return proximo;
    });
  }

  function toggleSelecaoEncaminhar(key: string) {
    setSelecionadosEncaminhar((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(key)) proximo.delete(key); else proximo.add(key);
      return proximo;
    });
  }

  function selecionarTodosEncaminhaveis() {
    setSelecionadosEncaminhar(new Set(cardsEncaminhaveis.map(({ key }) => key)));
  }

  function confirmarEncaminhamento() {
    if (destinoEncaminhar == null || selecionadosEncaminhar.size === 0) return;
    const idsSelecionados = new Set(
      cards
        .filter(({ key }) => selecionadosEncaminhar.has(key))
        .flatMap(({ ids }) => ids),
    );
    onEventosDraftChange(eventosDraft.map((evento) => (
      idsSelecionados.has(evento.id)
        ? { ...evento, encaminhadoParaId: destinoEncaminhar }
        : evento
    )));
    sairModoEncaminhar();
  }

  function removerEncaminhamento(ids: string[]) {
    onEventosDraftChange(eventosDraft.map((evento) => (
      ids.includes(evento.id)
        ? { ...evento, encaminhadoParaId: null }
        : evento
    )));
  }

  function renderCards(lista: typeof cards) {
    return lista.map(({ key, ids, data }) => {
      // Só registro de UM evento tem "o" dente e "a" tabela pra abrir — grupo
      // multi-dente (ponte etc.) não tem um perfil único pra ir (mesma regra de
      // FichasTab.tsx, renderCardDraft).
      const dente = ids.length === 1 ? data.ancoras[0]?.dente : undefined;
      const temDetalhe = dente != null && TEM_DETALHE.has(data.tipo);
      // R-84 §4 — grupo misto (ex: ponte que ganhou elemento novo hoje) conta como "de
      // antes" pra marca visual: QUALQUER id do card já existia no banco.
      const deAntes = ids.some((id) => idsDeAntes.has(id));
      // Grupo (ponte etc.) nasce inteiro numa ficha só — o 1º id resolvido basta.
      const tratamento = deAntes
        ? ids.map((id) => nomeTratamentoPorEvento[id]).find(Boolean)
        : undefined;
      const selecionavelParaSituacao = modoAlterarVarios && data.origem === 'clinica' && !data.statusMisto;
      const selecionavelParaEncaminhar = modoEncaminhar && cardsEncaminhaveis.some((card) => card.key === key);
      return (
        <div key={key} data-dex-eventos={ids.join(' ')} tabIndex={-1} className={`flex scroll-mt-6 scroll-mb-28 flex-col gap-0.5 focus-visible:outline-teal ${cardAberto === key ? 'col-span-full' : ''}`}>
          <RegistroCard
            data={data}
            editavel
            compacto
            aberto={cardAberto === key}
            onAbertoChange={(aberto) => setCardAberto(aberto ? key : null)}
            selecionavel={selecionavelParaSituacao || selecionavelParaEncaminhar}
            selecionado={selecionavelParaSituacao ? selecionadosSituacao.has(key) : selecionadosEncaminhar.has(key)}
            onToggleSelecao={selecionavelParaSituacao
              ? () => toggleSelecaoSituacao(key)
              : selecionavelParaEncaminhar
                ? () => toggleSelecaoEncaminhar(key)
                : undefined}
            onSituacaoChange={
              !modoEncaminhar && !modoAlterarVarios && data.origem === 'clinica'
                ? (situacao) => definirSituacao(ids, situacao)
                : undefined
            }
            onObservacaoChange={modoEncaminhar || modoAlterarVarios ? undefined : (v) => updateObservacao(ids, v)}
            onRemover={modoEncaminhar || modoAlterarVarios ? undefined : () => remover(ids)}
            onRemoverEncaminhamento={
              !modoEncaminhar && data.encaminhadoPara ? () => removerEncaminhamento(ids) : undefined
            }
            onAbrirGrande={modoEncaminhar || modoAlterarVarios ? undefined : temDetalhe ? () => onAbrirDenteGrande(dente, ids[0]) : undefined}
          />
          {deAntes && (
            // Artefato bloco 7: DM Mono 11.5px, --tx3, 2px abaixo do card.
            <p className="mt-0.5 px-1 font-mono text-[11.5px] text-text-secondary">
              {tratamento ? `→ ${tratamento}` : 'de consulta anterior'}
            </p>
          )}
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {(temIndicado || temRealizado) && (
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <p className="text-[11px] font-semibold text-text-secondary">
            {totalRegistros} {totalRegistros === 1 ? 'registro' : 'registros'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
          {!modoEncaminhar && !modoAlterarVarios && cardsEncaminhaveis.length > 0 && destinosEncaminhar.length > 0 && (
            <button
              type="button"
              onClick={() => setModoEncaminhar(true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-teal/30 bg-teal-pale px-3 py-1 text-[11px] font-bold text-teal-ink transition-colors hover:bg-teal/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <Forward className="h-3.5 w-3.5" />
              Encaminhar
            </button>
          )}
          {!modoEncaminhar && !modoAlterarVarios && cardsComSituacao.length > 1 && (
            <button
              type="button"
              onClick={() => setModoAlterarVarios(true)}
              className="min-h-11 rounded-lg px-3 py-1 text-[11px] font-bold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Alterar vários
            </button>
          )}
          {modoAlterarVarios && (
            <button
              type="button"
              onClick={() => setSelecionadosSituacao((atual) => atual.size === cardsComSituacao.length
                ? new Set()
                : new Set(cardsComSituacao.map(({ key }) => key)))}
              className="min-h-11 rounded-lg px-3 py-1 text-[11px] font-bold text-teal-ink transition-colors hover:bg-teal-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {selecionadosSituacao.size === cardsComSituacao.length ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
          )}
          </div>
        </div>
      )}
      {eventosAntesDaAcao && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary" role="status">
          <span>Alteração em massa aplicada.</span>
          <button
            type="button"
            onClick={desfazerAcaoEmMassa}
            className="min-h-11 rounded-lg px-3 font-bold text-teal-ink hover:bg-teal-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            Desfazer
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 pr-1">
        {(cardsFeitos.length > 0 || ortoManutencao != null) && (
          <section className="grid grid-cols-1 gap-2" aria-label="Feito hoje">
            <p className="col-span-full px-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
              Feito hoje
            </p>
            {renderCards(cardsFeitos)}
            {ortoManutencao && (
              <article className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Manutenção ortodôntica</p>
                    <p className="mt-0.5 text-xs text-text-secondary">Registro clínico da consulta</p>
                  </div>
                  <button
                    type="button"
                    onClick={onEditarOrto}
                    className="min-h-9 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                  >
                    Editar manutenção
                  </button>
                </div>
                <OrtoCard valor={ortoManutencao} />
              </article>
            )}
          </section>
        )}
        {cardsAFazer.length > 0 && (
          <section className="grid grid-cols-1 gap-2" aria-label="A fazer">
            <p className="col-span-full px-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
              A fazer
            </p>
            {renderCards(cardsAFazer)}
          </section>
        )}
        {cardsCondicoes.length > 0 && (
          <section className="grid grid-cols-1 gap-2" aria-label="Condições existentes">
            <p className="col-span-full px-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
              Condições existentes
            </p>
            {renderCards(cardsCondicoes)}
          </section>
        )}
        {textoVisita.trim() && (
          <section aria-label="Evolução clínica">
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary">
              Evolução clínica
            </p>
            <div className="rounded-xl border border-border bg-surface-alt px-3 py-2.5">
              <textarea
                value={textoVisita}
                onChange={(event) => onTextoVisitaChange(event.target.value)}
                aria-label="Editar evolução clínica"
                rows={3}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary outline-none"
              />
            </div>
          </section>
        )}
      </div>
      {modoAlterarVarios && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3 sm:flex-row sm:items-center sm:justify-between" role="group" aria-label="Alterar situação de vários procedimentos">
          <span className="text-xs font-semibold text-text-secondary">
            {selecionadosSituacao.size} selecionado{selecionadosSituacao.size === 1 ? '' : 's'}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button type="button" disabled={selecionadosSituacao.size === 0} onClick={() => aplicarSituacaoSelecionados('sessao_atual')} className="min-h-11 rounded-lg px-3 text-[11px] font-bold text-coral-ink hover:bg-coral-pale disabled:opacity-40">A fazer</button>
            <button type="button" disabled={selecionadosSituacao.size === 0} onClick={() => aplicarSituacaoSelecionados('proxima_sessao')} className="min-h-11 rounded-lg px-3 text-[11px] font-bold text-warning-ink hover:bg-warning-pale disabled:opacity-40">Próxima sessão</button>
            <button type="button" disabled={selecionadosSituacao.size === 0} onClick={() => aplicarSituacaoSelecionados('realizado')} className="min-h-11 rounded-lg px-3 text-[11px] font-bold text-teal-ink hover:bg-teal-pale disabled:opacity-40">Realizado</button>
            <button type="button" onClick={sairModoAlterarVarios} className="min-h-11 rounded-lg px-3 text-[11px] font-bold text-text-secondary hover:bg-surface">Cancelar</button>
          </div>
        </div>
      )}
      {modoEncaminhar && (
        <EncaminharBar
          totalSelecionado={selecionadosEncaminhar.size}
          totalEncaminhavel={cardsEncaminhaveis.length}
          destinosDisponiveis={destinosEncaminhar}
          destino={destinoEncaminhar}
          onDestino={setDestinoEncaminhar}
          onSelecionarTudo={() => {
            if (selecionadosEncaminhar.size >= cardsEncaminhaveis.length) {
              setSelecionadosEncaminhar(new Set());
            } else {
              selecionarTodosEncaminhaveis();
            }
          }}
          onLimpar={() => setSelecionadosEncaminhar(new Set())}
          onConfirmar={confirmarEncaminhamento}
          onSair={sairModoEncaminhar}
        />
      )}
    </div>
  );
}
