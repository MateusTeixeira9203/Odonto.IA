'use client';

import { MontarGrupoOrcamento } from './montar-grupo-orcamento';
import React, { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, Check, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import { stripDenteDoNome } from '@/lib/arcadas';
import type { FichaParaOrc, ProcedimentoClinica, NovoOrcItem } from '../types';

export interface NovoOrcamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapaNovoOrc: 'selecionar' | 'itens';
  setEtapaNovoOrc: (v: 'selecionar' | 'itens') => void;
  fichasParaOrc: FichaParaOrc[];
  /** R-84 §5.3 — só o picker (não pertence a 1 ficha) oferece trocar de ficha; o caminho
   *  por-ficha fica fechado mesmo com `fichasParaOrc.length === 1` (decisão 07/08). */
  podeTrocarFicha: boolean;
  orcError: string | null;
  /** Catálogo ausente por erro não pode parecer uma lista legítima vazia. */
  bloqueioCriacao: string | null;
  novoOrcItens: NovoOrcItem[];
  setNovoOrcItens: React.Dispatch<React.SetStateAction<NovoOrcItem[]>>;
  procedimentosClinica: ProcedimentoClinica[];
  novoOrcSubtotal: number;
  novoOrcValorFinal: number | null;
  setNovoOrcValorFinal: React.Dispatch<React.SetStateAction<number | null>>;
  orcSaving: boolean;
  modoPersistencia: 'novo' | 'adicionar';
  /** Meu Dia sem evento inicial: a linha escolhida será registrada clinicamente antes da proposta. */
  contextoClinicoPendente: boolean;
  resumoOrigemOrcamento: {
    disponiveis: number;
    deOutrosResponsaveis: number;
    responsaveis: string[];
  } | null;
  onCriarOrcamento: () => void;
  onSelecionarFicha: (fichaId: string | null) => void;
  onCadastrarProcedimento: (idx: number) => void;
  registeringProcIdx: number | null;
  isSecretaria: boolean;
  dentistasClinica: { id: string; nome: string }[];
  dentistaAlvoId: string;
  onDentistaAlvoChange: (id: string) => void;
}

