'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CircleDollarSign, AlertTriangle } from 'lucide-react';
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
import type { FichaParaOrc, ProcedimentoClinica, NovoOrcItem } from '../types';

interface NovoOrcamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapaNovoOrc: 'selecionar' | 'itens';
  setEtapaNovoOrc: (v: 'selecionar' | 'itens') => void;
  fichasParaOrc: FichaParaOrc[];
  orcError: string | null;
  novoOrcItens: NovoOrcItem[];
  setNovoOrcItens: React.Dispatch<React.SetStateAction<NovoOrcItem[]>>;
  procedimentosClinica: ProcedimentoClinica[];
  novoOrcSubtotal: number;
  novoOrcTotal: number;
  novoOrcValorFinal: number | null;
  setNovoOrcValorFinal: React.Dispatch<React.SetStateAction<number | null>>;
  orcSaving: boolean;
  onCriarOrcamento: () => void;
  onSelecionarFicha: (fichaId: string | null) => void;
  onCadastrarProcedimento: (idx: number) => void;
  registeringProcIdx: number | null;
}

export function NovoOrcamentoModal({
  open,
  onOpenChange,
  etapaNovoOrc,
  setEtapaNovoOrc,
  fichasParaOrc,
  orcError,
  novoOrcItens,
  setNovoOrcItens,
  procedimentosClinica,
  novoOrcSubtotal,
  novoOrcTotal,
  novoOrcValorFinal,
  setNovoOrcValorFinal,
  orcSaving,
  onCriarOrcamento,
  onSelecionarFicha,
  onCadastrarProcedimento,
  registeringProcIdx,
}: NovoOrcamentoModalProps) {
  const [valorFinalTexto, setValorFinalTexto] = useState(
    novoOrcValorFinal !== null ? formatValorBR(novoOrcValorFinal) : ''
  );
  const temDesconto = novoOrcValorFinal !== null && novoOrcSubtotal > 0 && novoOrcValorFinal < novoOrcSubtotal;
  const pctDesconto = temDesconto
    ? Math.round(((novoOrcSubtotal - novoOrcValorFinal!) / novoOrcSubtotal) * 100 * 10) / 10
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-3xl bg-surface border-border p-0 overflow-hidden gap-0"
        style={{ width: '78vw', maxWidth: 'none', maxHeight: '90vh', left: '50%' }}
        showCloseButton={false}
      >
        {/* Banner teal */}
        <div className="relative px-8 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="font-heading font-semibold text-xl text-white leading-tight">
                {etapaNovoOrc === 'selecionar' ? 'Selecionar Ficha' : 'Novo Orçamento'}
              </DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-0.5">
                {etapaNovoOrc === 'selecionar'
                  ? 'Escolha qual registro clínico vai gerar o orçamento.'
                  : 'Selecione procedimentos e defina os valores.'}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Etapa 1: seleção de ficha (coluna única) ── */}
        {etapaNovoOrc === 'selecionar' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ height: 'calc(90vh - 92px)' }}>
            {fichasParaOrc.map((ficha) => {
              const denteCount = (ficha.dentes_afetados ?? []).length;
              const dataFormatada = format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
              return (
                <button
                  key={ficha.id}
                  onClick={() => onSelecionarFicha(ficha.id)}
                  className="w-full text-left p-4 rounded-xl border border-border bg-surface-alt hover:border-teal/40 hover:bg-teal/5 transition-all group"
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
            <button
              onClick={() => onSelecionarFicha(null)}
              className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar orçamento em branco
            </button>
          </div>
        )}

        {/* ── Etapa 2: edição de itens (duas colunas) ── */}
        {etapaNovoOrc === 'itens' && (
          <div className="flex" style={{ height: 'calc(90vh - 92px)', minHeight: 0 }}>

            {/* Coluna esquerda — itens */}
            <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4">
              {novoOrcItens.map((item, idx) => (
                <div key={idx} className={`bg-surface-alt rounded-2xl border p-4 space-y-3 transition-all duration-200 ${
                  parseValorBR(item.preco) > 0 ? 'border-l-2 border-l-teal/50 border-t-border border-r-border border-b-border' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-text-secondary uppercase tracking-widest">
                      Procedimento {idx + 1}
                    </span>
                    {novoOrcItens.length > 1 && (
                      <button
                        onClick={() => setNovoOrcItens((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <Select
                    value={item.procedimentoId}
                    onValueChange={(v) => {
                      if (!v) return;
                      const proc = procedimentosClinica.find((p) => p.id === v);
                      setNovoOrcItens((prev) =>
                        prev.map((it, i) =>
                          i === idx
                            ? { ...it, procedimentoId: v, descricao: proc?.nome ?? it.descricao, preco: proc?.preco_padrao != null ? formatValorBR(proc.preco_padrao) : it.preco }
                            : it
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="rounded-xl bg-surface border-border text-text-primary">
                      <SelectValue>
                        {(v: string | null) =>
                          v ? (procedimentosClinica.find((p) => p.id === v)?.nome ?? v) : 'Vincular ao catálogo (preenche preço)...'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {procedimentosClinica.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Descrição do procedimento *"
                    value={item.descricao}
                    onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                    className="rounded-xl bg-surface border-border text-text-primary"
                  />

                  <div className="grid grid-cols-[80px_1fr] gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-text-secondary">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))}
                        className="rounded-xl bg-surface border-border text-text-primary font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-text-secondary">Valor unitário (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={item.preco}
                        onChange={(e) => setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: e.target.value } : it))}
                        onBlur={(e) => {
                          const parsed = parseValorBR(e.target.value);
                          setNovoOrcItens((prev) => prev.map((it, i) => i === idx ? { ...it, preco: parsed > 0 ? formatValorBR(parsed) : it.preco } : it));
                        }}
                        className="rounded-xl bg-surface border-border text-text-primary font-mono"
                      />
                    </div>
                  </div>

                  {parseValorBR(item.preco) > 0 && (
                    <div className="flex justify-end pt-1 border-t border-border/40">
                      <span className="text-xs font-mono font-semibold text-teal">
                        = R$ {(item.quantidade * parseValorBR(item.preco)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {!item.procedimentoId && item.descricao.trim() && (
                    <div className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Procedimento não cadastrado no catálogo
                      </span>
                      <button
                        onClick={() => onCadastrarProcedimento(idx)}
                        disabled={registeringProcIdx === idx}
                        className="shrink-0 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50"
                      >
                        {registeringProcIdx === idx ? 'Cadastrando...' : '+ Cadastrar no catálogo'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => setNovoOrcItens((prev) => [...prev, { procedimentoId: '', descricao: '', quantidade: 1, preco: '' }])}
                className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Procedimento
              </button>
            </div>

            {/* Coluna direita — total + ações */}
            <div className="w-64 shrink-0 border-l border-border flex flex-col" style={{ background: 'rgba(47,156,133,0.04)' }}>
              <div className="flex-1 p-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2f9c85' }}>
                  Resumo
                </p>

                {/* Subtotal */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    Total dos procedimentos
                  </p>
                  <p className="font-mono text-lg font-semibold text-text-primary">
                    R$ {novoOrcSubtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Campo valor final negociado */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                    Valor final negociado (R$)
                  </Label>
                  <Input
                    type="text" inputMode="decimal"
                    placeholder={novoOrcSubtotal.toFixed(2)}
                    value={valorFinalTexto}
                    onChange={(e) => setValorFinalTexto(e.target.value)}
                    onBlur={(e) => {
                      const parsed = parseValorBR(e.target.value);
                      setNovoOrcValorFinal(parsed > 0 ? parsed : null);
                      setValorFinalTexto(parsed > 0 ? formatValorBR(parsed) : '');
                    }}
                    className="rounded-xl bg-surface border-border text-text-primary font-mono"
                  />
                  {temDesconto && (
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Desconto de {pctDesconto}% aplicado
                    </p>
                  )}
                  {novoOrcValorFinal !== null && novoOrcValorFinal > novoOrcSubtotal && (
                    <p className="text-[11px] text-amber-500">
                      Valor maior que o total
                    </p>
                  )}
                </div>

                {/* Card de total final */}
                <div className="rounded-2xl p-4 space-y-2 border border-teal/15" style={{ background: 'rgba(47,156,133,0.07)' }}>
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
                        <p className="text-xs font-mono font-semibold text-red-400">
                          − R$ {(novoOrcSubtotal - novoOrcTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="h-px bg-teal/20" />
                    </>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal/70">Total</p>
                  <p className="font-mono text-3xl font-bold text-teal leading-none">
                    R$ {novoOrcTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-text-secondary font-mono">
                    {novoOrcItens.filter(i => i.descricao.trim()).length} item(s)
                  </p>
                </div>
              </div>

              <div className="p-5 border-t border-border space-y-2">
                {orcError && (
                  <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{orcError}</p>
                )}
                <Button
                  onClick={onCriarOrcamento}
                  disabled={orcSaving}
                  className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
                >
                  {orcSaving ? 'Salvando...' : 'Criar Orçamento'}
                </Button>
                {fichasParaOrc.length > 1 && (
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
