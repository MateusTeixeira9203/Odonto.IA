'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Edit2, Trash2, CircleDollarSign, Plus, CheckCircle2, Check,
  Loader2, CreditCard, Banknote, Smartphone,
  Receipt, User, X, PenLine,
} from 'lucide-react';
import { AceiteOrcamentoModal } from '@/components/orcamentos/aceite-orcamento-modal';
import { BotaoDownloadPDF } from '@/components/orcamentos/botao-download-pdf';
import { BotaoEnviarWhatsApp } from '@/components/orcamentos/botao-enviar-whatsapp';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  cancelarCobrancaEtapa,
  criarCobrancaEtapa,
  editarPagamento,
  estornarPagamento,
  registrarRecebimentoCobranca,
  type FormaPagamento,
} from '@/app/dashboard/orcamentos/actions';
import { deriveEstadoOrcamento, rotuloEstado, type EstadoOrcamento } from '@/lib/orcamentos/estado';
import { deriveEstadoCobrancaEtapa } from '@/lib/orcamentos/cobranca-etapa';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import { toast } from 'sonner';
import type { OrcamentoComItens, OrcEditItem, Pagamento } from '../types';

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

type PagForm = { valor: string; formaPagamento: FormaPagamento; data: string; dataVencimento: string };
// editarPagamento não altera vencimento — edição de um pagamento existente fica
// restrita a valor/forma/data, sem o campo de agendamento futuro.
type EditPagForm = { valor: string; formaPagamento: FormaPagamento; data: string };
type ParcelasForm = { numero: string; primeiroVencimento: string };

interface Props {
  detalheOrc: OrcamentoComItens | null;
  detalheOrcId: string | null;
  onClose: () => void;
  /** R-39a — carona nos 2 itens da R-33 que o Mateus pediu antes da hora: PDF e WhatsApp
   *  já existiam em botao-download-pdf.tsx/botao-enviar-whatsapp.tsx (zero backend), só
   *  não estavam pendurados nesta tela ainda. */
  pacienteTelefone: string | null | undefined;
  pacienteNome: string;
  pacienteId: string;
  pagForm: PagForm;
  setPagForm: React.Dispatch<React.SetStateAction<PagForm>>;
  pagSaving: boolean;
  pagError: string | null;
  parcelasMode: boolean;
  setParcelasMode: (v: boolean) => void;
  parcelasForm: ParcelasForm;
  setParcelasForm: React.Dispatch<React.SetStateAction<ParcelasForm>>;
  parcelasSaving: boolean;
  parcelasError: string | null;
  onGerarParcelas: () => void;
  orcEditMode: boolean;
  setOrcEditMode: (v: boolean) => void;
  orcEditItens: OrcEditItem[];
  setOrcEditItens: React.Dispatch<React.SetStateAction<OrcEditItem[]>>;
  orcEditSaving: boolean;
  orcEditError: string | null;
  setOrcEditError: (v: string | null) => void;
  onOpenEditOrc: () => void;
  onSalvarEdicaoOrc: () => void;
  /** R-114 — o paciente aceitou (ou desmarcou) UM procedimento. Estado deriva sozinho. */
  onAlternarAprovacaoItem: (itemId: string, aprovado: boolean) => void;
  /** R-114 — atalho de 1 clique: aprova todos os itens ainda não aprovados, num UPDATE só. */
  onAprovarTodosItens: (orcamentoId: string) => void;
  onRegistrarPagamento: () => void;
  /** R-28 — id da parcela pendente sendo fechada; null = Registrar pagamento em modo criar novo. */
  closingPagamentoId: string | null;
  onIniciarFechamentoPagamento: (pg: Pagamento) => void;
  onCancelarFechamentoPagamento: () => void;
  onDeleteClick: (id: string | null) => void;
  /** R-66 — a policy `orcamentos_delete_own` só libera DELETE pro dentista dono (sem exceção
   *  admin/secretaria). Botão só aparece pra quem o clique não vai falhar de qualquer forma —
   *  o servidor (`excluirOrcamento`) continua sendo a fonte da verdade, isto é só evitar
   *  oferecer uma ação que sempre nega. */
  podeExcluir: boolean;
  editingPagId: string | null;
  editPagForm: EditPagForm;
  setEditPagForm: React.Dispatch<React.SetStateAction<EditPagForm>>;
  editPagSaving: boolean;
  editPagError: string | null;
  onIniciarEdicaoPagamento: (pg: Pagamento) => void;
  onCancelarEdicaoPagamento: () => void;
  onSalvarEdicaoPagamento: () => void;
  confirmDeletePagId: string | null;
  setConfirmDeletePagId: (id: string | null) => void;
  pagDeleteSaving: boolean;
  onExcluirPagamento: (id: string, motivoEstorno?: string) => void;
  editValorAcordadoAberto: boolean;
  valorAcordadoTexto: string;
  setValorAcordadoTexto: React.Dispatch<React.SetStateAction<string>>;
  valorAcordadoSaving: boolean;
  valorAcordadoError: string | null;
  onIniciarEdicaoValorAcordado: () => void;
  onCancelarEdicaoValorAcordado: () => void;
  onSalvarValorAcordado: () => void;
  /** R-03c-1 — chamado depois que o servidor confirma o aceite (o pai decide como refletir). */
  onAceiteRegistrado: () => void;
  /** R-38 — liga/desliga o valor por procedimento no PDF deste orçamento. */
  onToggleMostrarValorPorItem: (id: string, mostrar: boolean) => void;
}

