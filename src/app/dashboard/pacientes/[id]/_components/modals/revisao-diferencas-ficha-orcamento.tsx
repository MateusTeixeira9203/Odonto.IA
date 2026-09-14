'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  dispensarRetiradaDoOrcamento,
  resolverRenomeacaoDoOrcamento,
  retirarProcedimentoDoOrcamento,
  vincularEventosLegadosAoItem,
  type DiferencasFichaOrcamento,
} from '@/server/orcamentos/ficha-orcamento-actions';
import type { OrcamentoItem } from '../types';

type PreviaFinanceira = {
  total: number;
  recebido: number;
  saldo: number;
  etapas_abertas: number;
  motivo: 'confirmacao_necessaria' | 'valor_abaixo_recebido';
  total_antes: number;
  total_depois: number;
  devido_antes: number;
  devido_depois: number;
};

type RetiradaEmRevisao = {
  itemId: string;
  eventoIds: string[];
  titulo: string;
  apenasComercial: boolean;
};

type Props = {
  diferencas: DiferencasFichaOrcamento;
  itens: OrcamentoItem[];
  onAtualizado: () => Promise<void>;
  onAjustarAcordo: () => void;
  onRevisarAdicao: () => void;
};

function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataCurta(data: string): string {
  const valor = new Date(data);
  return Number.isNaN(valor.getTime()) ? 'data não disponível' : valor.toLocaleDateString('pt-BR');
}

