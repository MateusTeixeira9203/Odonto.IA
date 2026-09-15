'use client';

// R-58 — hierarquia invertida: o texto da visita em evidência, procedimentos como suporte.
// C1 permanece: acordeão, nasce aberto, mostra só a ÚLTIMA visita por padrão (decisão dele
// 03/08: "a última evolução é a mais importante"), "ver mais" expande pra lista inteira sem
// sair da aba (profundidade 1). Cada `RegistroCard` tem sua PRÓPRIA expansão pro detalhe de
// especialidade (profundidade 2) — mesmo componente que a ficha do paciente usa (§4.3 do
// R-58: reusar, não recriar).
//
// R-46c — botão de colar histórico do Word mora no estado vazio (visitas.length === 0).
// Independente de pendência/orto por construção do cockpit (blocos separados).

import { useState } from 'react';
import { Check, ChevronDown, FileText, Forward } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RegistroCard } from '@/components/fichas/registro-card';
import { TextoExpansivel } from '@/components/fichas/texto-expansivel';
import { corpoEspecialidade } from '@/components/fichas/corpo-especialidade';
import { OrtoCard } from '@/components/fichas/orto-card';
import { eventosParaCards, type EventoParaCard } from '@/lib/odontograma/eventos-para-cards';
import type { MeuDiaVisita, MeuDiaEventoVisita, MeuDiaPendencia } from '@/server/dashboard/get-meu-dia';
import { rotuloProcedimento } from '@/types/odontograma';
import { fmtData } from './meu-dia-format';
import { ColarDoWordDialog } from '@/components/pacientes/colar-do-word-dialog';
import type { PendenciaPlanoView, PlanoTratamentoView } from '@/lib/meu-dia/plano-tratamento';

export interface HistoricoBlocoProps {
  visitas: MeuDiaVisita[];
  pacienteId: string;
  pacienteNome: string;
  onImportado: () => void;
  /** R-46h — abre o picker de orçamento SÓ desta ficha (mesmo padrão do FichasTab,
   *  onGerarOrcamento). Só chamado quando a visita tem indicado em aberto (abertos > 0) E é
   *  do próprio dentista (histórico é compartilhado, mas dinheiro nunca cruza dentista). */
  onGerarOrcamento: (fichaId: string) => void;
  meuDentistaId: string;
  /** Projeção completa e autorizada: plano, contador e contexto das visitas usam esta fonte. */
  plano: PlanoTratamentoView;
  /** Atualiza o evento já salvo pelas actions protegidas da ficha. */
  onSituacaoChange: (
    pendencia: MeuDiaPendencia,
    situacao: 'sessao_atual' | 'proxima_sessao',
  ) => void;
  /** Registro próprio ganha detalhes na Revisão antes de persistir como realizado. */
  onRegistrarHoje: (pendencia: MeuDiaPendencia) => void;
  /** Destino de encaminhamento só pode concluir pela RPC autorizada. */
  onConcluirEncaminhada: (pendencia: MeuDiaPendencia) => void;
  /** Última ação da sessão, mantida pelo pai para sobreviver ao refresh do servidor. */
  ultimaAcao: { descricao: string } | null;
  onDesfazerUltimaAcao: () => void;
  acoesEmAndamento: ReadonlySet<string>;
  /** Encaminhamento continua no mesmo plano: seleção explícita preserva a ação existente. */
  modoEncaminhar: boolean;
  selecionadosEncaminhar: Set<string>;
  onToggleModoEncaminhar: () => void;
  onToggleSelecaoEncaminhar: (id: string) => void;
  /** Abre a ficha de origem no prontuário, preservando Meu Dia no histórico do navegador. */
  onAbrirFicha: (fichaId: string) => void;
}

/** Adapta o view-model do Meu dia pro shape que `eventosParaCards`/`RegistroCard` esperam —
 *  mesmo padrão de `draftsParaCards` em FichasTab.tsx (cada chamador adapta seu tipo real).
 *  Assinatura/encaminhamento entram `null`: fora de escopo do histórico do Meu dia (R-58 §8
 *  — o prontuário oficial já cobre os dois). */
