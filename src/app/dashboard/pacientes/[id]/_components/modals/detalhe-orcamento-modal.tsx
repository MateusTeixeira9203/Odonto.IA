'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Edit2, Trash2, CircleDollarSign, Plus, CheckCircle2,
  XCircle, Loader2, CreditCard, Clock, Banknote, Smartphone,
  Receipt, ArrowUpRight, User, Send, BadgeCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { LucideIcon } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { StatusOrcamento, FormaPagamento } from '@/app/dashboard/orcamentos/actions';
import { STATUS_ORCAMENTO } from '@/lib/constants/orcamento-status';
import type { OrcamentoComItens, OrcEditItem } from '../types';

// ─── status options ───────────────────────────────────────────────────────────

type StatusOption = {
  value: StatusOrcamento;
  label: string;
  icon: LucideIcon;
  active: string;
  inactive: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'enviado',
    label: 'Enviado',
    icon: Send,
    active: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-600 dark:text-yellow-400',
    inactive: 'border-border text-text-secondary hover:border-yellow-400/30 hover:text-yellow-600',
  },
  {
    value: 'aprovado',
    label: 'Aprovado',
    icon: CheckCircle2,
    active: 'bg-teal/10 border-teal/40 text-teal',
    inactive: 'border-border text-text-secondary hover:border-teal/30 hover:text-teal',
  },
  {
    value: 'recusado',
    label: 'Recusado',
    icon: XCircle,
    active: 'bg-red-500/10 border-red-400/40 text-red-500',
    inactive: 'border-border text-text-secondary hover:border-red-400/30 hover:text-red-500',
  },
  {
    value: 'pago',
    label: 'Pago',
    icon: BadgeCheck,
    active: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
    inactive: 'border-border text-text-secondary hover:border-emerald-400/30 hover:text-emerald-600',
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX',
  cartao_credito: 'Cartão de Crédito', cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto', outro: 'Outro',
};

const FORMA_ICON: Record<string, React.ElementType> = {
  dinheiro: Banknote, pix: Smartphone,
  cartao_credito: CreditCard, cartao_debito: CreditCard,
  boleto: Receipt, outro: CircleDollarSign,
};

// ─── types ────────────────────────────────────────────────────────────────────

type PagForm = { valor: string; formaPagamento: FormaPagamento; data: string };

interface Props {
  detalheOrc: OrcamentoComItens | null;
  detalheOrcId: string | null;
  onClose: () => void;
  pagForm: PagForm;
  setPagForm: React.Dispatch<React.SetStateAction<PagForm>>;
  pagSaving: boolean;
  pagError: string | null;
  orcEditMode: boolean;
  setOrcEditMode: (v: boolean) => void;
  orcEditItens: OrcEditItem[];
  setOrcEditItens: React.Dispatch<React.SetStateAction<OrcEditItem[]>>;
  orcEditSaving: boolean;
  orcEditError: string | null;
  setOrcEditError: (v: string | null) => void;
  onOpenEditOrc: () => void;
  onSalvarEdicaoOrc: () => void;
  onStatusChange: (id: string, status: StatusOrcamento) => void;
  onRegistrarPagamento: () => void;
  onDeleteClick: (id: string | null) => void;
}

// ─── component ───────────────────────────────────────────────────────────────