export function NovoOrcamentoModal({
  open,
  onOpenChange,
  etapaNovoOrc,
  setEtapaNovoOrc,
  fichasParaOrc,
  podeTrocarFicha,
  orcError,
  bloqueioCriacao,
  novoOrcItens,
  setNovoOrcItens,
  procedimentosClinica,
  novoOrcSubtotal,
  novoOrcValorFinal,
  setNovoOrcValorFinal,
  orcSaving,
  modoPersistencia,
  contextoClinicoPendente,
  resumoOrigemOrcamento,
  onCriarOrcamento,
  onSelecionarFicha,
  onCadastrarProcedimento,
  registeringProcIdx,
  isSecretaria,
  dentistasClinica,
  dentistaAlvoId,
  onDentistaAlvoChange,
}: NovoOrcamentoModalProps) {
  const [valorFinalTexto, setValorFinalTexto] = useState(
    novoOrcValorFinal !== null ? formatValorBR(novoOrcValorFinal) : ''
  );
  useEffect(() => {
    // O valor em formato brasileiro é estado de apresentação: sincroniza uma mudança externa
    // (abrir outro orçamento, limpar modal) sem sobrescrever a digitação em andamento.
    const timer = window.setTimeout(() => {
      setValorFinalTexto(novoOrcValorFinal !== null ? formatValorBR(novoOrcValorFinal) : '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [novoOrcValorFinal]);
  const temDesconto = novoOrcValorFinal !== null && novoOrcSubtotal > 0 && novoOrcValorFinal < novoOrcSubtotal;
  const pctDesconto = temDesconto
    ? Math.round(((novoOrcSubtotal - novoOrcValorFinal!) / novoOrcSubtotal) * 100 * 10) / 10
    : 0;
  const quantidadeAdicionar = novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length;
  const contextoAdicao = `${quantidadeAdicionar} procedimento${quantidadeAdicionar === 1 ? '' : 's'} desta ficha ${quantidadeAdicionar === 1 ? 'será adicionado' : 'serão adicionados'} ao orçamento atual após sua confirmação.`;

  const separarDescricao = (descricao: string): { procedimento: string; local: string | null } => {
    const marcador = descricao.indexOf(' — ');
    if (marcador < 0) return { procedimento: descricao, local: null };
    return { procedimento: descricao.slice(0, marcador), local: descricao.slice(marcador + 3) || null };
  };

  function atualizarItemManual(idx: number, procedimento: string, local: string) {
    const match = procedimentosClinica.find((item) => item.nome === procedimento);
    const descricao = local.trim() ? `${procedimento} — ${local.trim()}` : procedimento;
    setNovoOrcItens((prev) => prev.map((item, index) => {
      if (index !== idx) return item;
      return {
        ...item,
        descricao,
        procedimentoId: match?.id ?? '',
        preco: item.preco || (match?.preco_padrao != null ? formatValorBR(match.preco_padrao) : item.preco),
      };
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-border bg-surface p-0 md:max-h-[90vh] lg:w-[90vw] lg:max-w-[1280px]"
        style={{ left: '50%' }}
        showCloseButton={false}
      >
        {/* ── Cabeçalho calmo (R-39a) — mesmo esqueleto do detalhe, sem gradiente ── */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <DialogTitle className="font-heading font-semibold text-xl text-text-primary leading-tight">
              {etapaNovoOrc === 'selecionar'
                ? 'Selecionar ficha'
                : modoPersistencia === 'adicionar'
                  ? 'Atualizar orçamento'
                  : 'Montar orçamento'}
            </DialogTitle>
            <DialogDescription className="text-text-muted text-xs truncate">
              {etapaNovoOrc === 'selecionar'
                ? 'Escolha qual registro clínico vai gerar o orçamento.'
                : modoPersistencia === 'adicionar'
                  ? 'Revise os novos procedimentos antes de incluí-los na proposta atual.'
                  : 'Selecione os procedimentos e ajuste os valores antes de criar.'}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Etapa 1: seleção de ficha (coluna única) ── */}
        {etapaNovoOrc === 'selecionar' && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
            {fichasParaOrc.map((ficha) => {
              const denteCount = (ficha.dentes_afetados ?? []).length;
              const dataFormatada = format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
              return (
                <button
                  key={ficha.id}
                  onClick={() => void onSelecionarFicha(ficha.id)}
                  className="min-h-11 w-full text-left p-4 rounded-xl border border-border bg-surface-alt hover:border-teal/40 hover:bg-teal/5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors truncate">
                        {ficha.queixa_principal ?? 'Evolução clínica'}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">{dataFormatada}</div>
                    </div>
                    {denteCount > 0 && (
                      <span className="shrink-0 text-[10px] font-bold font-mono bg-teal/10 text-teal px-2 py-1 rounded-lg">
                        {denteCount} dente{denteCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Etapa 2: procedimentos à esquerda, dinheiro à direita (R-39a) ── */}
        {etapaNovoOrc === 'itens' && (
          <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:flex-row lg:overflow-hidden">

            {/* Coluna clínica — procedimentos */}
            <div className="min-w-0 space-y-4 p-4 lg:flex-1 lg:overflow-y-auto md:p-6">
              {isSecretaria && (
                <div className="space-y-1">
                  <Label className="text-xs text-text-secondary">Dentista responsável *</Label>
                  <Select value={dentistaAlvoId} onValueChange={(v) => v && onDentistaAlvoChange(v)}>
                    <SelectTrigger className="rounded-xl bg-surface border-border text-text-primary">
                      <SelectValue placeholder="Selecione o dentista..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {dentistasClinica.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <datalist id="catalogo-procedimentos">
                {procedimentosClinica.map((p) => <option key={p.id} value={p.nome} />)}
              </datalist>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Procedimentos</p>
                  <p className="mt-1 text-sm text-text-muted">
                    {modoPersistencia === 'adicionar'
                      ? contextoAdicao
                      : contextoClinicoPendente
                        ? 'Escolha os procedimentos. Eles serão registrados como planejados antes da proposta.'
                        : 'Itens encontrados na ficha. Revise valores antes de criar.'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal-ink">
                  {novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length} selecionado{novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length === 1 ? '' : 's'}
                </span>
              </div>

              {resumoOrigemOrcamento && (
                <div className="rounded-xl border border-border bg-surface-alt px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
                  <p>
                    <span className="font-semibold text-text-primary">{resumoOrigemOrcamento.disponiveis}</span>{' '}
                    registro{resumoOrigemOrcamento.disponiveis === 1 ? '' : 's'} clínico{resumoOrigemOrcamento.disponiveis === 1 ? '' : 's'}{' '}
                    {resumoOrigemOrcamento.disponiveis === 1 ? 'disponível' : 'disponíveis'} para este orçamento.
                  </p>
                  {resumoOrigemOrcamento.deOutrosResponsaveis > 0 && (
                    <p className="mt-1 text-warning-ink">
                      {resumoOrigemOrcamento.deOutrosResponsaveis} pertence{resumoOrigemOrcamento.deOutrosResponsaveis === 1 ? '' : 'm'} a {resumoOrigemOrcamento.responsaveis.join(', ')} e só pode ser orçado pelo responsável.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {novoOrcItens.map((item, idx) => {
                  if (item.composicao?.length) return (
                    <fieldset key={idx} disabled={orcSaving} className="space-y-3 rounded-xl border border-border bg-card p-3 text-foreground">
                      <p className="text-sm font-semibold">{item.descricao}</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">{item.composicao.map((membro, index) => <li key={index}>{membro.quantidade} × {membro.descricao}</li>)}</ul>
                      <label className="block space-y-1 text-sm">Valor fechado do grupo (R$)<Input aria-label={`Valor do grupo ${item.descricao}`} inputMode="decimal" value={item.preco} onChange={(e) => setNovoOrcItens((prev) => prev.map((atual, i) => i === idx ? { ...atual, preco: e.target.value } : atual))} className="min-h-11" /></label>
                      <Button variant="outline" type="button" className="min-h-11" onClick={() => setNovoOrcItens((prev) => prev.flatMap((atual, i) => i === idx ? atual.composicao ?? [atual] : [atual]))}>Desfazer grupo</Button>
                    </fieldset>
                  );
                  const { procedimento, local } = separarDescricao(item.descricao);
                  const selecionado = item.selecionado !== false;
                  const manual = item.origem === 'manual' || !item.descricao;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-2.5 transition-colors ${selecionado ? 'border-teal/40 bg-teal/[0.05]' : 'border-border bg-surface-alt/50 opacity-70'}`}
                    >
                      <div className="grid grid-cols-[24px_minmax(0,1fr)_40px] items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={selecionado}
                          aria-label={`${selecionado ? 'Remover' : 'Adicionar'} ${procedimento || 'procedimento'} do orçamento`}
                          onClick={() => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, selecionado: !selecionado } : it))}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${selecionado ? 'border-teal bg-teal text-white' : 'border-border text-transparent hover:border-teal/50'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0 space-y-2">
                          {manual ? (
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.55fr)]">
                              <Input list="catalogo-procedimentos" placeholder="Procedimento" value={procedimento} onChange={(e) => atualizarItemManual(idx, e.target.value, local ?? '')} className="h-11 rounded-xl border-border bg-surface text-text-primary" />
                              <Input placeholder="Localização opcional" aria-label="Localização clínica" value={local ?? ''} onChange={(e) => atualizarItemManual(idx, procedimento, e.target.value)} className="h-11 rounded-xl border-border bg-surface text-text-primary" />
                            </div>
                          ) : (
                            <div>
                              <p className="break-words text-sm font-semibold text-text-primary">{procedimento}</p>
                              {local && <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary"><MapPin className="h-3 w-3" />{local}</p>}
                            </div>
                          )}
                          <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-1.5">
                            <Input type="number" min="1" value={item.quantidade} onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))} aria-label="Quantidade" className="h-10 rounded-lg border-border bg-surface px-1 text-center font-mono text-text-primary" />
                            <Input type="text" inputMode="decimal" placeholder="Preço" value={item.preco} onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: e.target.value } : it))} onBlur={(e) => { const valor = parseValorBR(e.target.value); setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: valor > 0 ? formatValorBR(valor) : it.preco } : it)); }} aria-label="Preço" className="h-10 rounded-lg border-border bg-surface px-2 font-mono text-text-primary" />
                          </div>
                        </div>
                        <button type="button" onClick={() => setNovoOrcItens((prev) => prev.filter((_, i) => i !== idx))} className="h-11 w-11 shrink-0 rounded-xl text-text-secondary transition-colors hover:bg-coral-pale hover:text-coral-ink" aria-label="Remover procedimento"><Trash2 className="mx-auto h-4 w-4" /></button>
                      </div>
                      {!item.procedimentoId && item.descricao.trim() && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-pale px-3 py-2">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-warning-ink"><AlertTriangle className="h-3.5 w-3.5" />Fora do catálogo</span>
                          <button type="button" onClick={() => onCadastrarProcedimento(idx)} disabled={registeringProcIdx === idx} className="text-xs font-bold text-warning-ink hover:underline disabled:opacity-50">
                            {registeringProcIdx === idx ? 'Cadastrando...' : `Cadastrar “${stripDenteDoNome(item.descricao)}”`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <MontarGrupoOrcamento itens={novoOrcItens} onChange={(itens) => { setNovoOrcItens(itens); setNovoOrcValorFinal(null); }} disabled={orcSaving} />
            </div>

            {/* A criação confirma a proposta; cobrança só existe na etapa seguinte. */}
            <div className="flex min-h-0 w-full flex-col border-t border-border bg-teal/[0.04] lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l">
              <div className="space-y-4 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-ink">Área de trabalho</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">Revisar orçamento</p>
                    <p className="mt-1 text-xs text-text-secondary">Confira o valor final antes de criar. A cobrança será combinada na próxima etapa.</p>
                  </div>
                </div>

                <div className="rounded-xl border border-teal/20 bg-teal/[0.06] px-3 py-2.5 text-xs text-teal-ink">
                  {novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length} procedimento{novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length === 1 ? '' : 's'} vieram da ficha clínica
                </div>

                {modoPersistencia === 'novo' ? (
                  <div className="max-w-xl space-y-2 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-3"><Label className="text-sm font-semibold text-text-primary">Valor final do orçamento</Label><span className="text-xs text-text-secondary">editável</span></div>
                    <div className="flex items-center gap-2 rounded-xl border border-teal/40 bg-surface px-3"><span className="font-mono text-sm font-semibold text-teal-ink">R$</span><Input type="text" inputMode="decimal" aria-label="Valor final do orçamento" placeholder={formatValorBR(novoOrcSubtotal)} value={valorFinalTexto} onChange={(e) => setValorFinalTexto(e.target.value)} onBlur={(e) => { const parsed = parseValorBR(e.target.value); setNovoOrcValorFinal(parsed > 0 ? parsed : null); setValorFinalTexto(parsed > 0 ? formatValorBR(parsed) : ''); }} className="h-14 border-0 bg-transparent px-0 font-mono text-2xl font-semibold text-text-primary shadow-none focus-visible:ring-0" /></div>
                    <p className="text-xs text-text-secondary">Use este campo apenas se houver negociação no total. A forma de pagamento será definida depois.</p>
                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-text-secondary"><span>Total dos procedimentos</span><span className="font-mono text-sm font-semibold text-text-primary">R$ {novoOrcSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                    {temDesconto && <p className="text-xs font-semibold text-teal-ink">Desconto de {pctDesconto}% aplicado</p>}
                    {novoOrcValorFinal !== null && novoOrcValorFinal > novoOrcSubtotal && <p className="text-xs text-warning-ink">Valor maior que o total dos procedimentos.</p>}
                  </div>
                ) : (
                  <p className="rounded-xl border border-border bg-surface px-3 py-3 text-xs leading-relaxed text-text-secondary">Os recebimentos e o valor final continuam no orçamento atual. Estes novos itens entram como pendentes de aprovação.</p>
                )}
              </div>

              {/* ── Ação fixa no pé da coluna (R-39a) ── */}
              <div className="shrink-0 space-y-2 border-t border-border p-4">
                {bloqueioCriacao && (
                  <p role="alert" className="text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2">{bloqueioCriacao}</p>
                )}
                {orcError && (
                  <p className="text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2">{orcError}</p>
                )}
                <Button
                  onClick={onCriarOrcamento}
                  disabled={Boolean(bloqueioCriacao) || orcSaving || novoOrcItens.every((item) => item.selecionado === false || !item.descricao.trim())}
                  className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
                >
                  {orcSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : modoPersistencia === 'adicionar' ? `Adicionar ${novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length} procedimento${novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length === 1 ? '' : 's'}` : 'Criar e continuar'}
                </Button>
                {podeTrocarFicha && (
                  <Button
                    variant="outline"
                    onClick={() => setEtapaNovoOrc('selecionar')}
                    disabled={orcSaving}
                    className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                  >
                    ← Voltar
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