function paraCard(e: MeuDiaEventoVisita): EventoParaCard {
  return {
    id: e.id,
    grupoId: e.grupoId,
    tipo: e.tipo,
    procedimentoNome: e.procedimentoNome,
    status: e.status,
    ancora: {
      nivel: e.nivel,
      arcada: e.arcada ?? undefined,
      quadrante: e.quadrante ?? undefined,
      dente: e.dente ?? undefined,
      faces: e.faces,
    },
    origem: e.origem,
    momentoPlanejado: e.momento_planejado,
    observacao: e.observacao,
    detalhe: e.detalhe,
    realizadoEm: e.realizadoEm,
    registradoEm: e.registradoEm,
    assinaturaId: null,
    encaminhadoPara: null,
  };
}

function VisitaEntry({
  v, aberta, onToggle, onGerarOrcamento, meuDentistaId, pendenciasPorId,
  onSituacaoChange, onRegistrarHoje, onConcluirEncaminhada, acoesEmAndamento,
  modoEncaminhar, selecionadosEncaminhar, onToggleSelecaoEncaminhar, onAbrirFicha,
}: {
  v: MeuDiaVisita;
  aberta: boolean;
  onToggle: () => void;
  onGerarOrcamento: (fichaId: string) => void;
  meuDentistaId: string;
  pendenciasPorId: ReadonlyMap<string, PendenciaPlanoView>;
  onSituacaoChange: HistoricoBlocoProps['onSituacaoChange'];
  onRegistrarHoje: HistoricoBlocoProps['onRegistrarHoje'];
  onConcluirEncaminhada: HistoricoBlocoProps['onConcluirEncaminhada'];
  acoesEmAndamento: ReadonlySet<string>;
  modoEncaminhar: boolean;
  selecionadosEncaminhar: Set<string>;
  onToggleSelecaoEncaminhar: (id: string) => void;
  onAbrirFicha: (fichaId: string) => void;
}) {
  const texto = v.texto || v.resumo; // G9 — resumo sempre não-vazio (cai em 'Evolução' no pior caso)
  const abertos = v.eventos.filter((e) => e.status === 'indicado').length;

  const cardsFeito = eventosParaCards(
    [...v.eventos.filter((e) => e.status === 'realizado'), ...v.feitosAqui].map(paraCard),
    v.dentistaNome, null,
  );
  const cardsIdentificado = eventosParaCards(
    v.eventos.filter((e) => e.status === 'indicado').map(paraCard),
    v.dentistaNome, null,
  );
  // R-58 §2 — "indicada em DD/MM": só os cards com ao menos 1 evento de `feitosAqui`
  // (indicado numa ficha DIFERENTE desta) ganham a legenda.
  const indicadoEmPorId = new Map(v.feitosAqui.map((e) => [e.id, e.indicadoEm]));
  const pendenciasDaVisita = v.eventos
    .map((evento) => pendenciasPorId.get(evento.id))
    .filter((pendencia): pendencia is PendenciaPlanoView => pendencia != null);
  const resumoProcedimentos = [...v.eventos, ...v.feitosAqui]
    .map((evento) => {
      const local = evento.dente != null
        ? `dente ${evento.dente}`
        : evento.nivel === 'arcada'
          ? `arcada ${evento.arcada ?? ''}`.trim()
          : evento.nivel === 'quadrante'
            ? `quadrante ${evento.quadrante ?? ''}`.trim()
            : evento.nivel === 'boca'
              ? 'boca toda'
              : 'sem localização';
      return `${rotuloProcedimento(evento)} · ${local}`;
    })
    .filter((item, indice, itens) => itens.indexOf(item) === indice);

  return (
    <article className="rounded-xl border border-border bg-surface transition-colors">
      {/* 1. Cabeçalho */}
      <div className="flex items-start justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={aberta}
          className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-text-primary">{fmtData(v.data)}</span>
            <span className="truncate text-[11px] text-text-secondary">
              {v.importado ? 'Histórico importado' : v.dentistaNome}
            </span>
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-text-secondary transition-transform ${aberta ? 'rotate-180' : ''}`} />
          </span>
          {resumoProcedimentos.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {resumoProcedimentos.slice(0, 3).map((item) => (
                <span key={item} className="rounded-md bg-surface-alt px-2 py-1 text-[11px] font-semibold text-text-primary">
                  {item}
                </span>
              ))}
              {resumoProcedimentos.length > 3 && (
                <span className="rounded-md bg-surface-alt px-2 py-1 text-[11px] font-semibold text-text-secondary">
                  +{resumoProcedimentos.length - 3}
                </span>
              )}
            </span>
          )}
          <span className="mt-2 block text-[11px] font-bold text-teal-ink">
            {aberta ? 'Ocultar detalhes' : 'Ver detalhes da visita'}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* §4.4 — "nada" quando semPendencia: o silêncio é o estado bom, sem badge. */}
          {!v.semPendencia && (
            <span className="text-[10px] font-bold text-coral-ink">{abertos} em aberto</span>
          )}
          {/* R-46h — só quando há indicado em aberto E a ficha é do próprio dentista
              (histórico é compartilhado da clínica, mas dinheiro nunca cruza dentista —
              achado ao vivo 08/08). Abre o picker JÁ escopado pra esta ficha (mesmo padrão
              do FichasTab, nunca funde com outra visita). */}
          {abertos > 0 && v.dentistaId === meuDentistaId && (
            <button
              type="button"
              onClick={() => onGerarOrcamento(v.fichaId)}
              title="Gerar orçamento"
              className="rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-teal-ink transition-colors hover:bg-teal-pale"
            >
              Gerar orçamento
            </button>
          )}
          {/* R-46c (I3) — nunca se apresenta como atendimento: rótulo próprio, nunca o
              nome do dentista como se ele tivesse feito a consulta. */}
        </div>
      </div>

      {aberta && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">
          {/* 2. Texto — o elemento de maior peso da entrada (hierarquia invertida, §1a) */}
          <TextoExpansivel
            texto={texto}
            className="whitespace-pre-line text-sm text-text-primary"
            onAbrirGrande={() => onAbrirFicha(v.fichaId)}
          />

          {v.ortoManutencao && (
            <div className="rounded-xl border border-border bg-surface-alt/40 px-3 py-2.5">
              <OrtoCard valor={v.ortoManutencao} />
            </div>
          )}

      {/* 3. Feito nesta consulta — realizados desta ficha + fechados aqui, indicados alhures */}
          {cardsFeito.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Feito nesta consulta
          </p>
          {cardsFeito.map((card) => {
            const indicadoEm = card.ids.map((id) => indicadoEmPorId.get(id)).find(Boolean);
            return (
              <div key={card.key} className="flex flex-col gap-0.5">
                <RegistroCard data={card.data}>
                  {corpoEspecialidade(card.data.tipo, card.data.detalhe)}
                </RegistroCard>
                {indicadoEm && (
                  <p className="px-1 text-[11px] text-text-secondary">indicada em {fmtData(indicadoEm)}</p>
                )}
              </div>
            );
          })}
        </div>
          )}

      {/* 4. Identificado nesta consulta — indicados desta ficha, ainda abertos por construção */}
          {cardsIdentificado.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
            Identificado nesta consulta
          </p>
          {cardsIdentificado.map((card) => (
            <RegistroCard key={card.key} data={card.data}>
              {corpoEspecialidade(card.data.tipo, card.data.detalhe)}
            </RegistroCard>
          ))}
        </div>
          )}
          {pendenciasDaVisita.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Organizar pendências desta ficha
              </p>
              <AnimatePresence initial={false}>
              {pendenciasDaVisita.map((pendencia) => (
                <LinhaDoPlano
                  key={pendencia.pendencia.id}
                  item={pendencia}
                  onSituacaoChange={onSituacaoChange}
                  onRegistrarHoje={onRegistrarHoje}
                  onConcluirEncaminhada={onConcluirEncaminhada}
                  ocupada={acoesEmAndamento.has(pendencia.pendencia.id)}
                  modoEncaminhar={modoEncaminhar}
                  selecionada={selecionadosEncaminhar.has(pendencia.pendencia.id)}
                  onToggleSelecaoEncaminhar={onToggleSelecaoEncaminhar}
                />
              ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function localDaPendencia(pendencia: MeuDiaPendencia): string {
  if (pendencia.dente != null) return `dente ${pendencia.dente}`;
  if (pendencia.nivel === 'arcada') return `arcada ${pendencia.arcada ?? ''}`.trim();
  if (pendencia.nivel === 'quadrante') return `quadrante ${pendencia.quadrante ?? ''}`.trim();
  if (pendencia.nivel === 'boca') return 'boca toda';
  return 'sem localização';
}

function LinhaDoPlano({
  item, onSituacaoChange, onRegistrarHoje, onConcluirEncaminhada,
  ocupada, modoEncaminhar, selecionada, onToggleSelecaoEncaminhar,
}: {
  item: PendenciaPlanoView;
  onSituacaoChange: HistoricoBlocoProps['onSituacaoChange'];
  onRegistrarHoje: HistoricoBlocoProps['onRegistrarHoje'];
  onConcluirEncaminhada: HistoricoBlocoProps['onConcluirEncaminhada'];
  ocupada: boolean;
  modoEncaminhar: boolean;
  selecionada: boolean;
  onToggleSelecaoEncaminhar: (id: string) => void;
}) {
  const reduzirMovimento = useReducedMotion();
  const { pendencia, permissoes, responsavelNome } = item;
  const situacao = item.momentoEfetivo === 'proxima_sessao' ? 'proxima_sessao' : 'sessao_atual';
  const label = rotuloProcedimento(pendencia);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: reduzirMovimento ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduzirMovimento ? 0 : -4 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className={`rounded-xl border p-3 ${
      item.grupo === 'acompanhada'
        ? 'border-border bg-surface-alt/55'
        : situacao === 'proxima_sessao' ? 'border-warning/30 bg-warning-pale/20' : 'border-border bg-surface'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-xs font-bold text-text-primary">{label} · {localDaPendencia(pendencia)}</p>
          <p className="mt-1 text-[11px] text-text-secondary">
            {situacao === 'proxima_sessao' ? 'Separado para a próxima sessão' : `Em aberto desde ${fmtData(pendencia.registradoEm)}`}
            {' · '}{item.grupo === 'acompanhada' ? `responsável: ${responsavelNome}` : pendencia.dentistaNome}
            {item.grupo === 'recebida' && ' · encaminhado para você'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
          situacao === 'proxima_sessao' ? 'bg-warning-pale text-warning-ink' : 'bg-coral-pale text-coral-ink'
        }`}>
          {situacao === 'proxima_sessao' ? 'Próxima sessão' : 'A fazer'}
        </span>
      </div>
      {modoEncaminhar ? (
        permissoes.encaminhar ? (
          <button
            type="button"
            aria-pressed={selecionada}
            onClick={() => onToggleSelecaoEncaminhar(pendencia.id)}
            className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
              selecionada ? 'border-teal bg-teal/10 text-teal-ink' : 'border-border text-text-secondary hover:border-teal/35 hover:text-teal-ink'
            }`}
          >
            {selecionada ? '✓ Selecionado para encaminhar' : 'Selecionar para encaminhar'}
          </button>
        ) : <p className="mt-2 text-[11px] text-text-secondary">Acompanhamento somente leitura.</p>
      ) : (permissoes.alterarMomento || permissoes.registrarHoje || permissoes.concluirEncaminhada) ? <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-alt p-1 sm:flex sm:w-fit">
        {permissoes.alterarMomento && (
          <button
            type="button"
            disabled={ocupada}
            aria-pressed={situacao === 'sessao_atual'}
            onClick={() => onSituacaoChange(pendencia, 'sessao_atual')}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
              situacao === 'sessao_atual' ? 'bg-coral-pale text-coral-ink' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            A fazer
          </button>
        )}
        {permissoes.alterarMomento && (
          <button
            type="button"
            disabled={ocupada}
            aria-pressed={situacao === 'proxima_sessao'}
            onClick={() => onSituacaoChange(pendencia, 'proxima_sessao')}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 ${
              situacao === 'proxima_sessao' ? 'bg-warning-pale text-warning-ink' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          >
            Próxima sessão
          </button>
        )}
        {permissoes.registrarHoje ? (
          <button
            type="button"
            disabled={ocupada}
            onClick={() => onRegistrarHoje(pendencia)}
            className="rounded-md bg-teal/10 px-2.5 py-1.5 text-[11px] font-bold text-teal-ink transition-colors hover:bg-teal/20 disabled:opacity-50"
          >
            Registrar hoje
          </button>
        ) : permissoes.concluirEncaminhada ? (
          <button
            type="button"
            disabled={ocupada}
            onClick={() => onConcluirEncaminhada(pendencia)}
            className="rounded-md bg-teal/10 px-2.5 py-1.5 text-[11px] font-bold text-teal-ink transition-colors hover:bg-teal/20 disabled:opacity-50"
          >
            {ocupada ? 'Salvando…' : 'Concluir encaminhado'}
          </button>
        ) : null}
      </div> : null}
    </motion.article>
  );
}