export function DetalheOrcamentoModal({
  detalheOrc, detalheOrcId, onClose,
  pagForm, setPagForm, pagSaving, pagError,
  orcEditMode, setOrcEditMode, orcEditItens, setOrcEditItens,
  orcEditSaving, orcEditError, setOrcEditError,
  onOpenEditOrc, onSalvarEdicaoOrc,
  onStatusChange, onRegistrarPagamento, onDeleteClick,
}: Props) {
  const [isApprovingLocal, setIsApprovingLocal] = useState(false);
  const [justApproved, setJustApproved] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [activityLogs, setActivityLogs] = useState<{ id: string; actor_nome: string | null; action: string; created_at: string }[]>([]);

  // Patch 4: Lazy-fetch activity logs quando o modal abre
  useEffect(() => {
    if (!detalheOrc) { setActivityLogs([]); return; }
    const supabase = createClient();
    void supabase
      .from('activity_logs')
      .select('id, actor_nome, action, created_at')
      .eq('entity_type', 'orcamento')
      .eq('entity_id', detalheOrc.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setActivityLogs((data ?? []) as { id: string; actor_nome: string | null; action: string; created_at: string }[]));
  }, [detalheOrc?.id]);

  const ACTION_LABEL: Record<string, string> = {
    orcamento_aprovado: 'Aprovado',
    orcamento_enviado:  'Enviado ao paciente',
    orcamento_recusado: 'Recusado',
    pagamento_registrado: 'Pagamento registrado',
    status_alterado: 'Status alterado',
  };

  function handleStatusChangeSafe(id: string, status: StatusOrcamento) {
    if (isChangingStatus) return;
    setIsChangingStatus(true);
    onStatusChange(id, status);
    setTimeout(() => setIsChangingStatus(false), 1200);
  }

  const { totalPago, totalPendente, pctPago, quitado } = useMemo(() => {
    if (!detalheOrc) return { totalPago: 0, totalPendente: 0, pctPago: 0, quitado: false };
    const pago    = detalheOrc.pagamentos.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
    const pendente= detalheOrc.pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
    const total   = detalheOrc.total ?? 0;
    return {
      totalPago:    pago,
      totalPendente: pendente,
      pctPago:      total > 0 ? Math.min(100, (pago / total) * 100) : 0,
      quitado:      total > 0 && pago >= total,
    };
  }, [detalheOrc]);

  async function handleApprove() {
    if (!detalheOrc) return;
    setIsApprovingLocal(true);
    onStatusChange(detalheOrc.id, 'aprovado');
    await new Promise(r => setTimeout(r, 600));
    setIsApprovingLocal(false);
    setJustApproved(true);
    setTimeout(() => setJustApproved(false), 3000);
  }

  return (
    <Dialog open={!!detalheOrcId} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="rounded-3xl bg-surface border-border p-0 overflow-hidden gap-0"
        style={{ width: '78vw', maxWidth: 'none', maxHeight: '90vh', left: '50%' }}
        showCloseButton={false}
      >
        {detalheOrc && (
          <>
            {/* ── Header premium ──────────────────────────────────────── */}
            <div
              className="relative px-8 pt-6 pb-5 shrink-0"
              style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    {justApproved
                      ? <CheckCircle2 className="w-5 h-5 text-white" />
                      : <CircleDollarSign className="w-5 h-5 text-white" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <DialogTitle className="font-heading font-semibold text-xl text-white leading-tight">
                        {justApproved ? 'Orçamento Aprovado!' : 'Orçamento'}
                      </DialogTitle>
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/20 text-white">
                        {STATUS_ORCAMENTO[detalheOrc.status]?.label ?? detalheOrc.status}
                      </span>
                    </div>
                    <DialogDescription className="text-white/70 text-xs">
                      {format(parseISO(detalheOrc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </DialogDescription>
                  </div>
                </div>

                {/* Payment progress pill */}
                {detalheOrc.pagamentos.length > 0 && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60 font-mono">
                        {pctPago.toFixed(0)}% pago
                      </span>
                      {quitado && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full">
                          Quitado
                        </span>
                      )}
                    </div>
                    <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-700"
                        style={{ width: `${pctPago}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Body: two columns ───────────────────────────────────── */}
            <div className="flex" style={{ height: 'calc(90vh - 96px)', minHeight: 0 }}>

              {/* ── Left column ───────────────────────────────────────── */}
              <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">

                {/* Approval CTA — só quando enviado */}
                {detalheOrc.status === 'enviado' && !justApproved && (
                  <div className="rounded-2xl border border-teal/25 bg-gradient-to-br from-teal/5 to-transparent p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-teal/15 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
                      </div>
                      <p className="text-sm font-bold text-text-primary">Orçamento aguardando aprovação</p>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Este orçamento foi enviado ao paciente. Ao aprovar, o tratamento é confirmado e o pagamento fica aguardando registro.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleApprove()}
                        disabled={isApprovingLocal}
                        className="flex-1 py-2.5 bg-teal text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-teal-lt disabled:opacity-60 transition-all shadow-[0_4px_20px_rgba(47,156,133,0.3)]"
                      >
                        {isApprovingLocal
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Aprovando...</>
                          : <><CheckCircle2 className="w-4 h-4" />Aprovar Orçamento</>
                        }
                      </button>
                      <button
                        onClick={() => handleStatusChangeSafe(detalheOrc.id, 'recusado')}
                        className="px-4 py-2.5 bg-surface-alt text-text-secondary rounded-xl text-sm font-medium hover:bg-coral/10 hover:text-coral transition-colors border border-border"
                        title="Recusar orçamento"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Aprovado — feedback visual */}
                {justApproved && (
                  <div className="rounded-2xl border border-teal/25 bg-teal/5 p-5 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-teal shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-teal">Orçamento aprovado com sucesso</p>
                      <p className="text-xs text-text-secondary mt-0.5">Registre o pagamento quando o paciente confirmar.</p>
                    </div>
                  </div>
                )}

                {/* Status selector — pills */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-teal">Status</p>
                    {!orcEditMode && (
                      <button
                        onClick={onOpenEditOrc}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = detalheOrc.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleStatusChangeSafe(detalheOrc.id, opt.value)}
                          disabled={isChangingStatus}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
                            isActive ? opt.active : opt.inactive
                          }`}
                        >
                          <opt.icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Audit: aprovação */}
                {detalheOrc.status === 'aprovado' && (detalheOrc.aprovado_por || detalheOrc.aprovado_em) && (
                  <div className="flex items-center gap-2 bg-teal/5 border border-teal/15 rounded-xl px-3 py-2.5">
                    <User className="w-3.5 h-3.5 text-teal shrink-0" />
                    <p className="text-xs text-text-secondary">
                      {detalheOrc.aprovado_por && (
                        <span>Aprovado por <span className="font-semibold text-text-primary">{detalheOrc.aprovado_por.nome}</span></span>
                      )}
                      {detalheOrc.aprovado_em && (
                        <span> em {format(parseISO(detalheOrc.aprovado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Procedimentos */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-teal">
                    Procedimentos
                    <span className="ml-2 text-text-secondary font-normal normal-case">({detalheOrc.itens.length})</span>
                  </p>

                  {orcEditMode ? (
                    <div className="space-y-3">
                      {orcEditItens.map((item, idx) => (
                        <div key={idx} className="bg-surface-alt rounded-2xl border border-border p-4 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Descrição do procedimento"
                              value={item.descricao}
                              onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                              className="rounded-xl bg-surface border-border text-text-primary text-sm flex-1"
                            />
                            <button
                              onClick={() => setOrcEditItens(prev => prev.filter((_, i) => i !== idx))}
                              className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div className="space-y-1 w-20">
                              <label className="text-xs text-text-secondary">Qtd</label>
                              <Input
                                type="number" min="1" value={item.quantidade}
                                onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))}
                                className="rounded-xl bg-surface border-border text-text-primary text-sm font-mono"
                              />
                            </div>
                            <div className="space-y-1 flex-1">
                              <label className="text-xs text-text-secondary">Preço unitário (R$)</label>
                              <Input
                                type="number" min="0" step="0.01" value={item.preco_unitario}
                                onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, preco_unitario: parseFloat(e.target.value) || 0 } : it))}
                                className="rounded-xl bg-surface border-border text-text-primary text-sm font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setOrcEditItens(prev => [...prev, { descricao: '', quantidade: 1, preco_unitario: 0 }])}
                        className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Adicionar procedimento
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border overflow-hidden">
                      {detalheOrc.itens.length === 0 ? (
                        <div className="p-6 text-center text-sm text-text-secondary">Nenhum procedimento registrado.</div>
                      ) : (
                        <>
                          {detalheOrc.itens.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-surface-alt/40 transition-colors"
                            >
                              <span className="w-6 h-6 rounded-lg bg-teal/10 text-teal text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">
                                  {item.descricao ?? '—'}
                                </p>
                                {item.quantidade > 1 && (
                                  <p className="text-[11px] text-text-secondary font-mono">
                                    {item.quantidade} unidades × R$ {fmt((item.preco_total ?? 0) / item.quantidade)}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono text-sm font-semibold text-text-primary shrink-0">
                                R$ {fmt(item.preco_total ?? 0)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-4 py-3 bg-teal/5">
                            <span className="text-sm font-bold text-text-primary">Total</span>
                            <span className="font-mono text-lg font-bold text-teal">
                              R$ {fmt(detalheOrc.total ?? 0)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Histórico de pagamentos */}
                {detalheOrc.pagamentos.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-teal">Pagamentos</p>
                      <div className="flex items-center gap-3 text-xs font-mono text-text-secondary">
                        <span className="text-teal font-semibold">R$ {fmt(totalPago)} pago</span>
                        {totalPendente > 0 && (
                          <span className="text-yellow-600">R$ {fmt(totalPendente)} pendente</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {detalheOrc.pagamentos.map(pg => {
                        const Icon = FORMA_ICON[pg.forma_pagamento ?? 'outro'] ?? CircleDollarSign;
                        const isPago = pg.status === 'pago';
                        return (
                          <div
                            key={pg.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                              isPago
                                ? 'border-teal/20 bg-teal/5'
                                : 'border-border bg-surface-alt/40'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isPago ? 'bg-teal/15 text-teal' : 'bg-surface-alt text-text-secondary'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">
                                {FORMA_LABEL[pg.forma_pagamento ?? 'outro'] ?? 'Pagamento'}
                              </p>
                              <p className="text-[11px] text-text-secondary">
                                {isPago ? 'Pago' : 'Pendente'}
                                {pg.marcado_por && ` · por ${pg.marcado_por.nome.split(' ')[0]}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-mono text-sm font-semibold ${isPago ? 'text-teal' : 'text-text-secondary'}`}>
                                R$ {fmt(pg.valor)}
                              </p>
                              {isPago
                                ? <CheckCircle2 className="w-3 h-3 text-teal ml-auto mt-0.5" />
                                : <Clock className="w-3 h-3 text-text-secondary ml-auto mt-0.5" />
                              }
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Atividade deste orçamento */}
                {activityLogs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-text-secondary/50">Atividade</p>
                    <div className="space-y-0">
                      {activityLogs.map(log => (
                        <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal/40 shrink-0" />
                          <p className="text-xs flex-1 min-w-0">
                            <span className="font-medium text-text-primary">{ACTION_LABEL[log.action] ?? log.action}</span>
                            {log.actor_nome && (
                              <span className="ml-1 text-text-secondary/60">por {log.actor_nome.split(' ')[0]}</span>
                            )}
                          </p>
                          <span className="font-mono text-xs text-text-secondary shrink-0">
                            {format(parseISO(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right column ──────────────────────────────────────── */}
              <div className="w-72 shrink-0 border-l border-border flex flex-col" style={{ background: 'rgba(47,156,133,0.04)' }}>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* Total hero card */}
                  <div className="rounded-2xl p-5 border border-teal/15 space-y-3" style={{ background: 'rgba(47,156,133,0.07)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-teal">
                      {orcEditMode ? 'Novo total' : 'Total do tratamento'}
                    </p>
                    <p className="font-mono text-3xl font-bold text-teal leading-none">
                      R$ {fmt(orcEditMode
                        ? orcEditItens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
                        : detalheOrc.total ?? 0
                      )}
                    </p>

                    {/* Payment progress bar */}
                    {!orcEditMode && detalheOrc.pagamentos.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-text-secondary">
                          <span>Pago</span>
                          <span className="font-mono">{pctPago.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-teal/15 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full transition-all duration-700"
                            style={{ width: `${pctPago}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs font-mono text-text-secondary">
                          <span className="text-teal">R$ {fmt(totalPago)}</span>
                          {totalPendente > 0 && <span className="text-yellow-600">R$ {fmt(totalPendente)} pend.</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Registrar pagamento */}
                  {!orcEditMode && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-teal flex items-center gap-1.5">
                        <ArrowUpRight className="w-3 h-3" />
                        Registrar Pagamento
                      </p>
                      <div className="space-y-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-text-secondary">Valor (R$)</Label>
                          <Input
                            type="number" placeholder="0,00" min="0" step="0.01"
                            value={pagForm.valor}
                            onChange={e => setPagForm(f => ({ ...f, valor: e.target.value }))}
                            className="rounded-xl bg-surface-alt border-border text-text-primary font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-text-secondary">Data do recebimento</Label>
                          <Input
                            type="date" value={pagForm.data}
                            onChange={e => setPagForm(f => ({ ...f, data: e.target.value }))}
                            className="rounded-xl bg-surface-alt border-border text-text-primary"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-text-secondary">Forma de pagamento</Label>
                          <Select
                            value={pagForm.formaPagamento}
                            onValueChange={v => v && setPagForm(f => ({ ...f, formaPagamento: v as FormaPagamento }))}
                          >
                            <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface border-border">
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                              <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {pagError && (
                          <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{pagError}</p>
                        )}
                        <Button
                          onClick={onRegistrarPagamento}
                          disabled={pagSaving || !pagForm.valor}
                          className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-semibold"
                        >
                          {pagSaving
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                            : 'Confirmar Pagamento'
                          }
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="p-5 border-t border-border space-y-2">
                  {orcEditMode ? (
                    <>
                      {orcEditError && (
                        <p className="text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">{orcEditError}</p>
                      )}
                      <Button
                        onClick={onSalvarEdicaoOrc}
                        disabled={orcEditSaving}
                        className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl font-bold"
                      >
                        {orcEditSaving
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                          : 'Salvar Alterações'
                        }
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setOrcEditMode(false); setOrcEditError(null); }}
                        disabled={orcEditSaving}
                        className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
                      >
                        Fechar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => onDeleteClick(detalheOrcId)}
                        className="w-full rounded-xl border-red-500/30 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Excluir
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