export function RevisaoDiferencasFichaOrcamento({ diferencas, itens, onAtualizado, onAjustarAcordo, onRevisarAdicao }: Props) {
  const tituloId = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const operacaoEmCursoRef = useRef(false);
  const retiradaRef = useRef<HTMLDivElement>(null);
  const [itemLegadoPorEvento, setItemLegadoPorEvento] = useState<Record<string, string>>({});
  const [eventosLegadosPorEvento, setEventosLegadosPorEvento] = useState<Record<string, string[]>>({});
  const [retirada, setRetirada] = useState<RetiradaEmRevisao | null>(null);
  const [escopoConfirmado, setEscopoConfirmado] = useState(false);
  const [previa, setPrevia] = useState<PreviaFinanceira | null>(null);

  useEffect(() => {
    if (retirada) retiradaRef.current?.focus();
  }, [retirada]);

  const itensPorId = useMemo(() => new Map(itens.map((item) => [item.id, item])), [itens]);
  const vinculosPorItem = useMemo(() => {
    const mapa = new Map<string, DiferencasFichaOrcamento['vinculos']>();
    for (const vinculo of diferencas.vinculos) {
      if (!vinculo.itemId) continue;
      const atuais = mapa.get(vinculo.itemId) ?? [];
      atuais.push(vinculo);
      mapa.set(vinculo.itemId, atuais);
    }
    return mapa;
  }, [diferencas.vinculos]);
  const vinculosLegados = useMemo(
    () => diferencas.vinculos.filter((vinculo) => vinculo.itemId === null),
    [diferencas.vinculos],
  );

  function iniciarOperacao(chave: string): boolean {
    if (operacaoEmCursoRef.current) return false;
    operacaoEmCursoRef.current = true;
    setSalvando(chave);
    setErro(null);
    return true;
  }

  function finalizarOperacao(): void {
    operacaoEmCursoRef.current = false;
    setSalvando(null);
  }

  async function resolverNome(alteracao: DiferencasFichaOrcamento['renomeacoesPendentes'][number], manterNomeHistorico: boolean): Promise<void> {
    if (!alteracao.itemId || !iniciarOperacao(`nome:${alteracao.alteracaoId}`)) return;
    try {
      const resultado = await resolverRenomeacaoDoOrcamento({
        fichaId: diferencas.fichaId,
        orcamentoId: diferencas.orcamentoId,
        eventoId: alteracao.eventoId,
        itemId: alteracao.itemId,
        alteracaoId: alteracao.alteracaoId,
        nomeAtual: alteracao.nomeAtual,
        manterNomeHistorico,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      await onAtualizado();
    } catch {
      setErro('Não foi possível registrar a decisão sobre o nome. Sua escolha foi mantida; tente novamente.');
    } finally {
      finalizarOperacao();
    }
  }

  async function vincularLegado(eventoId: string): Promise<void> {
    const itemId = itemLegadoPorEvento[eventoId];
    const eventoIds = eventosLegadosPorEvento[eventoId] ?? [eventoId];
    if (!itemId || !eventoIds.includes(eventoId)) {
      setErro('Selecione uma linha comercial e inclua o procedimento que será vinculado.');
      return;
    }
    if (!iniciarOperacao(`legado:${eventoId}`)) return;
    try {
      const resultado = await vincularEventosLegadosAoItem({
        fichaId: diferencas.fichaId,
        orcamentoId: diferencas.orcamentoId,
        itemId,
        eventoIds,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      await onAtualizado();
    } catch {
      setErro('Não foi possível confirmar o vínculo legado. Sua seleção foi mantida; tente novamente.');
    } finally {
      finalizarOperacao();
    }
  }

  function iniciarRetirada(itemId: string, eventoIds: string[], titulo: string, apenasComercial: boolean): void {
    if (operacaoEmCursoRef.current) return;
    setErro(null);
    setPrevia(null);
    setEscopoConfirmado(false);
    setRetirada({ itemId, eventoIds, titulo, apenasComercial });
  }

  async function confirmarRetirada(confirmarAjusteFinanceiro: boolean): Promise<void> {
    if (!retirada || !escopoConfirmado || !iniciarOperacao(`retirada:${retirada.itemId}`)) return;
    try {
      const resultado = await retirarProcedimentoDoOrcamento({
        fichaId: diferencas.fichaId,
        orcamentoId: diferencas.orcamentoId,
        itemId: retirada.itemId,
        eventoIds: retirada.eventoIds,
        versaoEsperada: diferencas.versaoOrcamento,
        confirmarAjusteFinanceiro,
      });
      if (!resultado.ok) {
        if (resultado.code === 'REVISAR_COBRANCA') {
          setPrevia(resultado.previa);
          return;
        }
        setErro(resultado.error);
        return;
      }
      setRetirada(null);
      setPrevia(null);
      await onAtualizado();
    } catch {
      setErro('Não foi possível confirmar a retirada. A revisão e o escopo foram mantidos; tente novamente.');
    } finally {
      finalizarOperacao();
    }
  }

  async function manterRetirada(alteracao: DiferencasFichaOrcamento['retiradasPendentes'][number]): Promise<void> {
    if (!iniciarOperacao(`manter:${alteracao.alteracaoId}`)) return;
    try {
      const resultado = await dispensarRetiradaDoOrcamento({
        fichaId: diferencas.fichaId,
        orcamentoId: diferencas.orcamentoId,
        eventoId: alteracao.eventoId,
        alteracaoId: alteracao.alteracaoId,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      await onAtualizado();
    } catch {
      setErro('Não foi possível manter este procedimento no orçamento. Tente novamente.');
    } finally {
      finalizarOperacao();
    }
  }

  const temRevisao = diferencas.faltantes.length > 0
    || diferencas.renomeacoesPendentes.length > 0
    || diferencas.retiradasPendentes.length > 0
    || diferencas.vinculos.length > 0;
  if (!temRevisao) return null;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-alt/40 p-3" aria-labelledby={tituloId}>
      <div>
        <p id={tituloId} className="text-sm font-semibold text-text-primary">Revisão da ficha</p>
        <p className="mt-1 text-xs text-text-secondary">Cada decisão altera somente o orçamento. O registro clínico continua preservado.</p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

      <fieldset disabled={salvando !== null} className="contents">
      <legend className="sr-only">Ações da revisão do orçamento</legend>

      {diferencas.faltantes.length > 0 && (
        <div className="rounded-lg border border-warning/50 bg-card p-3">
          <p className="font-semibold text-warning-ink">Há {diferencas.faltantes.length} procedimento{diferencas.faltantes.length === 1 ? '' : 's'} nesta ficha que ainda não está neste orçamento.</p>
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {diferencas.faltantes.map((faltante) => (
              <li key={faltante.eventoId}>{faltante.nome} · {faltante.local} · Adicionado à ficha em {dataCurta(faltante.adicionadoEm)}</li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" className="mt-3 min-h-11 border-warning text-warning-ink hover:bg-warning-pale" onClick={onRevisarAdicao}>
            Revisar e adicionar
          </Button>
        </div>
      )}

      {diferencas.renomeacoesPendentes.map((alteracao) => (
        <div key={alteracao.alteracaoId} className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-semibold text-text-primary">Nome clínico alterado</p>
          <p className="mt-1 text-xs text-text-secondary">{alteracao.nomeAnterior} → <strong className="text-text-primary">{alteracao.nomeAtual}</strong></p>
          {alteracao.itemId && (vinculosPorItem.get(alteracao.itemId)?.length ?? 0) > 1 && (
            <div className="mt-2 rounded-md bg-surface-alt p-2 text-xs text-text-secondary">
              <p className="font-semibold text-text-primary">Este item comercial reúne {vinculosPorItem.get(alteracao.itemId)?.length} procedimentos:</p>
              <ul className="mt-1 space-y-1">
                {vinculosPorItem.get(alteracao.itemId)?.map((vinculo) => <li key={vinculo.eventoId}>{vinculo.nome} · {vinculo.local}</li>)}
              </ul>
              <p className="mt-1">Aplicar o nome exige um item de um único procedimento; manter a descrição atual não altera o grupo.</p>
            </div>
          )}
          {alteracao.itemId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="min-h-11" disabled={salvando === `nome:${alteracao.alteracaoId}`} onClick={() => void resolverNome(alteracao, false)}>
                {salvando === `nome:${alteracao.alteracaoId}` && <Loader2 className="h-4 w-4 animate-spin" />} Aplicar nome ao orçamento
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" disabled={salvando === `nome:${alteracao.alteracaoId}`} onClick={() => void resolverNome(alteracao, true)}>
                Manter descrição do orçamento
              </Button>
            </div>
          ) : (
            <VinculoLegado
              eventoId={alteracao.eventoId}
              itens={itens}
              vinculosLegados={vinculosLegados}
              itemId={itemLegadoPorEvento[alteracao.eventoId] ?? ''}
              eventoIds={eventosLegadosPorEvento[alteracao.eventoId] ?? [alteracao.eventoId]}
              salvando={salvando === `legado:${alteracao.eventoId}`}
              onItemChange={(itemId) => setItemLegadoPorEvento((atual) => ({ ...atual, [alteracao.eventoId]: itemId }))}
              onEventosChange={(eventoIds) => setEventosLegadosPorEvento((atual) => ({ ...atual, [alteracao.eventoId]: eventoIds }))}
              onVincular={() => void vincularLegado(alteracao.eventoId)}
            />
          )}
        </div>
      ))}

      {diferencas.retiradasPendentes.map((alteracao) => {
        const eventosDoItem = alteracao.itemId ? vinculosPorItem.get(alteracao.itemId) ?? [] : [];
        return (
          <div key={alteracao.alteracaoId} className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-semibold text-text-primary">Este procedimento foi retirado da ficha e continua neste orçamento</p>
            <p className="mt-1 text-xs text-text-secondary">{alteracao.nome} · retirada em {dataCurta(alteracao.retiradoEm)}</p>
            {alteracao.itemId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="min-h-11" onClick={() => iniciarRetirada(alteracao.itemId!, eventosDoItem.map((evento) => evento.eventoId), alteracao.nome, false)}>
                  Revisar remoção
                </Button>
                <Button size="sm" variant="outline" className="min-h-11" disabled={salvando === `manter:${alteracao.alteracaoId}`} onClick={() => void manterRetirada(alteracao)}>
                  {salvando === `manter:${alteracao.alteracaoId}` && <Loader2 className="h-4 w-4 animate-spin" />} Manter no orçamento
                </Button>
              </div>
            ) : (
              <VinculoLegado
                eventoId={alteracao.eventoId}
                itens={itens}
                vinculosLegados={vinculosLegados}
                itemId={itemLegadoPorEvento[alteracao.eventoId] ?? ''}
                eventoIds={eventosLegadosPorEvento[alteracao.eventoId] ?? [alteracao.eventoId]}
                salvando={salvando === `legado:${alteracao.eventoId}`}
                onItemChange={(itemId) => setItemLegadoPorEvento((atual) => ({ ...atual, [alteracao.eventoId]: itemId }))}
                onEventosChange={(eventoIds) => setEventosLegadosPorEvento((atual) => ({ ...atual, [alteracao.eventoId]: eventoIds }))}
                onVincular={() => void vincularLegado(alteracao.eventoId)}
              />
            )}
          </div>
        );
      })}

      {retirada && (
        <div ref={retiradaRef} tabIndex={-1} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RetiradaComercial
            retirada={retirada}
            eventos={vinculosPorItem.get(retirada.itemId) ?? []}
            previa={previa}
            confirmada={escopoConfirmado}
            salvando={salvando === `retirada:${retirada.itemId}`}
            onConfirmadaChange={setEscopoConfirmado}
            onCancelar={() => { setRetirada(null); setPrevia(null); setErro(null); }}
            onConfirmar={() => void confirmarRetirada(false)}
            onConfirmarAjuste={() => void confirmarRetirada(true)}
            onAjustarAcordo={onAjustarAcordo}
          />
        </div>
      )}

      {Array.from(vinculosPorItem.entries()).map(([itemId, eventos]) => {
        const item = itensPorId.get(itemId);
        if (!item || diferencas.retiradasPendentes.some((pendencia) => pendencia.itemId === itemId)) return null;
        return (
          <div key={itemId} className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-semibold text-text-primary">{item.descricao ?? 'Item comercial'}</p>
            <p className="mt-1 text-xs text-text-secondary">Vinculado a {eventos.length} procedimento{eventos.length === 1 ? '' : 's'} da ficha.</p>
            <Button size="sm" variant="outline" className="mt-2 min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => iniciarRetirada(itemId, eventos.map((evento) => evento.eventoId), item.descricao ?? 'Item comercial', true)}>
              Retirar somente do orçamento
            </Button>
          </div>
        );
      })}
      </fieldset>

      {vinculosLegados.length > 0 && (
        <details className="rounded-lg border border-border bg-card p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-text-primary">Revisar itens do orçamento</summary>
          <p className="mt-1 text-xs text-text-secondary">Associe registros legados a uma linha comercial antes de resolver ou retirar o item. Nenhuma associação é deduzida pelo nome.</p>
          <fieldset disabled={salvando !== null} className="mt-3 space-y-3">
            {vinculosLegados.map((vinculo) => (
              <VinculoLegado
                key={`legado-${vinculo.eventoId}`}
                eventoId={vinculo.eventoId}
                itens={itens}
                vinculosLegados={vinculosLegados}
                itemId={itemLegadoPorEvento[vinculo.eventoId] ?? ''}
                eventoIds={eventosLegadosPorEvento[vinculo.eventoId] ?? [vinculo.eventoId]}
                salvando={salvando === `legado:${vinculo.eventoId}`}
                onItemChange={(itemId) => setItemLegadoPorEvento((atual) => ({ ...atual, [vinculo.eventoId]: itemId }))}
                onEventosChange={(eventoIds) => setEventosLegadosPorEvento((atual) => ({ ...atual, [vinculo.eventoId]: eventoIds }))}
                onVincular={() => void vincularLegado(vinculo.eventoId)}
              />
            ))}
          </fieldset>
        </details>
      )}
    </section>
  );
}

function VinculoLegado({ eventoId, itens, vinculosLegados, itemId, eventoIds, salvando, onItemChange, onEventosChange, onVincular }: {
  eventoId: string;
  itens: OrcamentoItem[];
  vinculosLegados: DiferencasFichaOrcamento['vinculos'];
  itemId: string;
  eventoIds: string[];
  salvando: boolean;
  onItemChange: (itemId: string) => void;
  onEventosChange: (eventoIds: string[]) => void;
  onVincular: () => void;
}) {
  const alternarEvento = (id: string) => onEventosChange(eventoIds.includes(id)
    ? eventoIds.filter((evento) => evento !== id)
    : [...eventoIds, id]);
  return (
    <fieldset className="mt-3 space-y-2 rounded-lg border border-border bg-surface-alt/40 p-3">
      <legend className="px-1 text-xs font-semibold text-text-primary">Vínculo legado: confirme a linha comercial e o escopo</legend>
      <label className="grid gap-1 text-xs font-semibold text-foreground">
        Item comercial
        <select value={itemId} onChange={(event) => onItemChange(event.target.value)} className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-normal text-foreground">
          <option value="">Selecionar item</option>
          {itens.map((item) => <option key={item.id} value={item.id}>{item.descricao ?? 'Item sem descrição'}</option>)}
        </select>
      </label>
      <p className="text-xs text-text-secondary">Não usamos semelhança de nome para decidir vínculos antigos.</p>
      <div className="space-y-1">
        {vinculosLegados.map((vinculo) => (
          <label key={vinculo.eventoId} className="flex min-h-11 items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={eventoIds.includes(vinculo.eventoId)} onChange={() => alternarEvento(vinculo.eventoId)} />
            {vinculo.nome} · {vinculo.local}
          </label>
        ))}
      </div>
      <Button type="button" size="sm" className="min-h-11" disabled={salvando || !itemId || !eventoIds.includes(eventoId)} onClick={onVincular}>
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar vínculo
      </Button>
    </fieldset>
  );
}

function RetiradaComercial({ retirada, eventos, previa, confirmada, salvando, onConfirmadaChange, onCancelar, onConfirmar, onConfirmarAjuste, onAjustarAcordo }: {
  retirada: RetiradaEmRevisao;
  eventos: DiferencasFichaOrcamento['vinculos'];
  previa: PreviaFinanceira | null;
  confirmada: boolean;
  salvando: boolean;
  onConfirmadaChange: (confirmada: boolean) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
  onConfirmarAjuste: () => void;
  onAjustarAcordo: () => void;
}) {
  const exigeAjusteAntes = previa?.motivo === 'valor_abaixo_recebido';
  return (
    <div className="rounded-lg border border-destructive/40 bg-card p-3">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-semibold text-foreground">Confirmar retirada de {retirada.titulo}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {retirada.apenasComercial ? 'O procedimento continua ativo na ficha clínica.' : 'Esta revisão resolve a retirada já registrada na ficha.'}
          </p>
        </div>
      </div>
      <ul aria-label="Procedimentos incluídos no escopo da retirada" className="mt-3 space-y-1 rounded-md bg-surface-alt p-2 text-xs text-text-secondary">
        {eventos.map((evento) => <li key={evento.eventoId}>{evento.nome} · {evento.local}{evento.retiradoEm ? ' · retirado da ficha' : ''}</li>)}
      </ul>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-xs font-semibold text-foreground">
        <input type="checkbox" checked={confirmada} onChange={(event) => onConfirmadaChange(event.target.checked)} disabled={salvando} />
        Entendo que esta ação retira do orçamento todos os procedimentos listados acima.
      </label>
      {previa && (
        <div className="mt-3 rounded-md border border-warning/50 bg-warning-pale p-3 text-xs text-warning-ink">
          <p className="font-semibold">Impacto financeiro antes da retirada</p>
          <p className="mt-1">Proposta: {moeda(previa.total_antes)} → {moeda(previa.total_depois)} · Valor devido: {moeda(previa.devido_antes)} → {moeda(previa.devido_depois)}.</p>
          <p className="mt-1">Recebido preservado: {moeda(previa.recebido)} · Saldo estimado após a retirada: {moeda(Math.max(0, previa.devido_depois - previa.recebido))} · {previa.etapas_abertas} etapa{previa.etapas_abertas === 1 ? '' : 's'} aberta{previa.etapas_abertas === 1 ? '' : 's'}.</p>
          {exigeAjusteAntes ? (
            <>
              <p className="mt-2">O total ficaria abaixo do já recebido. Ajuste o acordo, a cobrança ou um recebimento antes de confirmar a retirada.</p>
              <Button type="button" size="sm" variant="outline" className="mt-2 min-h-11" onClick={onAjustarAcordo}>Abrir ajustes financeiros</Button>
            </>
          ) : (
            <p className="mt-2">A retirada preserva valores negociados e cobranças até uma edição financeira explícita.</p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={salvando} onClick={onCancelar}>Cancelar</Button>
        {!previa && <Button type="button" size="sm" variant="destructive" className="min-h-11" disabled={salvando || !confirmada} onClick={onConfirmar}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Revisar impacto financeiro</Button>}
        {previa && !exigeAjusteAntes && <Button type="button" size="sm" variant="destructive" className="min-h-11" disabled={salvando || !confirmada} onClick={onConfirmarAjuste}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar retirada</Button>}
      </div>
    </div>
  );
}