export function HistoricoBloco({
  visitas, pacienteId, pacienteNome, onImportado, onGerarOrcamento, meuDentistaId,
  plano, onSituacaoChange, onRegistrarHoje, onConcluirEncaminhada,
  ultimaAcao, onDesfazerUltimaAcao, acoesEmAndamento, onAbrirFicha,
  modoEncaminhar, selecionadosEncaminhar, onToggleModoEncaminhar, onToggleSelecaoEncaminhar,
}: HistoricoBlocoProps) {
  const [visitaAberta, setVisitaAberta] = useState<string | null>(visitas[0]?.fichaId ?? null);
  const [colarAberto, setColarAberto] = useState(false);
  const pendenciasPorId = new Map(
    [...plano.minhaFila, ...plano.recebidas, ...plano.acompanhadas]
      .map((item) => [item.pendencia.id, item]),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="mb-4" aria-label="Plano de tratamento">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">Plano de tratamento</p>
          {(modoEncaminhar || plano.minhaFila.length > 0) && (
            <button type="button" onClick={onToggleModoEncaminhar} className="inline-flex items-center gap-1.5 rounded-lg border border-teal/35 bg-teal/10 px-2.5 py-1.5 text-[11px] font-bold text-teal-ink transition-colors hover:bg-teal/20"><Forward className="h-3.5 w-3.5" />{modoEncaminhar ? 'Cancelar encaminhamento' : 'Encaminhar procedimentos'}</button>
          )}
        </div>
        <p className="mt-1 text-xs text-text-secondary">Organizado automaticamente a partir das indicações clínicas.</p>
        {ultimaAcao && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-teal/25 bg-teal/10 px-3 py-2 text-xs font-semibold text-teal-ink">
            <span className="flex min-w-0 items-center gap-1.5 truncate"><Check className="h-3.5 w-3.5 shrink-0" />{ultimaAcao.descricao}</span>
            <button type="button" onClick={onDesfazerUltimaAcao} className="shrink-0 text-[11px] font-bold underline underline-offset-2 hover:text-text-primary">Desfazer</button>
          </div>
        )}
        {plano.total === 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary">Nenhum procedimento em aberto.</p>
        ) : (
          <div className="mt-3 grid gap-4">
        {plano.minhaFila.length > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between px-0.5"><p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Minha fila</p><span className="text-[11px] font-semibold text-text-secondary">{plano.minhaFila.length}</span></div>
            <div className="mt-2 grid gap-1.5"><AnimatePresence initial={false}>{plano.minhaFila.map((item) => <LinhaDoPlano key={item.pendencia.id} item={item} onSituacaoChange={onSituacaoChange} onRegistrarHoje={onRegistrarHoje} onConcluirEncaminhada={onConcluirEncaminhada} ocupada={acoesEmAndamento.has(item.pendencia.id)} modoEncaminhar={modoEncaminhar} selecionada={selecionadosEncaminhar.has(item.pendencia.id)} onToggleSelecaoEncaminhar={onToggleSelecaoEncaminhar} />)}</AnimatePresence></div>
          </div>
        )}
        {plano.recebidas.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between px-0.5"><p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Recebidos por encaminhamento</p><span className="text-[11px] font-semibold text-text-secondary">{plano.recebidas.length}</span></div>
            <div className="mt-2 grid gap-1.5"><AnimatePresence initial={false}>{plano.recebidas.map((item) => <LinhaDoPlano key={item.pendencia.id} item={item} onSituacaoChange={onSituacaoChange} onRegistrarHoje={onRegistrarHoje} onConcluirEncaminhada={onConcluirEncaminhada} ocupada={acoesEmAndamento.has(item.pendencia.id)} modoEncaminhar={modoEncaminhar} selecionada={false} onToggleSelecaoEncaminhar={onToggleSelecaoEncaminhar} />)}</AnimatePresence></div>
          </div>
        )}
        {plano.acompanhadas.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between px-0.5"><p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Acompanhados por outro dentista</p><span className="text-[11px] font-semibold text-text-secondary">{plano.acompanhadas.length}</span></div>
            <div className="mt-2 grid gap-1.5"><AnimatePresence initial={false}>{plano.acompanhadas.map((item) => <LinhaDoPlano key={item.pendencia.id} item={item} onSituacaoChange={onSituacaoChange} onRegistrarHoje={onRegistrarHoje} onConcluirEncaminhada={onConcluirEncaminhada} ocupada={false} modoEncaminhar={false} selecionada={false} onToggleSelecaoEncaminhar={onToggleSelecaoEncaminhar} />)}</AnimatePresence></div>
          </div>
        )}
          </div>
        )}
      </section>
      <div className="mb-3 border-t border-border pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Histórico clínico</p>
        <p className="mt-1 text-xs text-text-secondary">Visitas mais recentes primeiro, com contexto completo do tratamento.</p>
      </div>
      {visitas.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-secondary">
            Sem histórico no sistema ainda — o contexto nasce nesta consulta.
          </p>
          <button
            type="button"
            onClick={() => setColarAberto(true)}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
          >
            <FileText className="h-3.5 w-3.5" />
            Colar histórico do Word
          </button>
        </div>
      ) : (
          <div className="flex min-h-0 flex-col gap-2">
            {visitas.map((v) => (
              <VisitaEntry
                key={v.fichaId}
                v={v}
                aberta={visitaAberta === v.fichaId}
                onToggle={() => setVisitaAberta((atual) => atual === v.fichaId ? null : v.fichaId)}
                onGerarOrcamento={onGerarOrcamento}
                meuDentistaId={meuDentistaId}
                pendenciasPorId={pendenciasPorId}
                onSituacaoChange={onSituacaoChange}
                onRegistrarHoje={onRegistrarHoje}
                onConcluirEncaminhada={onConcluirEncaminhada}
                acoesEmAndamento={acoesEmAndamento}
                modoEncaminhar={modoEncaminhar}
                selecionadosEncaminhar={selecionadosEncaminhar}
                onToggleSelecaoEncaminhar={onToggleSelecaoEncaminhar}
                onAbrirFicha={onAbrirFicha}
              />
            ))}
          </div>
      )}

      <ColarDoWordDialog
        pacienteId={pacienteId}
        pacienteNome={pacienteNome}
        open={colarAberto}
        onOpenChange={setColarAberto}
        onImportado={onImportado}
      />
    </div>
  );
}
