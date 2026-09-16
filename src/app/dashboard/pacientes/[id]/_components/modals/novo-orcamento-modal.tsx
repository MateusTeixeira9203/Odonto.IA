'use client';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';

import { MontarGrupoOrcamento } from './montar-grupo-orcamento';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, AlertTriangle, X, Loader2, Check, ChevronDown, MapPin, ArrowRight } from 'lucide-react';
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
import type { FichaParaOrc, ProcedimentoClinica, NovoOrcItem, OrcamentoItem } from '../types';
import type { FormaPagamento } from '@/app/dashboard/orcamentos/actions';

const FORMA_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito', boleto: 'Boleto', outro: 'Outro',
};

export interface NovoOrcamentoModalProps {
  titularRecebimento?: 'dentista' | 'clinica' | '';
  setTitularRecebimento?: (valor: 'dentista' | 'clinica' | '') => void;
  recebimentoMisto?: boolean;
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
  novoOrcTotal: number;
  novoOrcValorFinal: number | null;
  setNovoOrcValorFinal: React.Dispatch<React.SetStateAction<number | null>>;
  orcSaving: boolean;
  modoPersistencia: 'novo' | 'adicionar';
  itensExistentes: OrcamentoItem[];
  /** Meu Dia sem evento inicial: a linha escolhida será registrada clinicamente antes da proposta. */
  contextoClinicoPendente: boolean;
  resumoOrigemOrcamento: {
    disponiveis: number;
    deOutrosResponsaveis: number;
    responsaveis: string[];
  } | null;
  onCriarOrcamento: () => void;
  onManterOrcamento: () => void;
  onSelecionarFicha: (fichaId: string | null) => void;
  onCadastrarProcedimento: (idx: number) => void;
  registeringProcIdx: number | null;
  isSecretaria: boolean;
  dentistasClinica: { id: string; nome: string }[];
  dentistaAlvoId: string;
  onDentistaAlvoChange: (id: string) => void;
  planoForma: 'avista' | 'parcelado' | null;
  setPlanoForma: (v: 'avista' | 'parcelado' | null) => void;
  planoNumParcelas: string;
  setPlanoNumParcelas: (v: string) => void;
  planoPrimeiroVencimento: string;
  setPlanoPrimeiroVencimento: (v: string) => void;
  planoParcelasForma: FormaPagamento | '';
  setPlanoParcelasForma: (v: FormaPagamento | '') => void;
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
  novoOrcTotal,
  novoOrcValorFinal,
  setNovoOrcValorFinal,
  orcSaving,
  modoPersistencia,
  itensExistentes,
  contextoClinicoPendente,
  resumoOrigemOrcamento,
  onCriarOrcamento,
  onManterOrcamento,
  onSelecionarFicha,
  onCadastrarProcedimento,
  registeringProcIdx,
  isSecretaria,
  dentistasClinica,
  dentistaAlvoId,
  onDentistaAlvoChange,
  planoForma,
  setPlanoForma,
  planoNumParcelas,
  setPlanoNumParcelas,
  planoPrimeiroVencimento,
  setPlanoPrimeiroVencimento,
  planoParcelasForma,
  setPlanoParcelasForma,
  titularRecebimento, setTitularRecebimento, recebimentoMisto,
}: NovoOrcamentoModalProps) {
  const [valorFinalTexto, setValorFinalTexto] = useState(
    novoOrcValorFinal !== null ? formatValorBR(novoOrcValorFinal) : ''
  );
  const [mostrarAjusteFinal, setMostrarAjusteFinal] = useState(false);
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  useEffect(() => {
    // O valor em formato brasileiro é estado de apresentação: sincroniza uma mudança externa
    // (abrir outro orçamento, limpar modal) sem sobrescrever a digitação em andamento.
    const timer = window.setTimeout(() => {
      setValorFinalTexto(novoOrcValorFinal !== null ? formatValorBR(novoOrcValorFinal) : '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [novoOrcValorFinal]);
  const temGrupos = novoOrcItens.some((item) => item.composicao?.length);
  const temDesconto = novoOrcValorFinal !== null && novoOrcSubtotal > 0 && novoOrcValorFinal < novoOrcSubtotal;
  const pctDesconto = temDesconto
    ? Math.round(((novoOrcSubtotal - novoOrcValorFinal!) / novoOrcSubtotal) * 100 * 10) / 10
    : 0;
  const quantidadeAdicionar = novoOrcItens.filter((item) => item.selecionado !== false && item.descricao.trim()).length;
  const contextoAdicao = `${quantidadeAdicionar} procedimento${quantidadeAdicionar === 1 ? '' : 's'} desta ficha ${quantidadeAdicionar === 1 ? 'será adicionado' : 'serão adicionados'} ao orçamento atual após sua confirmação.`;
  const precoRefs = useRef(new Map<number, HTMLInputElement>());
  const totalExistente = useMemo(
    () => itensExistentes.reduce((total, item) => total + (item.preco_total ?? 0), 0),
    [itensExistentes],
  );
  const indicesSemPreco = novoOrcItens.flatMap((item, index) => (
    item.selecionado !== false && item.descricao.trim() && parseValorBR(item.preco) <= 0 ? [index] : []
  ));
  const novosDisponiveis = novoOrcItens.filter((item) => item.selecionado === false);

  function adicionarTodosOsNovos(): void {
    setNovoOrcItens((itens) => itens.map((item) => item.revisado ? item : { ...item, selecionado: true }));
  }

  function continuar(): void {
    const primeiroSemPreco = indicesSemPreco[0];
    if (primeiroSemPreco !== undefined) {
      precoRefs.current.get(primeiroSemPreco)?.focus();
      return;
    }
    onCriarOrcamento();
  }

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
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-border bg-surface p-0 md:max-h-[92vh] md:w-[94vw] md:max-w-[1440px]"
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
          <div className="min-h-0 flex-1 overflow-y-auto md:flex md:flex-row md:overflow-hidden">

            {/* Coluna clínica — procedimentos */}
            <div className="min-w-0 space-y-4 p-4 md:flex-1 md:overflow-y-auto md:p-6">
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

              {recebimentoMisto && modoPersistencia === 'novo' && <label className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 text-sm text-foreground">Quem recebe por este orçamento?
                <select aria-label="Quem recebe por este orçamento?" value={titularRecebimento ?? ''} onChange={e => { const value = e.target.value; if (value === 'clinica' || value === 'dentista' || value === '') setTitularRecebimento?.(value); }} disabled={orcSaving} className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                  <option value="">Selecione</option><option value="clinica">A clínica</option><option value="dentista">O dentista responsável</option>
                </select><span className="text-xs text-muted-foreground">Define em qual financeiro os recebimentos entram. O responsável pelo atendimento continua o mesmo.</span>
              </label>}
              <div className={modoPersistencia === 'adicionar' ? 'grid items-start gap-4 xl:grid-cols-2' : 'space-y-2'}>
                <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                  {modoPersistencia === 'adicionar' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-alt px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">No orçamento · {itensExistentes.length + quantidadeAdicionar}</p>
                        <p className="mt-0.5 text-xs text-text-secondary">Valores que compõem o novo total.</p>
                      </div>
                      <div className="w-full sm:w-auto">
                        <MontarGrupoOrcamento itens={novoOrcItens} onChange={(itens) => { setNovoOrcItens(itens); setNovoOrcValorFinal(null); setPlanoForma(null); }} disabled={orcSaving} />
                      </div>
                    </div>
                  )}
                  {modoPersistencia === 'novo' && (
                    <div className="mb-3 px-3 pt-3">
                      <MontarGrupoOrcamento itens={novoOrcItens} onChange={(itens) => { setNovoOrcItens(itens); setNovoOrcValorFinal(null); setPlanoForma(null); }} disabled={orcSaving} />
                    </div>
                  )}

                  {modoPersistencia === 'adicionar' && itensExistentes.map((item) => (
                    <div key={item.id} className="grid gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-center">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold leading-snug text-text-primary">{item.descricao ?? 'Procedimento'}</p>
                        {item.quantidade > 1 && <p className="mt-1 text-xs text-text-secondary">{item.quantidade} unidades</p>}
                      </div>
                      <div className="rounded-xl border border-border bg-surface px-3 py-2 text-right font-mono text-sm font-semibold text-text-primary">
                        R$ {(item.preco_total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}

                {novoOrcItens.map((item, idx) => {
                  if (modoPersistencia === 'adicionar' && item.selecionado === false) return null;
                  if (item.composicao?.length) return (
                    <fieldset key={idx} disabled={orcSaving} className="space-y-3 border-b border-border/70 bg-card p-4 text-foreground last:border-b-0">
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
                      className={`border-b border-border/70 p-4 transition-colors last:border-b-0 ${selecionado ? 'bg-teal/[0.035]' : 'bg-surface-alt/50 opacity-70'}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          aria-pressed={selecionado}
                          aria-label={`${selecionado ? 'Remover' : 'Adicionar'} ${procedimento || 'procedimento'} do orçamento`}
                          onClick={() => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, selecionado: !selecionado } : it))}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${selecionado ? 'border-teal bg-teal text-white' : 'border-border text-transparent hover:border-teal/50'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0 flex-1 space-y-2">
                          {manual ? (
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.55fr)]">
                              <Input list="catalogo-procedimentos" placeholder="Procedimento" value={procedimento} onChange={(e) => atualizarItemManual(idx, e.target.value, local ?? '')} className="h-11 rounded-xl border-border bg-surface text-text-primary" />
                              <Input placeholder="Localização opcional" aria-label="Localização clínica" value={local ?? ''} onChange={(e) => atualizarItemManual(idx, procedimento, e.target.value)} className="h-11 rounded-xl border-border bg-surface text-text-primary" />
                            </div>
                          ) : (
                            <div>
                              <p className="break-words text-sm font-semibold leading-snug text-text-primary">{procedimento}</p>
                              {local && <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary"><MapPin className="h-3 w-3" />{local}</p>}
                            </div>
                          )}
                          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 sm:max-w-sm">
                            <Input type="number" min="1" value={item.quantidade} onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))} aria-label="Quantidade" className="h-11 rounded-xl border-border bg-surface text-center font-mono text-text-primary" />
                            <Input ref={(element) => { if (element) precoRefs.current.set(idx, element); else precoRefs.current.delete(idx); }} type="text" inputMode="decimal" placeholder="Preço" value={item.preco} onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: e.target.value } : it))} onBlur={(e) => { const valor = parseValorBR(e.target.value); setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: valor > 0 ? formatValorBR(valor) : it.preco } : it)); }} aria-label={`Preço de ${procedimento || 'procedimento'}`} aria-invalid={selecionado && parseValorBR(item.preco) <= 0} className={`h-11 rounded-xl bg-surface font-mono text-text-primary ${selecionado && parseValorBR(item.preco) <= 0 ? 'border-warning ring-1 ring-warning/30' : 'border-border'}`} />
                          </div>
                          {selecionado && parseValorBR(item.preco) <= 0 && <p className="text-xs font-medium text-warning-ink">Informe o preço para continuar.</p>}
                        </div>
                        <button type="button" onClick={() => setNovoOrcItens((prev) => modoPersistencia === 'adicionar' ? prev.map((atual, i) => i === idx ? { ...atual, selecionado: false } : atual) : prev.filter((_, i) => i !== idx))} className="h-11 w-11 shrink-0 rounded-xl text-text-secondary transition-colors hover:bg-coral-pale hover:text-coral-ink" aria-label="Remover procedimento"><Trash2 className="mx-auto h-4 w-4" /></button>
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
                </section>

                {modoPersistencia === 'adicionar' && (
                  <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-alt px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">Disponíveis na ficha · {novosDisponiveis.length}</p>
                        <p className="mt-0.5 text-xs text-text-secondary">Fora do orçamento atual.</p>
                      </div>
                      {novosDisponiveis.some((item) => !item.revisado) && (
                        <Button type="button" variant="outline" size="sm" onClick={adicionarTodosOsNovos} disabled={orcSaving} className="min-h-10 border-teal/40 text-teal-ink hover:bg-teal/10">
                          Adicionar todos os novos
                        </Button>
                      )}
                    </div>
                    {novosDisponiveis.length === 0 ? (
                      <div className="p-6 text-center text-sm text-text-secondary">Todos os procedimentos desta ficha já estão na montagem.</div>
                    ) : novosDisponiveis.map((item) => {
                      const idx = novoOrcItens.indexOf(item);
                      const { procedimento, local } = separarDescricao(item.descricao);
                      return (
                        <div key={item.eventoIds?.join(',') ?? idx} className="grid gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-sm font-semibold leading-snug text-text-primary">{procedimento}</p>
                              <span className={item.revisado ? 'rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary' : 'rounded-full bg-warning-pale px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-ink'}>
                                {item.revisado ? 'Revisado' : 'Novo'}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary"><MapPin className="h-3 w-3" />{local ?? 'Sem região'}</p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => setNovoOrcItens((prev) => prev.map((atual, i) => i === idx ? { ...atual, selecionado: true } : atual))} disabled={orcSaving} className="min-h-10 border-teal/35 text-teal-ink hover:bg-teal/10">
                            Adicionar <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </section>
                )}
              </div>

              {modoPersistencia === 'novo' && (
                <button type="button" onClick={() => setNovoOrcItens((prev) => [...prev, { procedimentoId: '', descricao: '', quantidade: 1, preco: '', eventoIds: [], origem: 'manual', selecionado: true }])} className="min-h-11 w-full rounded-xl border border-dashed border-border py-3 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary">
                  <Plus className="mr-2 inline h-4 w-4" />Adicionar procedimento manual
                </button>
              )}
            </div>

            {/* Coluna do dinheiro — resumo, valor negociado, forma de pagamento (R-39a) */}
            <div className="flex min-h-0 w-full flex-col border-t border-border bg-teal/[0.04] md:w-[416px] md:shrink-0 md:border-t-0 md:border-l">
              <div className="space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-ink">Resumo do orçamento</p>
                  {modoPersistencia === 'adicionar' && <p className="mt-1 text-sm text-text-secondary">Acompanhe cada inclusão antes de confirmar.</p>}
                </div>

                {modoPersistencia === 'adicionar' && (
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
                    <div className="flex items-center justify-between gap-3 text-text-secondary">
                      <span>Total anterior</span>
                      <strong className="font-mono text-text-primary">R$ {totalExistente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-text-secondary">
                      <span>Adições</span>
                      <strong className="font-mono text-teal-ink">+ R$ {novoOrcSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl p-4 space-y-2 border border-teal/15 bg-teal/[0.07]">
                  {temDesconto && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-text-secondary font-mono">Subtotal</p>
                        <p className="text-xs font-mono text-text-secondary line-through">
                          R$ {novoOrcSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-text-secondary font-mono">Desconto ({pctDesconto}%)</p>
                        <p className="text-xs font-mono font-semibold text-coral-ink">
                          − R$ {(novoOrcSubtotal - novoOrcTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="h-px bg-teal/20" />
                    </>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-ink/70">{modoPersistencia === 'adicionar' ? 'Novo total' : 'Total'}</p>
                  <p className="font-mono text-3xl font-bold text-teal-ink leading-none">
                    R$ {(modoPersistencia === 'adicionar' ? totalExistente + novoOrcSubtotal : novoOrcTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-text-secondary font-mono">
                    {modoPersistencia === 'adicionar'
                      ? `${itensExistentes.length} atuais + ${quantidadeAdicionar} selecionado${quantidadeAdicionar === 1 ? '' : 's'}`
                      : `${quantidadeAdicionar} item(s) selecionado(s)`}
                  </p>
                </div>

                {modoPersistencia === 'adicionar' && indicesSemPreco.length > 0 && (
                  <p role="alert" className="rounded-xl border border-warning/40 bg-warning-pale p-3 text-sm font-medium text-warning-ink">
                    {indicesSemPreco.length} procedimento{indicesSemPreco.length === 1 ? ' precisa' : 's precisam'} de preço antes de continuar.
                  </p>
                )}

                {temGrupos ? (
                  <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">Ajuste o preço de cada grupo nos campos ao lado. Depois de salvar e aprovar os grupos, defina a cobrança, os vencimentos e a observação do acordo por etapa.</p>
                ) : modoPersistencia === 'novo' ? (
                  <>
                    <button type="button" onClick={() => setMostrarAjusteFinal((value) => !value)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left text-sm font-semibold text-text-primary hover:text-teal-ink">
                      Ajustar valor final <ChevronDown className={`h-4 w-4 transition-transform ${mostrarAjusteFinal ? 'rotate-180' : ''}`} />
                    </button>
                    {mostrarAjusteFinal && (
                      <div className="space-y-1.5 rounded-xl border border-border bg-surface p-3">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Valor final negociado (R$)</Label>
                        <Input type="text" inputMode="decimal" placeholder={novoOrcSubtotal.toFixed(2)} value={valorFinalTexto} onChange={(e) => setValorFinalTexto(e.target.value)} onBlur={(e) => { const parsed = parseValorBR(e.target.value); setNovoOrcValorFinal(parsed > 0 ? parsed : null); setValorFinalTexto(parsed > 0 ? formatValorBR(parsed) : ''); }} className="h-11 rounded-xl border-border bg-surface-alt font-mono text-text-primary" />
                        {temDesconto && <p className="text-[11px] font-semibold text-teal-ink">Desconto de {pctDesconto}% aplicado</p>}
                        {novoOrcValorFinal !== null && novoOrcValorFinal > novoOrcSubtotal && <p className="text-[11px] text-warning-ink">Valor maior que o total</p>}
                      </div>
                    )}
                    <button type="button" onClick={() => setMostrarPagamento((value) => !value)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left text-sm font-semibold text-text-primary hover:text-teal-ink">
                      Definir forma de pagamento <span className="text-xs font-normal text-text-muted">opcional</span><ChevronDown className={`h-4 w-4 transition-transform ${mostrarPagamento ? 'rotate-180' : ''}`} />
                    </button>
                    {mostrarPagamento && (
                      <div className="space-y-1.5 rounded-xl border border-border bg-surface p-3">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button type="button" onClick={() => setPlanoForma(planoForma === 'avista' ? null : 'avista')} className={`min-h-11 rounded-xl border text-xs font-semibold transition-colors ${planoForma === 'avista' ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border text-text-secondary hover:border-teal/30 hover:text-teal-ink'}`}>À vista</button>
                          <button type="button" onClick={() => setPlanoForma(planoForma === 'parcelado' ? null : 'parcelado')} className={`min-h-11 rounded-xl border text-xs font-semibold transition-colors ${planoForma === 'parcelado' ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border text-text-secondary hover:border-teal/30 hover:text-teal-ink'}`}>Parcelado</button>
                        </div>
                        {planoForma === 'parcelado' && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-text-secondary">Nº de parcelas</Label>
                          <Input
                            type="number" min={2} max={24}
                            value={planoNumParcelas}
                            onChange={(e) => setPlanoNumParcelas(e.target.value)}
                            className="rounded-xl bg-surface border-border text-text-primary font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-text-secondary">{isTeamWorkspaceEnabled({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }) && planoParcelasForma === 'cartao_credito' ? '1º lançamento' : '1º vencimento'}</Label>
                          <Input
                            type="date"
                            value={planoPrimeiroVencimento}
                            onChange={(e) => setPlanoPrimeiroVencimento(e.target.value)}
                            className="rounded-xl bg-surface border-border text-text-primary"
                          />
                        </div>
                      </div>
                      <Select
                        value={planoParcelasForma || undefined}
                        onValueChange={(v) => v && setPlanoParcelasForma(v as FormaPagamento)}
                      >
                        <SelectTrigger className="rounded-xl bg-surface border-border text-text-primary">
                          <SelectValue placeholder="Forma das parcelas (opcional)..." />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {(Object.keys(FORMA_LABEL) as FormaPagamento[]).map((f) => (
                            <SelectItem key={f} value={f}>{FORMA_LABEL[f]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {planoParcelasForma === 'cartao_credito' && isTeamWorkspaceEnabled({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }) && <p className="text-xs text-muted-foreground">Ao salvar, as parcelas do cartão ficam confirmadas, cada uma no seu mês. Não será preciso dar baixa todo mês.</p>}
                      {(() => {
                        const n = parseInt(planoNumParcelas, 10);
                        if (!n || n < 2 || novoOrcTotal <= 0) return null;
                        return (
                          <p className="text-[11px] text-text-secondary bg-surface rounded-xl px-3 py-2">
                            {n}x de R$ {formatValorBR(novoOrcTotal / n)}
                          </p>
                        );
                      })()}
                    </div>
                        )}
                      </div>
                    )}
                  </>
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
                  onClick={continuar}
                  disabled={Boolean(bloqueioCriacao) || orcSaving || novoOrcItens.every((item) => item.selecionado === false || !item.descricao.trim())}
                  className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
                >
                  {orcSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : modoPersistencia === 'adicionar' ? 'Atualizar e continuar' : 'Criar e continuar'}
                </Button>
                {modoPersistencia === 'adicionar' && (
                  <Button
                    variant="outline"
                    onClick={onManterOrcamento}
                    disabled={orcSaving}
                    className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                  >
                    Manter orçamento como está
                  </Button>
                )}
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