function CobrancasPorEtapa({ orcamento, pacienteId, permitirNovaEtapa }: {
  orcamento: OrcamentoComItens; pacienteId: string; permitirNovaEtapa: boolean;
}) {
  const router = useRouter();
  const hoje = new Date().toISOString().split('T')[0];
  const [formAberto, setFormAberto] = useState(false);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [desconto, setDesconto] = useState('');
  const [formaCobranca, setFormaCobranca] = useState<'avista' | 'parcelado'>('avista');
  const [numeroParcelas, setNumeroParcelas] = useState('3');
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hoje);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cobrancaRecebendoId, setCobrancaRecebendoId] = useState<string | null>(null);
  const [recebimento, setRecebimento] = useState({ valor: '', forma: 'pix' as FormaPagamento, data: hoje });
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [pagamentoEditandoId, setPagamentoEditandoId] = useState<string | null>(null);
  const [pagamentoEditado, setPagamentoEditado] = useState({ valor: '', forma: 'pix' as FormaPagamento, data: hoje });
  const [pagamentoEstornandoId, setPagamentoEstornandoId] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');

  const idsCobrados = useMemo(() => new Set(
    orcamento.cobrancas
      .filter((cobranca) => cobranca.situacao === 'aberta')
      .flatMap((cobranca) => cobranca.itens.map((item) => item.orcamento_item_id)),
  ), [orcamento.cobrancas]);
  const itensElegiveis = useMemo(() => orcamento.itens.filter(
    (item) => item.aprovado && !idsCobrados.has(item.id),
  ), [idsCobrados, orcamento.itens]);
  const subtotalSelecionado = useMemo(() => itemIds.reduce((soma, itemId) => {
    const item = orcamento.itens.find((candidate) => candidate.id === itemId);
    return soma + (item?.preco_total ?? 0);
  }, 0), [itemIds, orcamento.itens]);
  const descontoNumero = parseValorBR(desconto);
  const valorFinal = Math.max(0, subtotalSelecionado - descontoNumero);
  const itemPorId = useMemo(() => new Map(orcamento.itens.map((item) => [item.id, item])), [orcamento.itens]);

  const toggleItem = (itemId: string) => {
    setItemIds((current) => current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]);
  };

  const criarEtapa = async () => {
    const parcelas = formaCobranca === 'avista' ? 1 : Number(numeroParcelas);
    if (itemIds.length === 0) {
      setErro('Selecione os procedimentos que serão cobrados nesta etapa.');
      return;
    }
    if (descontoNumero > subtotalSelecionado) {
      setErro('O desconto não pode ser maior que o subtotal selecionado.');
      return;
    }
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 24) {
      setErro('Informe entre 2 e 24 parcelas.');
      return;
    }
    if (formaCobranca === 'parcelado' && parcelas < 2) {
      setErro('Parcelamento mensal começa em 2 parcelas.');
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await criarCobrancaEtapa({
      orcamentoId: orcamento.id,
      pacienteId,
      itemIds,
      desconto: descontoNumero,
      numeroParcelas: parcelas,
      primeiroVencimento,
    });
    setSaving(false);
    if (result.error) {
      setErro(result.error);
      return;
    }
    setFormAberto(false);
    setItemIds([]);
    setDesconto('');
    setFormaCobranca('avista');
    setNumeroParcelas('3');
    setPrimeiroVencimento(hoje);
    toast.success(parcelas === 1 ? 'Cobrança criada. O saldo já apareceu no Financeiro.' : 'Parcelas mensais criadas no Financeiro.');
    router.refresh();
  };

  const registrar = async (cobrancaId: string) => {
    const valor = parseValorBR(recebimento.valor);
    if (!valor) {
      setErro('Informe um valor recebido.');
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await registrarRecebimentoCobranca({
      cobrancaId,
      pacienteId,
      valor,
      formaPagamento: recebimento.forma,
      data: recebimento.data,
    });
    setSaving(false);
    if (result.error) {
      setErro(result.error);
      return;
    }
    setCobrancaRecebendoId(null);
    setRecebimento({ valor: '', forma: 'pix', data: hoje });
    toast.success('Recebimento registrado. O status da etapa foi atualizado.');
    router.refresh();
  };

  const cancelar = async (cobrancaId: string) => {
    if (!motivoCancelamento.trim()) {
      setErro('Informe o motivo do cancelamento.');
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await cancelarCobrancaEtapa({ cobrancaId, pacienteId, motivo: motivoCancelamento });
    setSaving(false);
    if (result.error) {
      setErro(result.error);
      return;
    }
    setCancelandoId(null);
    setMotivoCancelamento('');
    toast.success('Cobrança cancelada; os procedimentos voltaram a ficar disponíveis.');
    router.refresh();
  };

  const salvarPagamentoEditado = async (pagamentoId: string) => {
    const valor = parseValorBR(pagamentoEditado.valor);
    if (!valor) {
      setErro('Informe um valor válido.');
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await editarPagamento(pagamentoId, {
      valor,
      formaPagamento: pagamentoEditado.forma,
      data: pagamentoEditado.data,
    });
    setSaving(false);
    if (result.error) {
      setErro(result.error);
      return;
    }
    setPagamentoEditandoId(null);
    toast.success('Recebimento corrigido e saldo da etapa recomposto.');
    router.refresh();
  };

  const estornarPagamentoDaEtapa = async (pagamentoId: string) => {
    if (!motivoEstorno.trim()) {
      setErro('Informe o motivo do estorno.');
      return;
    }
    setSaving(true);
    setErro(null);
    const result = await estornarPagamento(pagamentoId, motivoEstorno);
    setSaving(false);
    if (result.error) {
      setErro(result.error);
      return;
    }
    setPagamentoEstornandoId(null);
    setMotivoEstorno('');
    toast.success('Recebimento estornado e saldo da etapa reaberto.');
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-ink">Cobranças por etapa</p>
        <p className="mt-1 text-xs text-text-secondary">Cobrar só o que o paciente decidiu fazer agora. O restante continua como proposta.</p>
      </div>

      {orcamento.cobrancas.map((cobranca) => {
        const estado = deriveEstadoCobrancaEtapa({
          valorFinal: cobranca.valor_final,
          situacao: cobranca.situacao,
          pagamentos: cobranca.pagamentos,
        });
        const podeCancelar = cobranca.situacao === 'aberta' && estado.valorPago === 0;
        const recebendo = cobrancaRecebendoId === cobranca.id;
        const recebimentosConfirmados = cobranca.pagamentos.filter((pagamento) => pagamento.status === 'pago');
        const descricao = cobranca.itens
          .map((item) => itemPorId.get(item.orcamento_item_id)?.descricao ?? 'Procedimento')
          .join(', ');
        const classeEstado: Record<typeof estado.estado, string> = {
          pendente: 'bg-warning/15 text-warning-ink border-warning/25',
          parcial: 'bg-teal/10 text-teal-ink border-teal/30',
          paga: 'bg-teal/15 text-teal-ink border-teal/30',
          cancelada: 'bg-surface-alt text-text-secondary border-border',
        };
        const rotuloEstado: Record<typeof estado.estado, string> = {
          pendente: 'Pendente', parcial: 'Parcial', paga: 'Paga', cancelada: 'Cancelada',
        };
        return (
          <div key={cobranca.id} className="rounded-2xl border border-border bg-surface-alt/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary leading-snug">{descricao}</p>
                <p className="mt-1 text-[11px] text-text-secondary font-mono">
                  Subtotal R$ {fmt(cobranca.subtotal)}{cobranca.desconto > 0 && ` − desconto R$ ${fmt(cobranca.desconto)}`}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {cobranca.numero_parcelas === 1
                    ? `À vista · vence ${format(parseISO(cobranca.primeiro_vencimento), 'dd/MM/yyyy')}`
                    : `${cobranca.numero_parcelas}x mensais · 1º vencimento ${format(parseISO(cobranca.primeiro_vencimento), 'dd/MM/yyyy')}`}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${classeEstado[estado.estado]}`}>{rotuloEstado[estado.estado]}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-text-secondary">Final</p><p className="font-mono font-semibold text-text-primary">R$ {fmt(cobranca.valor_final)}</p></div>
              <div><p className="text-text-secondary">Recebido</p><p className="font-mono font-semibold text-teal-ink">R$ {fmt(estado.valorPago)}</p></div>
              <div><p className="text-text-secondary">Saldo</p><p className="font-mono font-semibold text-text-primary">R$ {fmt(estado.saldo)}</p></div>
            </div>

            {recebimentosConfirmados.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Recebimentos</p>
                {recebimentosConfirmados.map((pagamento) => pagamentoEditandoId === pagamento.id ? (
                  <div key={pagamento.id} className="space-y-2 rounded-lg bg-surface p-2">
                    <div className="grid grid-cols-2 gap-2"><Input value={pagamentoEditado.valor} inputMode="decimal" onChange={(event) => setPagamentoEditado((current) => ({ ...current, valor: event.target.value }))} className="h-8 font-mono text-xs" /><Input type="date" value={pagamentoEditado.data} onChange={(event) => setPagamentoEditado((current) => ({ ...current, data: event.target.value }))} className="h-8 text-xs" /></div>
                    <Select value={pagamentoEditado.forma} onValueChange={(value) => setPagamentoEditado((current) => ({ ...current, forma: value as FormaPagamento }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMA_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                    <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPagamentoEditandoId(null)} disabled={saving} className="h-7 flex-1 text-xs">Cancelar</Button><Button size="sm" onClick={() => void salvarPagamentoEditado(pagamento.id)} disabled={saving} className="h-7 flex-1 text-xs">Salvar</Button></div>
                  </div>
                ) : pagamentoEstornandoId === pagamento.id ? (
                  <div key={pagamento.id} className="space-y-2 rounded-lg bg-coral-pale p-2"><Input value={motivoEstorno} onChange={(event) => setMotivoEstorno(event.target.value)} placeholder="Motivo do estorno" maxLength={500} className="h-8 text-xs" /><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPagamentoEstornandoId(null)} disabled={saving} className="h-7 flex-1 text-xs">Voltar</Button><Button size="sm" onClick={() => void estornarPagamentoDaEtapa(pagamento.id)} disabled={saving} className="h-7 flex-1 bg-coral-pale text-coral-ink hover:bg-coral/20 text-xs">Estornar</Button></div></div>
                ) : (
                  <div key={pagamento.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs"><span className="min-w-0 flex-1 text-text-secondary">{FORMA_LABEL[pagamento.forma_pagamento ?? 'outro'] ?? 'Recebimento'} · {pagamento.data_pagamento ? format(parseISO(pagamento.data_pagamento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</span><span className="font-mono font-semibold text-teal-ink">R$ {fmt(pagamento.valor)}</span><button type="button" onClick={() => { setPagamentoEditandoId(pagamento.id); setPagamentoEditado({ valor: formatValorBR(pagamento.valor), forma: (pagamento.forma_pagamento as FormaPagamento) ?? 'pix', data: pagamento.data_pagamento ?? hoje }); }} className="text-text-secondary hover:text-text-primary">Editar</button><button type="button" onClick={() => setPagamentoEstornandoId(pagamento.id)} className="text-coral-ink">Estornar</button></div>
                ))}
              </div>
            )}

            {recebendo ? (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1"><Label className="text-[10px] text-text-secondary">Valor recebido</Label><Input value={recebimento.valor} inputMode="decimal" onChange={(event) => setRecebimento((current) => ({ ...current, valor: event.target.value }))} className="h-9 font-mono" placeholder="0,00" /></div>
                  <Button size="sm" variant="outline" onClick={() => setRecebimento((current) => ({ ...current, valor: formatValorBR(estado.saldo) }))} className="h-9 text-xs">Usar saldo</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={recebimento.data} onChange={(event) => setRecebimento((current) => ({ ...current, data: event.target.value }))} className="h-9" />
                  <Select value={recebimento.forma} onValueChange={(value) => setRecebimento((current) => ({ ...current, forma: value as FormaPagamento }))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMA_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setCobrancaRecebendoId(null)} disabled={saving} className="flex-1">Cancelar</Button><Button size="sm" onClick={() => void registrar(cobranca.id)} disabled={saving} className="flex-1 bg-teal text-white hover:bg-teal-lt">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}</Button></div>
              </div>
            ) : cancelandoId === cobranca.id ? (
              <div className="space-y-2 border-t border-border pt-3"><Input value={motivoCancelamento} onChange={(event) => setMotivoCancelamento(event.target.value)} placeholder="Motivo do cancelamento" maxLength={500} className="h-9" /><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setCancelandoId(null)} disabled={saving} className="flex-1">Voltar</Button><Button size="sm" onClick={() => void cancelar(cobranca.id)} disabled={saving} className="flex-1 bg-coral-pale text-coral-ink hover:bg-coral/20">Cancelar etapa</Button></div></div>
            ) : estado.estado !== 'paga' && estado.estado !== 'cancelada' ? (
              <div className="flex gap-2 border-t border-border pt-3"><Button size="sm" onClick={() => setCobrancaRecebendoId(cobranca.id)} className="flex-1 bg-teal text-white hover:bg-teal-lt">Registrar recebimento</Button>{podeCancelar && <Button size="sm" variant="outline" onClick={() => setCancelandoId(cobranca.id)} className="text-coral-ink">Cancelar</Button>}</div>
            ) : null}
          </div>
        );
      })}

      {permitirNovaEtapa && itensElegiveis.length > 0 && (
        formAberto ? (
          <div className="rounded-2xl border border-teal/30 bg-teal/5 p-3 space-y-3">
            <div><p className="text-sm font-semibold text-text-primary">Nova cobrança</p><p className="text-xs text-text-secondary mt-1">Selecione itens aprovados. O desconto vale somente para esta etapa.</p></div>
            <div className="space-y-1.5">{itensElegiveis.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs text-text-primary"><input type="checkbox" checked={itemIds.includes(item.id)} onChange={() => toggleItem(item.id)} className="accent-teal" /><span className="min-w-0 flex-1 truncate">{item.descricao ?? 'Procedimento'}</span><span className="font-mono">R$ {fmt(item.preco_total ?? 0)}</span></label>)}</div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-[10px] text-text-secondary">Desconto da etapa</Label><Input value={desconto} inputMode="decimal" placeholder="0,00" onChange={(event) => setDesconto(event.target.value)} className="mt-1 h-9 font-mono" /></div><div className="rounded-lg border border-border bg-surface px-3 py-2"><p className="text-[10px] text-text-secondary">Valor a cobrar</p><p className="font-mono text-sm font-semibold text-text-primary">R$ {fmt(valorFinal)}</p></div></div>
            <div className="space-y-2 rounded-lg border border-border bg-surface p-2.5">
              <Label className="text-[10px] text-text-secondary">Forma de cobrança</Label>
              <div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={() => setFormaCobranca('avista')} className={`h-9 rounded-lg border text-xs font-semibold ${formaCobranca === 'avista' ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border text-text-secondary hover:border-teal/30'}`}>À vista</button><button type="button" onClick={() => setFormaCobranca('parcelado')} className={`h-9 rounded-lg border text-xs font-semibold ${formaCobranca === 'parcelado' ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border text-text-secondary hover:border-teal/30'}`}>Parcelado</button></div>
              <div className={`grid gap-2 ${formaCobranca === 'parcelado' ? 'grid-cols-2' : 'grid-cols-1'}`}><div className={formaCobranca === 'parcelado' ? '' : 'hidden'}><Label className="text-[10px] text-text-secondary">Nº de parcelas</Label><Input type="number" min={2} max={24} value={numeroParcelas} onChange={(event) => setNumeroParcelas(event.target.value)} className="mt-1 h-9 font-mono" /></div><div><Label className="text-[10px] text-text-secondary">1º vencimento</Label><Input type="date" value={primeiroVencimento} onChange={(event) => setPrimeiroVencimento(event.target.value)} className="mt-1 h-9" /></div></div>
              {formaCobranca === 'parcelado' && Number(numeroParcelas) >= 2 && valorFinal > 0 && <p className="text-[11px] text-text-secondary">{numeroParcelas}x mensais de aproximadamente R$ {fmt(valorFinal / Number(numeroParcelas))}.</p>}
            </div>
            {erro && <p className="text-xs text-coral-ink">{erro}</p>}
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setFormAberto(false); setErro(null); }} disabled={saving} className="flex-1">Cancelar</Button><Button size="sm" onClick={() => void criarEtapa()} disabled={saving || itemIds.length === 0} className="flex-1 bg-teal text-white hover:bg-teal-lt">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar cobrança'}</Button></div>
          </div>
        ) : <Button variant="outline" onClick={() => setFormAberto(true)} className="w-full border-teal/35 text-teal-ink hover:bg-teal/10"><Plus className="mr-1.5 h-4 w-4" />Cobrar nesta etapa</Button>
      )}
      {erro && !formAberto && <p className="text-xs text-coral-ink">{erro}</p>}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export function DetalheOrcamentoModal({
  detalheOrc, detalheOrcId, onClose,
  pacienteTelefone, pacienteNome, pacienteId,
  pagForm, setPagForm, pagSaving, pagError,
  parcelasMode, setParcelasMode, parcelasForm, setParcelasForm, parcelasSaving, parcelasError, onGerarParcelas,
  orcEditMode, setOrcEditMode, orcEditItens, setOrcEditItens,
  orcEditSaving, orcEditError, setOrcEditError,
  onOpenEditOrc, onSalvarEdicaoOrc,
  onAlternarAprovacaoItem, onAprovarTodosItens, onRegistrarPagamento,
  closingPagamentoId, onIniciarFechamentoPagamento, onCancelarFechamentoPagamento,
  onDeleteClick,
  podeExcluir,
  editingPagId, editPagForm, setEditPagForm, editPagSaving, editPagError,
  onIniciarEdicaoPagamento, onCancelarEdicaoPagamento, onSalvarEdicaoPagamento,
  confirmDeletePagId, setConfirmDeletePagId, pagDeleteSaving, onExcluirPagamento,
  editValorAcordadoAberto, valorAcordadoTexto, setValorAcordadoTexto,
  valorAcordadoSaving, valorAcordadoError,
  onIniciarEdicaoValorAcordado, onCancelarEdicaoValorAcordado, onSalvarValorAcordado,
  onAceiteRegistrado,
  onToggleMostrarValorPorItem,
}: Props) {
  const hoje = new Date().toISOString().split('T')[0];
  /** R-39a: só Procedimentos e Atividade — Pagamentos virou a coluna do dinheiro. */
  const [tab, setTab] = useState<'procedimentos' | 'atividade'>('procedimentos');
  const [showAceiteModal, setShowAceiteModal] = useState(false);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [activityLogs, setActivityLogs] = useState<{ id: string; actor_nome: string | null; action: string; created_at: string }[]>([]);

  // Patch 4: Lazy-fetch activity logs quando o modal abre
  useEffect(() => {
    if (!detalheOrc?.id) return;
    let ativo = true;
    const supabase = createClient();
    void supabase
      .from('activity_logs')
      .select('id, actor_nome, action, created_at')
      .eq('entity_type', 'orcamento')
      .eq('entity_id', detalheOrc.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!ativo) return;
        setActivityLogs((data ?? []) as { id: string; actor_nome: string | null; action: string; created_at: string }[]);
      });
    return () => { ativo = false; };
  }, [detalheOrc?.id]);

  const ACTION_LABEL: Record<string, string> = {
    orcamento_aprovado: 'Aprovado',
    orcamento_enviado:  'Enviado ao paciente',
    orcamento_recusado: 'Recusado',
    'pagamento.registrado': 'Pagamento registrado',
    'pagamento.parcelado': 'Parcelamento gerado',
    'pagamento.editado': 'Pagamento editado',
    'pagamento.excluido': 'Pagamento excluído',
    'pagamento.estornado': 'Recebimento estornado',
    'pagamento.previsao_reorganizada': 'Cobrança reorganizada',
    'cobranca.etapa_criada': 'Cobrança por etapa criada',
    'cobranca.etapa_cancelada': 'Cobrança por etapa cancelada',
    status_alterado: 'Status alterado',
  };

  // R-114 — estado derivado dos fatos (item aprovado × pagamento), não mais declarado.
  // Mesma fórmula de lib/orcamentos/estado.ts — nunca reimplementada aqui.
  const { totalPago, totalPendente, quitado, restante, estado, valorDevido, valorAprovado } = useMemo(() => {
    if (!detalheOrc) {
      return {
        totalPago: 0, totalPendente: 0, quitado: false, restante: 0,
        estado: 'proposto' as EstadoOrcamento, valorDevido: 0, valorAprovado: 0,
      };
    }
    const derivado = deriveEstadoOrcamento({
      valorAcordado: detalheOrc.valor_acordado,
      desconto: detalheOrc.desconto,
      cobrancas: detalheOrc.cobrancas,
      itens: detalheOrc.itens.map((i) => ({ precoTotal: i.preco_total, aprovado: i.aprovado })),
      pagamentos: detalheOrc.pagamentos.map((p) => ({ valor: p.valor, status: p.status })),
    });
    const pendente = detalheOrc.pagamentos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
    // Arredonda pra centavo antes de comparar — soma de floats (parcelas) raramente bate
    // exato com o devido (ex.: 149.99999999999997).
    const restanteArred = Math.max(0, Math.round((derivado.valorDevido - derivado.valorPago) * 100) / 100);
    return {
      totalPago:     derivado.valorPago,
      totalPendente: pendente,
      quitado:       derivado.estado === 'quitado',
      restante:      restanteArred,
      estado:        derivado.estado,
      valorDevido:   derivado.valorDevido,
      valorAprovado: derivado.valorAprovado,
    };
  }, [detalheOrc]);

  const valorNegociado = detalheOrc?.valor_acordado ?? detalheOrc?.total ?? 0;
  const temParcelaAgendada = detalheOrc?.pagamentos.some(
    (pagamento) => pagamento.status === 'pendente',
  ) ?? false;
  const temPlanoParcelado = detalheOrc?.plano_forma === 'parcelado'
    || detalheOrc?.pagamentos.some((pagamento) => pagamento.parcela_numero !== null) === true;
  const temItensAprovados = valorAprovado > 0;
  const podeEscolherRecebimento = temItensAprovados && !quitado && !closingPagamentoId;
  const podeConfigurarRecebimento = temItensAprovados && !quitado && !closingPagamentoId;
  // Orçamentos já em negociação legada seguem na superfície anterior. Assim que não há dinheiro
  // nem previsão legados, a primeira cobrança nasce por etapa e não por `valor_acordado` global.
  const temAcordoGlobal = detalheOrc !== null
    && ((detalheOrc.desconto ?? 0) > 0 || detalheOrc.valor_acordado !== null);
  const usarCobrancasPorEtapa = detalheOrc?.cobrancas.some((c) => c.situacao === 'aberta')
    || (!temAcordoGlobal && ((detalheOrc?.cobrancas.length ?? 0) > 0
      || ((detalheOrc?.pagamentos.length ?? 0) === 0 && temItensAprovados)));

  /**
   * R-27a: quantidade de pagamentos recebidos e formas distintas usadas — é o que a
   * coluna do dinheiro resume (era a aba "Pagamentos", virou a R-39a).
   */
  const { pagosCount, formasUsadas } = useMemo(() => {
    const pgs = detalheOrc?.pagamentos ?? [];
    const pagos = pgs.filter(p => p.status === 'pago');
    const formas = [...new Set(pagos.map(p => p.forma_pagamento).filter(Boolean) as string[])];
    return {
      pagosCount:    pagos.length,
      formasUsadas:  formas,
    };
  }, [detalheOrc]);

  // R-136 — pequeno atalho dentro do único formulário à vista, sem criar uma segunda
  // ação financeira concorrente na lateral.
  function preencherRestante() {
    if (restante <= 0) return;
    setPagForm(f => ({ ...f, valor: formatValorBR(restante), dataVencimento: '' }));
  }

  return (
    <Dialog open={!!detalheOrcId} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="flex flex-col rounded-3xl bg-surface border-border p-0 overflow-hidden gap-0 w-[94vw] sm:w-[82vw]"
        style={{ maxWidth: '1280px', maxHeight: '90vh', left: '50%' }}
        showCloseButton={false}
      >
        {detalheOrc && (
          <>
            {/* ── Cabeçalho (R-27a) ────────────────────────────────────
                Sem gradiente hardcoded e sem seletor de status. O canto direito é
                reservado — nada de conteúdo cai embaixo do ✕. A única pergunta que a
                tabela de procedimentos não responde ("está sendo pago?") vive aqui. */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <DialogTitle className="font-heading font-semibold text-xl text-text-primary leading-tight">
                  Orçamento
                </DialogTitle>
                {/* R-114 — badge deriva de item aprovado × pagamento, não é mais declarado.
                    Nenhuma transição manual: "Proposto"/"Aceito"/"Quitado" só mudam quando o
                    paciente aceita um procedimento (aba Procedimentos) ou paga. */}
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 ${
                    estado === 'quitado'
                      ? 'bg-teal-ink text-white'
                      : estado === 'aceito'
                        ? 'bg-warning-pale text-warning-ink'
                        : 'bg-surface-alt text-text-secondary'
                  }`}
                >
                  {estado === 'quitado' && <CheckCircle2 className="w-3 h-3" />}
                  {rotuloEstado({ estado, valorDevido, valorPago: totalPago, valorAprovado })}
                </span>
                <DialogDescription className="text-text-muted text-xs truncate">
                  {format(parseISO(detalheOrc.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </DialogDescription>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {quitado ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-teal-ink text-white">
                    <CheckCircle2 className="w-3 h-3" />
                    Quitado
                  </span>
                ) : valorAprovado > 0 ? (
                  <span className="font-mono text-sm font-medium text-text-primary hidden sm:inline">
                    <span className="text-teal-ink">R$ {fmt(totalPago)}</span>
                    <span className="font-sans text-xs text-text-secondary"> de </span>
                    R$ {fmt(valorDevido)}
                    <span className="font-sans text-xs text-text-secondary"> pagos</span>
                  </span>
                ) : null}

                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Corpo: procedimentos à esquerda, dinheiro à direita (R-39a) ──────
                Empilha com o dinheiro ACIMA no celular (flex-col-reverse): é a
                pergunta que se responde primeiro num gesto de balcão. */}
            <div className="flex-1 min-h-0 flex flex-col-reverse sm:flex-row">

              {/* ── Coluna clínica ─────────────────────────────────────── */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(v as typeof tab)}
                  className="flex flex-col flex-1 min-h-0 gap-0"
                >
                  <TabsList className="h-auto shrink-0 justify-start gap-1 rounded-none border-b border-border bg-transparent px-6 py-0 overflow-x-auto">
                    {([
                      { value: 'procedimentos', label: 'Procedimentos', count: detalheOrc.itens.length },
                      { value: 'atividade',     label: 'Atividade',     count: null },
                    ] as const).map(t => (
                      <TabsTrigger
                        key={t.value}
                        value={t.value}
                        className="rounded-none border-b-2 border-transparent px-3 py-2.5 font-semibold data-[active]:bg-transparent data-[active]:shadow-none data-[active]:border-teal data-[active]:text-teal-ink"
                      >
                        {t.label}
                        {t.count !== null && (
                          <span className="ml-1.5 font-mono text-[11px] text-text-muted">{t.count}</span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* ── Aba: procedimentos ─────────────────────────────────── */}
                  <TabsContent value="procedimentos" className="mt-0 flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-2">
                      {orcEditMode ? (
                        <div className="space-y-2">
                          {orcEditItens.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-[24px_1fr_64px_112px_28px] items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 py-2.5">
                              <span className="w-6 h-6 rounded-lg bg-teal/10 text-teal text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <Input
                                placeholder="Descrição do procedimento"
                                value={item.descricao}
                                onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                                className="rounded-lg bg-surface border-border text-text-primary text-sm h-9"
                              />
                              <Input
                                type="number" min="1" value={item.quantidade}
                                onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidade: parseInt(e.target.value) || 1 } : it))}
                                className="rounded-lg bg-surface border-border text-text-primary text-sm font-mono h-9 text-center"
                              />
                              <Input
                                type="text" inputMode="decimal" placeholder="0,00"
                                value={item.preco_unitario}
                                onChange={e => setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, preco_unitario: e.target.value } : it))}
                                onBlur={e => {
                                  const parsed = parseValorBR(e.target.value);
                                  setOrcEditItens(prev => prev.map((it, i) => i === idx ? { ...it, preco_unitario: parsed > 0 ? formatValorBR(parsed) : it.preco_unitario } : it));
                                }}
                                className="rounded-lg bg-surface border-border text-text-primary text-sm font-mono h-9"
                              />
                              <button
                                onClick={() => setOrcEditItens(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 rounded-lg hover:bg-coral-pale text-coral-ink transition-colors"
                                aria-label="Remover procedimento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setOrcEditItens(prev => [...prev, { descricao: '', quantidade: 1, preco_unitario: '' }])}
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
                              {detalheOrc.itens.map((item) => (
                                <div
                                  key={item.id}
                                  className={`flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 transition-colors ${
                                    item.aprovado ? 'hover:bg-surface-alt/40' : 'bg-surface-alt/30'
                                  }`}
                                >
                                  {/* R-114 — o gesto de aprovação: o paciente aceitou este
                                      procedimento? Item desmarcado NUNCA some — só deixa de
                                      contar no devido e no PDF (I2). */}
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={item.aprovado}
                                    aria-label={item.aprovado ? 'Aprovado — clique para desmarcar' : 'Marcar como aprovado pelo paciente'}
                                    onClick={() => onAlternarAprovacaoItem(item.id, !item.aprovado)}
                                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                                      item.aprovado
                                        ? 'bg-teal-ink border-teal-ink text-white'
                                        : 'border-border bg-surface hover:border-teal/40'
                                    }`}
                                  >
                                    {item.aprovado && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${item.aprovado ? 'text-text-primary' : 'text-text-secondary'}`}>
                                      {item.descricao ?? '—'}
                                      {!item.aprovado && (
                                        <span className="ml-2 inline-block text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-surface-alt text-text-secondary align-middle">
                                          não incluído
                                        </span>
                                      )}
                                    </p>
                                    {item.quantidade > 1 && (
                                      <p className="text-[11px] text-text-secondary font-mono">
                                        {item.quantidade} unidades × R$ {fmt((item.preco_total ?? 0) / item.quantidade)}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`font-mono text-sm font-semibold shrink-0 ${item.aprovado ? 'text-text-primary' : 'text-text-secondary'}`}>
                                    R$ {fmt(item.preco_total ?? 0)}
                                  </span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between px-4 py-3 bg-teal/5 gap-3">
                                <div>
                                  <span className="text-sm font-bold text-text-primary block">Aprovado</span>
                                  {valorAprovado < (detalheOrc.total ?? 0) && (
                                    <span className="text-[11px] text-text-secondary">
                                      Proposto: R$ {fmt(detalheOrc.total ?? 0)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {/* Atalho de 1 clique (pedido dele, 16/08): some sozinho
                                      quando tudo já está aprovado — sem "desmarcar tudo",
                                      é direção única (bate na I9 assim que há pagamento). */}
                                  {detalheOrc.itens.some((i) => !i.aprovado) && (
                                    <button
                                      type="button"
                                      onClick={() => onAprovarTodosItens(detalheOrc.id)}
                                      className="text-[11px] font-bold uppercase tracking-wider text-teal-ink border border-teal/40 rounded-lg px-2.5 py-1 hover:bg-teal/10 transition-colors"
                                    >
                                      Aprovar tudo
                                    </button>
                                  )}
                                  <span className="font-mono text-lg font-bold text-teal">
                                    R$ {fmt(valorAprovado)}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Aba: atividade ────────────────────────────────────────
                      Ganha lugar próprio: antes era um rodapé espremido no fim da coluna
                      esquerda, junto da auditoria de aprovação. */}
                  <TabsContent value="atividade" className="mt-0 flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                    {/* R-03c-1 — aceite assinado: prova de que o paciente concordou em pagar
                        (distinta da aprovação de status acima, que não afirma nada em 4 dos 5
                        caminhos que a disparam). */}
                    {detalheOrc.aceite ? (
                      <div className="flex items-start gap-2 bg-teal/5 border border-teal/15 rounded-xl px-3 py-2.5">
                        <PenLine className="w-3.5 h-3.5 text-teal-ink shrink-0 mt-0.5" />
                        <p className="text-xs text-text-secondary">
                          Aceite assinado por <span className="font-semibold text-text-primary">{detalheOrc.aceite.assinadoPor}</span>
                          {' '}em {format(parseISO(detalheOrc.aceite.assinadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {detalheOrc.aceite.croNoAto && <> · CRO {detalheOrc.aceite.croNoAto}</>}
                        </p>
                        <p className="text-xs text-text-muted">Documento final disponível em Documentos.</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAceiteModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-teal/5 hover:text-teal-ink hover:border-teal/30 transition-all"
                      >
                        <PenLine className="w-4 h-4" />
                        Coletar aceite do paciente
                      </button>
                    )}

                    {/* R-114 — `aprovado_por`/`aprovado_em` são legado (só a ponte da tela
                        antiga da secretária ainda escreve). `status` fica inerte pra
                        orçamento tocado por aqui; o gate é só presença do dado. */}
                    {(detalheOrc.aprovado_por || detalheOrc.aprovado_em) && (
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

                    {activityLogs.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8">Nenhuma atividade registrada ainda.</p>
                    ) : (
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
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* ── Coluna do dinheiro (R-39a) ─────────────────────────────
                  % pago → falta receber → parcelas → formulário, sempre visível. O
                  diálogo aninhado de "Registrar pagamento" (R-34 §7.0) deixa de existir:
                  é gesto de balcão, não cabe atrás de um segundo clique. */}
              <div
                className="w-full sm:w-[416px] sm:shrink-0 border-t sm:border-t-0 sm:border-l border-border flex flex-col min-h-0 bg-teal/[0.04]"
              >
                <div className="flex-1 min-h-0 overflow-y-auto p-5">
                  {!orcEditMode && usarCobrancasPorEtapa ? (
                    <CobrancasPorEtapa orcamento={detalheOrc} pacienteId={pacienteId} permitirNovaEtapa={!temAcordoGlobal} />
                  ) : (
                    <>
                  {orcEditMode ? (
                    <div className="rounded-2xl border border-teal/25 p-5 text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-teal-ink">Novo total</p>
                      <p className="font-mono text-3xl font-semibold text-teal-ink mt-1">
                        R$ {fmt(orcEditItens.reduce((s, i) => s + i.quantidade * parseValorBR(i.preco_unitario), 0))}
                      </p>
                      <p className="text-xs text-text-secondary mt-2">
                        Salve as alterações na aba Procedimentos para registrar pagamentos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-teal-ink">Resumo financeiro</p>
                        <p className="mt-1 text-xs text-text-secondary">O que foi aceito, recebido e ainda falta receber.</p>
                      </div>

                      {temItensAprovados ? (
                        <div className="grid grid-cols-3 gap-2" aria-label="Resumo do orçamento">
                          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Aprovado</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-text-primary">R$ {fmt(valorAprovado)}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Recebido</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-teal-ink">R$ {fmt(totalPago)}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Saldo</p>
                            <p className="mt-1 font-mono text-sm font-semibold text-text-primary">R$ {fmt(restante)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border bg-surface-alt/40 p-4">
                          <p className="text-sm font-semibold text-text-primary">Aguardando aprovação do paciente</p>
                          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                            Selecione os procedimentos aceitos à esquerda. O recebimento só é liberado depois disso.
                          </p>
                        </div>
                      )}

                      {quitado && (
                        <div className="rounded-2xl border border-teal/30 bg-teal/5 p-4">
                          <p className="text-sm font-semibold text-teal-ink">Orçamento quitado</p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {pagosCount} {pagosCount === 1 ? 'pagamento registrado' : 'pagamentos registrados'}
                            {formasUsadas.length > 0 && ` · ${formasUsadas.map(f => FORMA_LABEL[f] ?? f).join(', ')}`}
                          </p>
                        </div>
                      )}

                      {totalPendente > 0 && !quitado && (
                        <p className="text-[11px] font-mono text-warning-ink">
                          R$ {fmt(totalPendente)} agendado, ainda não recebido
                        </p>
                      )}
                    </div>
                  )}

                  {!orcEditMode && (
                    <>
                      <div className="h-px bg-border my-4" />
                      {editValorAcordadoAberto ? (
                        <div className="rounded-xl border border-teal/30 bg-teal/5 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-bold text-text-primary">Valor final negociado</Label>
                            <span className="text-[10px] text-text-secondary">Não altera os procedimentos</span>
                          </div>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={valorAcordadoTexto}
                            onChange={(event) => setValorAcordadoTexto(event.target.value)}
                            className="rounded-lg bg-surface border-border text-text-primary font-mono"
                          />
                          {valorAcordadoError && <p className="text-xs text-coral-ink">{valorAcordadoError}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={onCancelarEdicaoValorAcordado} disabled={valorAcordadoSaving} className="flex-1 rounded-lg">
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={onSalvarValorAcordado} disabled={valorAcordadoSaving} className="flex-1 rounded-lg bg-teal text-white hover:bg-teal/90">
                              {valorAcordadoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar valor'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border bg-surface-alt/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Valor final negociado</p>
                              <p className="font-mono text-lg font-semibold text-text-primary mt-1">R$ {fmt(valorNegociado)}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onIniciarEdicaoValorAcordado}
                              className="rounded-lg h-8 text-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                            </Button>
                          </div>
                          <p className="text-[11px] text-text-secondary mt-2">
                            {temParcelaAgendada
                              ? 'Ao salvar, a previsão futura é redistribuída; o recebido não muda.'
                              : 'Você pode corrigir o combinado sem mudar os procedimentos.'}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {!orcEditMode && detalheOrc.pagamentos.length > 0 && (
                    <>
                      <div className="h-px bg-border my-4" />
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
                          {temPlanoParcelado ? 'Previsão e recebimentos' : 'Recebimentos'}
                        </h4>
                        <span className="text-[11px] text-text-secondary">Recebido é histórico; previsão pode ser reorganizada</span>
                      </div>
                      <div className="space-y-1.5">
                        {detalheOrc.pagamentos.map(pg => {
                          const Icon = FORMA_ICON[pg.forma_pagamento ?? 'outro'] ?? CircleDollarSign;
                          const isPago = pg.status === 'pago';
                          const isVencido = !isPago && !!pg.data_vencimento && pg.data_vencimento < hoje;
                          const parcelaLabel = pg.parcela_numero && pg.total_parcelas
                            ? `Parcela ${pg.parcela_numero}/${pg.total_parcelas}`
                            : null;

                          if (editingPagId === pg.id) {
                            return (
                              <div key={pg.id} className="rounded-xl border border-teal/30 bg-surface-alt p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-text-secondary">Valor (R$)</Label>
                                    <Input
                                      type="text" inputMode="decimal" placeholder="0,00"
                                      value={editPagForm.valor}
                                      onChange={e => setEditPagForm(f => ({ ...f, valor: e.target.value }))}
                                      className="rounded-lg bg-surface border-border text-text-primary text-sm font-mono h-8"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-text-secondary">Data</Label>
                                    <Input
                                      type="date" value={editPagForm.data}
                                      onChange={e => setEditPagForm(f => ({ ...f, data: e.target.value }))}
                                      className="rounded-lg bg-surface border-border text-text-primary text-sm h-8"
                                    />
                                  </div>
                                </div>
                                <Select
                                  value={editPagForm.formaPagamento}
                                  onValueChange={(v) => setEditPagForm(f => ({ ...f, formaPagamento: v as FormaPagamento }))}
                                >
                                  <SelectTrigger className="rounded-lg bg-surface border-border text-text-primary text-sm h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(FORMA_LABEL).map(([value, label]) => (
                                      <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {editPagError && <p className="text-xs text-coral-ink">{editPagError}</p>}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm" variant="outline" onClick={onCancelarEdicaoPagamento} disabled={editPagSaving}
                                    className="flex-1 rounded-lg h-8 text-xs"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm" onClick={onSalvarEdicaoPagamento} disabled={editPagSaving}
                                    className="flex-1 rounded-lg h-8 text-xs bg-teal hover:bg-teal/90 text-white"
                                  >
                                    {editPagSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          if (confirmDeletePagId === pg.id) {
                            return (
                              <div key={pg.id} className="rounded-xl border border-coral/30 bg-coral/5 p-3 space-y-2">
                                <p className="text-xs text-text-primary">
                                  {isPago ? 'Estornar' : 'Excluir previsão'} de R$ {fmt(pg.valor)}?
                                </p>
                                {isPago && (
                                  <Input
                                    value={motivoEstorno}
                                    onChange={(event) => setMotivoEstorno(event.target.value)}
                                    placeholder="Motivo do estorno (obrigatório)"
                                    maxLength={500}
                                    disabled={pagDeleteSaving}
                                    className="h-8 text-xs"
                                  />
                                )}
                                <div className="flex justify-end gap-1.5 shrink-0">
                                  <Button
                                    size="sm" variant="outline" onClick={() => {
                                      setConfirmDeletePagId(null);
                                      setMotivoEstorno('');
                                    }} disabled={pagDeleteSaving}
                                    className="rounded-lg h-7 text-xs px-2"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => onExcluirPagamento(pg.id, motivoEstorno)}
                                    disabled={pagDeleteSaving || (isPago && !motivoEstorno.trim())}
                                    /* `text-white` sobre `bg-coral` reprova no escuro: coral vira
                                       #ef9a9a (rosa claro) e branco em cima dá ~1,9:1. Par
                                       coral-ink/coral-pale funciona nos dois temas. */
                                    className="rounded-lg h-7 text-xs px-2 bg-coral-pale border border-coral text-coral-ink hover:bg-coral/20"
                                  >
                                    {pagDeleteSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isPago ? 'Estornar' : 'Excluir'}
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={pg.id}
                              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                                isPago
                                  ? 'border-teal/20 bg-teal/5'
                                  : isVencido
                                    ? 'border-coral/40 bg-coral-pale'
                                    : 'border-border bg-surface-alt/40'
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isPago ? 'bg-teal/15 text-teal' : isVencido ? 'bg-coral/15 text-coral-ink' : 'bg-surface-alt text-text-secondary'
                              }`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary flex items-center gap-1.5 flex-wrap">
                                  {parcelaLabel && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal bg-teal/10 px-1.5 py-0.5 rounded-md shrink-0">
                                      {parcelaLabel}
                                    </span>
                                  )}
                                  {isPago ? (FORMA_LABEL[pg.forma_pagamento ?? 'outro'] ?? 'Pagamento') : 'A receber'}
                                </p>
                                <p className={`text-[11px] ${isVencido ? 'text-coral-ink font-semibold' : 'text-text-secondary'}`}>
                                  {isPago
                                    ? <>Pago em {pg.data_pagamento ? format(parseISO(pg.data_pagamento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</>
                                    : pg.data_vencimento
                                      ? <>{isVencido ? 'Venceu' : 'Vence'} em {format(parseISO(pg.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}</>
                                      : 'Pendente'
                                  }
                                  {/* R-27a: quem registrou aparece SEMPRE que o pagamento está pago,
                                      inclusive como "—". Hoje `marcado_por_id` está vazio em 83 de 83
                                      pagamentos — só `marcarPagamentoPago` grava. Esconder o campo
                                      faria a lacuna parecer inexistente; o R-28 conserta a escrita. */}
                                  {isPago && ` · registrado por ${pg.marcado_por?.nome.split(' ')[0] ?? '—'}`}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                {isPago ? (
                                  <p className="font-mono text-xs font-semibold text-teal">
                                    R$ {fmt(pg.valor)}
                                  </p>
                                ) : (
                                  // R-28 — clicar no valor pendente preenche o formulário abaixo já
                                  // vinculado a ESTA parcela (fecha por UPDATE, não cria linha nova).
                                  <button
                                    onClick={() => onIniciarFechamentoPagamento(pg)}
                                    className={`font-mono text-xs font-semibold underline decoration-dotted underline-offset-2 transition-colors ${isVencido ? 'text-coral-ink hover:text-coral' : 'text-text-secondary hover:text-teal-ink'}`}
                                  >
                                    R$ {fmt(pg.valor)}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {isPago ? (
                                  <button
                                    onClick={() => onIniciarEdicaoPagamento(pg)}
                                    className="p-1 rounded-lg hover:bg-surface-alt text-text-secondary hover:text-text-primary transition-colors"
                                    aria-label="Editar pagamento"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onIniciarFechamentoPagamento(pg)}
                                    className="p-1 rounded-lg hover:bg-teal/10 text-text-secondary hover:text-teal-ink transition-colors"
                                    aria-label="Marcar como pago"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmDeletePagId(pg.id)}
                                  className="p-1 rounded-lg hover:bg-coral/10 text-text-secondary hover:text-coral transition-colors"
                                  aria-label={isPago ? 'Estornar recebimento' : 'Excluir previsão'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* R-136 — só o caminho financeiro aplicável fica aberto por vez. */}
                  {!orcEditMode && temItensAprovados && !quitado && (closingPagamentoId || podeConfigurarRecebimento) && (
                    <>
                      <div className="h-px bg-border my-4" />

                      {closingPagamentoId && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal/25 bg-teal/5 px-3 py-2.5 mb-3">
                          <p className="text-xs text-text-secondary">
                            Fechando parcela de{' '}
                            <span className="font-mono font-semibold text-teal-ink">R$ {pagForm.valor}</span>
                          </p>
                          <button
                            type="button"
                            onClick={onCancelarFechamentoPagamento}
                            className="text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors shrink-0"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}

                      <div className="mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-teal-ink">
                          {closingPagamentoId ? 'Confirmar previsão como recebida' : parcelasMode ? 'Organizar cobrança' : 'Registrar recebimento'}
                        </p>
                        {!closingPagamentoId && podeEscolherRecebimento && (
                          <div className="mt-3 grid grid-cols-2 rounded-xl border border-border bg-surface-alt/40 p-1" role="tablist" aria-label="Forma de recebimento">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={!parcelasMode}
                              onClick={() => setParcelasMode(false)}
                              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                !parcelasMode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              Recebimento
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={parcelasMode}
                              onClick={() => setParcelasMode(true)}
                              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                parcelasMode ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              Organizar cobrança
                            </button>
                          </div>
                        )}
                      </div>

                      {parcelasMode && !closingPagamentoId ? (
                        <div className="space-y-2 transition-all duration-150 motion-reduce:transition-none">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-text-secondary">Nº de parcelas</Label>
                              <Input
                                type="number" min={2} max={24}
                                value={parcelasForm.numero}
                                onChange={e => setParcelasForm(f => ({ ...f, numero: e.target.value }))}
                                className="rounded-xl bg-surface border-border text-text-primary font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-text-secondary">1º vencimento</Label>
                              <Input
                                type="date" min={hoje}
                                value={parcelasForm.primeiroVencimento}
                                onChange={e => setParcelasForm(f => ({ ...f, primeiroVencimento: e.target.value }))}
                                className="rounded-xl bg-surface border-border text-text-primary"
                              />
                            </div>
                          </div>
                          {(() => {
                            const n = parseInt(parcelasForm.numero, 10);
                            if (!n || n < 2 || !restante) return null;
                            return (
                              <p className="text-[11px] text-text-secondary bg-surface rounded-xl px-3 py-2">
                                Saldo restante: R$ {fmt(restante)} — {n} previsões de R$ {fmt(restante / n)}, vencimentos no mesmo dia, mês a mês.
                              </p>
                            );
                          })()}
                          {parcelasError && (
                            <p className="text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2">{parcelasError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 transition-all duration-150 motion-reduce:transition-none">
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <Label className="text-xs text-text-secondary">Valor (R$)</Label>
                            <Input
                              type="text" inputMode="decimal" placeholder="0,00"
                              value={pagForm.valor}
                              disabled={!!closingPagamentoId}
                              onChange={e => setPagForm(f => ({ ...f, valor: e.target.value }))}
                              onBlur={e => {
                                const parsed = parseValorBR(e.target.value);
                                setPagForm(f => ({ ...f, valor: parsed > 0 ? formatValorBR(parsed) : f.valor }));
                              }}
                              className="rounded-xl bg-surface border-border text-text-primary font-mono"
                            />
                            </div>
                            {!closingPagamentoId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={restante <= 0}
                                onClick={preencherRestante}
                                className="h-10 shrink-0 rounded-xl text-xs"
                              >
                                Usar saldo
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-text-secondary">Data do recebimento</Label>
                            <Input
                              type="date" value={pagForm.data}
                              onChange={e => setPagForm(f => ({ ...f, data: e.target.value }))}
                              className="rounded-xl bg-surface border-border text-text-primary"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-text-secondary">Forma de pagamento</Label>
                            <Select
                              value={pagForm.formaPagamento}
                              onValueChange={v => v && setPagForm(f => ({ ...f, formaPagamento: v as FormaPagamento }))}
                            >
                              <SelectTrigger className="rounded-xl bg-surface border-border text-text-primary">
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
                            <p className="text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2">{pagError}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                    </>
                  )}
                </div>

                {/* ── Ação fixa no pé da coluna — nunca sai da tela, mesmo com muitas
                    parcelas (a lista acima rola; o botão não). ── */}
                {!orcEditMode && !usarCobrancasPorEtapa && temItensAprovados && !quitado && (closingPagamentoId || podeConfigurarRecebimento) && (
                  <div className="shrink-0 border-t border-border p-4">
                    {parcelasMode && !closingPagamentoId ? (
                      <Button
                        onClick={onGerarParcelas}
                        disabled={parcelasSaving || !parcelasForm.primeiroVencimento}
                        className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-semibold"
                      >
                        {parcelasSaving
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                          : temParcelaAgendada ? 'Reorganizar cobrança' : 'Organizar cobrança'
                        }
                      </Button>
                    ) : (
                      <Button
                        onClick={onRegistrarPagamento}
                        disabled={pagSaving || !pagForm.valor}
                        className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-semibold"
                      >
                        {pagSaving
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                          : closingPagamentoId
                            ? 'Marcar como Pago'
                            : 'Registrar recebimento'
                        }
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Rodapé único (R-27a) — fora das colunas ─────────────────
                "Registrar pagamento" saiu daqui — a coluna do dinheiro já é
                permanente, não precisa de atalho pra abrir nada. */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-border">
              {orcEditMode ? (
                <>
                  {orcEditError && (
                    <p className="text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2 w-full">{orcEditError}</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { setOrcEditMode(false); setOrcEditError(null); }}
                    disabled={orcEditSaving}
                    className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={onSalvarEdicaoOrc}
                    disabled={orcEditSaving}
                    className="bg-teal text-white hover:bg-teal-lt rounded-xl font-bold ml-auto"
                  >
                    {orcEditSaving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                      : 'Salvar alterações'
                    }
                  </Button>
                </>
              ) : (
                <>
                  {podeExcluir && (
                    <Button
                      variant="outline"
                      onClick={() => onDeleteClick(detalheOrcId)}
                      className="rounded-xl border-coral/40 text-coral-ink hover:bg-coral-pale"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Excluir
                    </Button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      onClick={onOpenEditOrc}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      <Edit2 className="w-4 h-4 mr-1.5" />
                      Editar
                    </Button>
                    <div
                      className="hidden sm:flex items-center gap-1.5 text-xs text-text-secondary"
                      title="Mostrar o valor de cada procedimento no PDF"
                    >
                      <span>Valor por item</span>
                      <ToggleSwitch
                        checked={detalheOrc.mostrar_valor_por_item}
                        onCheckedChange={(checked) => onToggleMostrarValorPorItem(detalheOrc.id, checked)}
                      />
                    </div>
                    <div className="flex items-center gap-0.5 border border-border rounded-xl px-0.5">
                      <BotaoDownloadPDF orcamentoId={detalheOrc.id} />
                      <BotaoEnviarWhatsApp
                        orcamentoId={detalheOrc.id}
                        pacienteTelefone={pacienteTelefone}
                        pacienteNome={pacienteNome}
                        valorTotal={valorDevido}
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      Fechar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>

      {detalheOrc && (
        <AceiteOrcamentoModal
          open={showAceiteModal}
          onOpenChange={setShowAceiteModal}
          orcamentoId={detalheOrc.id}
          // R-114 (I2) — o paciente assina o que ACEITOU, não a proposta inteira. Item não
          // aprovado não pode aparecer como algo que ele está confirmando pagar.
          itens={detalheOrc.itens.filter((i) => i.aprovado)}
          total={valorDevido}
          onAccepted={onAceiteRegistrado}
        />
      )}
    </Dialog>
  );
}
