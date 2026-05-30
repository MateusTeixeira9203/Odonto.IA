'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Wallet, TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
  Plus, Trash2, Loader2, CircleDollarSign, UserRound,
  Eye, EyeOff, Clock, ArrowDownLeft, ArrowUpRight,
  CreditCard, AlertCircle, ExternalLink, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type {
  Despesa, SaldoMes, NovaDespesaForm, ChartPoint,
  ReceitaManual, NovaReceitaForm, HoraClinicaResult,
  PagamentoPago, PagamentoPendente,
} from '../actions';
import { criarDespesa, excluirDespesa, criarReceita, excluirReceita, exportarFinanceiroCsv } from '../actions';
import { downloadCsv } from '@/lib/export/csv';
import { GanhosDespesasChart } from '../../_components/ganhos-despesas-chart';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { PlanGuard } from '@/components/plan-guard';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  'Aluguel', 'Material', 'Equipamento', 'Salário', 'Marketing',
  'Serviços', 'Impostos', 'Manutenção', 'Outro',
] as const;

const FORMAS_ENTRADA = [
  { value: 'pix',           label: 'PIX' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro',         label: 'Outro' },
] as const;

const CATEGORIA_CORES: Record<string, string> = {
  aluguel:     'bg-surface-alt text-text-secondary',
  material:    'bg-teal/10 text-teal',
  equipamento: 'bg-teal/10 text-teal',
  'salário':   'bg-surface-alt text-text-secondary',
  marketing:   'bg-surface-alt text-text-secondary',
  'serviços':  'bg-teal/10 text-teal',
  impostos:    'bg-coral/10 text-coral',
  'manutenção':'bg-surface-alt text-text-secondary',
  outro:       'bg-surface-alt text-text-secondary',
};

const FORMA_CORES: Record<string, string> = {
  pix:            'bg-teal/10 text-teal',
  dinheiro:       'bg-teal/10 text-teal',
  transferencia:  'bg-surface-alt text-text-secondary',
  outro:          'bg-surface-alt text-text-secondary',
  cartao_credito: 'bg-teal/10 text-teal',
  cartao_debito:  'bg-teal/10 text-teal',
  boleto:         'bg-surface-alt text-text-secondary',
};

const FORMA_LABEL: Record<string, string> = {
  pix:            'PIX',
  dinheiro:       'Dinheiro',
  transferencia:  'Transferência',
  cartao_credito: 'Crédito',
  cartao_debito:  'Débito',
  boleto:         'Boleto',
  outro:          'Outro',
};

function categoriaCor(cat: string) {
  return CATEGORIA_CORES[cat.toLowerCase()] ?? CATEGORIA_CORES.outro;
}
function formaCor(forma: string) {
  return FORMA_CORES[forma] ?? FORMA_CORES.outro;
}
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  mesAtual:             string;
  despesasIniciais:     Despesa[];
  receitasIniciais:     ReceitaManual[];
  saldoInicial:         SaldoMes;
  chartData:            ChartPoint[];
  horaClinica:          HoraClinicaResult;
  role:                 DentistaRole;
  plano:                PlanoId;
  dentistaId:           string;
  dentistasClinica:     { id: string; nome: string }[];
  pagamentosPagosIniciais:     PagamentoPago[];
  pagamentosPendentesIniciais: PagamentoPendente[];
  /** Dentista pré-selecionado vindo da URL (?dentista=id) — persiste ao trocar de mês */
  initialDentistaFiltro?: string;
}

type SheetMode = 'saida' | 'entrada' | null;

// ─── Componente principal ─────────────────────────────────────────────────────

export function FinanceiroClient({
  mesAtual, despesasIniciais, receitasIniciais, saldoInicial,
  chartData, horaClinica, role, plano, dentistaId, dentistasClinica,
  pagamentosPagosIniciais, pagamentosPendentesIniciais,
  initialDentistaFiltro = '',
}: Props) {
  const router = useRouter();
  const [despesas, setDespesas] = useState<Despesa[]>(despesasIniciais);
  const [receitas, setReceitas] = useState<ReceitaManual[]>(receitasIniciais);
  const [saldo,    setSaldo]    = useState<SaldoMes>(saldoInicial);
  const pagamentosPagos     = pagamentosPagosIniciais;
  const pagamentosPendentes = pagamentosPendentesIniciais;
  const [isPrivacy, setIsPrivacy] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const { csv, filename } = await exportarFinanceiroCsv(mesAtual);
      downloadCsv(csv, filename);
    } catch {
      toast.error('Não foi possível exportar. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  }

  // ID do dentista persistido entre trocas de mês (via URL) — apenas secretária
  const [selectedDentistaId, setSelectedDentistaId] = useState<string>(
    () => initialDentistaFiltro || dentistasClinica[0]?.id || ''
  );

  // ── Estados: formulário saída ─────────────────────────────────────────────
  const [form, setForm] = useState<NovaDespesaForm>({
    valor: 0, categoria: 'Outro', tipo: 'variavel',
    data: format(new Date(), 'yyyy-MM-dd'), descricao: '',
    dentistaId: role === 'secretaria' ? (initialDentistaFiltro || dentistasClinica[0]?.id || '') : dentistaId,
  });
  const [salvando,  setSalvando]  = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  // ── Estados: formulário entrada ───────────────────────────────────────────
  const [formReceita, setFormReceita] = useState<NovaReceitaForm>({
    valor: 0, forma: 'pix',
    data: format(new Date(), 'yyyy-MM-dd'), descricao: '',
    dentistaId: role === 'secretaria' ? (initialDentistaFiltro || dentistasClinica[0]?.id || '') : dentistaId,
  });
  const [salvandoReceita,  setSalvandoReceita]  = useState(false);
  const [removendoReceita, setRemovendoReceita] = useState<string | null>(null);

  const mesDate = parseISO(`${mesAtual}-01`);
  const mesLabel = format(mesDate, "MMMM 'de' yyyy", { locale: ptBR });

  const priv = (v: number) => isPrivacy ? '••••••' : fmt(v);

  type LancamentoUnif =
    | { kind: 'saida';     id: string; data: string; item: Despesa }
    | { kind: 'entrada';   id: string; data: string; item: ReceitaManual }
    | { kind: 'pagamento'; id: string; data: string; item: PagamentoPago };

  const lancamentos = useMemo<LancamentoUnif[]>(() => {
    const saidas:   LancamentoUnif[] = despesas.map(d => ({ kind: 'saida',     id: d.id, data: d.data,            item: d }));
    const entradas: LancamentoUnif[] = receitas.map(r => ({ kind: 'entrada',   id: r.id, data: r.data,            item: r }));
    const pagtos:   LancamentoUnif[] = pagamentosPagos.map(p => ({ kind: 'pagamento', id: p.id, data: p.data_pagamento, item: p }));
    return [...saidas, ...entradas, ...pagtos].sort((a, b) => b.data.localeCompare(a.data));
  }, [despesas, receitas, pagamentosPagos]);

  function navMes(delta: number) {
    const prox = delta > 0 ? addMonths(mesDate, 1) : subMonths(mesDate, 1);
    const base = `/dashboard/financeiro?mes=${format(prox, 'yyyy-MM')}`;
    router.push(role === 'secretaria' && selectedDentistaId
      ? `${base}&dentista=${selectedDentistaId}`
      : base
    );
  }

  // ── Handlers: saída ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.valor || form.valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (role === 'secretaria' && !form.dentistaId) {
      toast.error('Selecione o dentista responsável'); return;
    }
    setSalvando(true);
    try {
      const res = await criarDespesa(form);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao salvar'); return; }
      if (form.data.startsWith(mesAtual)) {
        const nova: Despesa = {
          id: res.id ?? crypto.randomUUID(), clinica_id: '',
          dentista_id: form.dentistaId ?? null, valor: form.valor,
          categoria: form.categoria, tipo: form.tipo, data: form.data,
          descricao: form.descricao?.trim() || null, created_at: new Date().toISOString(),
        };
        setDespesas(prev => [nova, ...prev]);
        setSaldo(prev => ({ ...prev, despesas: prev.despesas + form.valor, saldo: prev.saldo - form.valor }));
      }
      toast.success('Saída registrada!');
      setForm(f => ({ ...f, valor: 0, descricao: '', dentistaId: role === 'secretaria' ? selectedDentistaId : dentistaId }));
      setSheetMode(null);
    } finally { setSalvando(false); }
  }

  async function handleDelete(id: string) {
    const d = despesas.find(x => x.id === id);
    if (!d) return;
    setRemovendo(id);
    try {
      const res = await excluirDespesa(id);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao remover'); return; }
      setDespesas(prev => prev.filter(x => x.id !== id));
      setSaldo(prev => ({ ...prev, despesas: prev.despesas - d.valor, saldo: prev.saldo + d.valor }));
      toast.success('Saída removida');
    } finally { setRemovendo(null); }
  }

  // ── Handlers: entrada ─────────────────────────────────────────────────────

  async function handleSubmitReceita(e: React.FormEvent) {
    e.preventDefault();
    if (!formReceita.valor || formReceita.valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (role === 'secretaria' && !formReceita.dentistaId) {
      toast.error('Selecione o dentista responsável'); return;
    }
    setSalvandoReceita(true);
    try {
      const res = await criarReceita(formReceita);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao salvar'); return; }
      if (formReceita.data.startsWith(mesAtual)) {
        const nova: ReceitaManual = {
          id: res.id ?? crypto.randomUUID(), clinica_id: '',
          dentista_id: formReceita.dentistaId ?? null, valor: formReceita.valor,
          forma: formReceita.forma, data: formReceita.data,
          descricao: formReceita.descricao?.trim() || null, created_at: new Date().toISOString(),
        };
        setReceitas(prev => [nova, ...prev]);
        setSaldo(prev => ({ ...prev, receita: prev.receita + formReceita.valor, saldo: prev.saldo + formReceita.valor }));
      }
      toast.success('Entrada registrada!');
      setFormReceita(f => ({ ...f, valor: 0, descricao: '', dentistaId: role === 'secretaria' ? selectedDentistaId : dentistaId }));
      setSheetMode(null);
    } finally { setSalvandoReceita(false); }
  }

  async function handleDeleteReceita(id: string) {
    const r = receitas.find(x => x.id === id);
    if (!r) return;
    setRemovendoReceita(id);
    try {
      const res = await excluirReceita(id);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao remover'); return; }
      setReceitas(prev => prev.filter(x => x.id !== id));
      setSaldo(prev => ({ ...prev, receita: prev.receita - r.valor, saldo: prev.saldo - r.valor }));
      toast.success('Entrada removida');
    } finally { setRemovendoReceita(null); }
  }

  const showSummary = role !== 'secretaria';
  const { custoPorHora, horasNoMes, despesasFixas } = horaClinica;
  const semHorario = horasNoMes == null || horasNoMes === 0;

  // ── Inteligência: tendência mês a mês a partir do chartData ──────────────
  const prevPoint = chartData.length >= 2 ? chartData[chartData.length - 2] : null;
  const receitaTrend = prevPoint && prevPoint.receita > 0
    ? ((saldo.receita - prevPoint.receita) / prevPoint.receita) * 100
    : null;
  const despesasTrend = prevPoint && prevPoint.despesas > 0
    ? ((saldo.despesas - prevPoint.despesas) / prevPoint.despesas) * 100
    : null;
  const margemPct = saldo.receita > 0
    ? (saldo.saldo / saldo.receita) * 100
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-5xl mx-auto w-full"
    >
      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-text-primary">
              Financeiro
            </h1>
            <p className="text-sm text-text-secondary">Fluxo de caixa e desempenho operacional</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPrivacy(v => !v)}
            title={isPrivacy ? 'Mostrar valores' : 'Ocultar valores'}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
              isPrivacy
                ? 'bg-teal/10 border-teal/40 text-teal'
                : 'border-border text-text-secondary hover:bg-surface-alt'
            }`}
          >
            {isPrivacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <div className="w-px h-5 bg-border" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => navMes(-1)}
              className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-surface-alt transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <span className="font-mono text-xs uppercase tracking-widest text-text-secondary px-2 capitalize">
              {format(mesDate, 'MMM yyyy', { locale: ptBR })}
            </span>
            <button
              onClick={() => navMes(1)}
              disabled={mesAtual >= format(new Date(), 'yyyy-MM')}
              className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-surface-alt transition-colors disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>

      <PlanGuard plano={plano} feature="financeiro" featureName="Módulo Financeiro" requiredPlan="CLINICA">
        <>
          {showSummary && (
            <>
              {/* ── Inteligência: indicadores derivados ────────────────────── */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <IntelCard
                  label="Tendência receita"
                  value={receitaTrend != null ? `${receitaTrend >= 0 ? '+' : ''}${receitaTrend.toFixed(1)}%` : '—'}
                  sub={prevPoint ? `vs ${prevPoint.mes}` : 'sem histórico'}
                  positive={receitaTrend != null ? receitaTrend >= 0 : null}
                  isPrivacy={isPrivacy}
                />
                <IntelCard
                  label="Tendência despesas"
                  value={despesasTrend != null ? `${despesasTrend >= 0 ? '+' : ''}${despesasTrend.toFixed(1)}%` : '—'}
                  sub={prevPoint ? `vs ${prevPoint.mes}` : 'sem histórico'}
                  positive={despesasTrend != null ? despesasTrend <= 0 : null}
                  isPrivacy={isPrivacy}
                />
                <IntelCard
                  label="Margem operacional"
                  value={margemPct != null ? `${margemPct.toFixed(1)}%` : '—'}
                  sub="receita líquida / bruta"
                  positive={margemPct != null ? margemPct >= 0 : null}
                  isPrivacy={isPrivacy}
                />
              </div>

              {/* ── Zona 1: Hero — Custo por Hora ──────────────────────────── */}
              <div
                className="rounded-3xl border border-teal/25 bg-gradient-to-br from-teal/8 via-surface to-surface p-8 mb-6 relative overflow-hidden"
                style={{ boxShadow: '0 10px 40px -12px rgba(47,156,133,0.18)' }}
              >
                {/* Decoração de fundo */}
                <div className="absolute right-6 top-6 w-24 h-24 rounded-full bg-teal/5 blur-2xl pointer-events-none" />

                <div className="flex items-start justify-between gap-6 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-teal/15 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-teal" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-teal">
                        Custo por Hora Clínica
                      </span>
                    </div>

                    {semHorario ? (
                      <div>
                        <p className="text-3xl font-mono font-semibold text-text-secondary">—</p>
                        <p className="text-sm text-text-secondary mt-2">
                          Configure seus horários em{' '}
                          <a href="/dashboard/configuracoes" className="text-teal underline underline-offset-2">
                            Configurações
                          </a>{' '}
                          para calcular o custo/hora.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-mono text-text-secondary">R$</span>
                          <span className="text-5xl font-mono font-bold text-text-primary tracking-tight tabular-nums">
                            {isPrivacy ? '•••' : fmt(custoPorHora!)}
                          </span>
                          <span className="text-lg font-mono text-text-secondary">/h</span>
                        </div>
                        <p className="text-sm text-text-secondary mt-2">
                          {Math.round(horasNoMes!)}h trabalhadas este mês
                          {' · '}
                          <span className="font-mono">
                            {isPrivacy ? '••••••' : `R$ ${fmt(despesasFixas)}`}
                          </span>
                          {' em despesas fixas'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mini KPIs à direita do hero */}
                  <div className="flex gap-3 flex-wrap">
                    <MiniKpi
                      label="Receita"
                      valor={saldo.receita}
                      color="teal"
                      icon={<TrendingUp className="w-3.5 h-3.5" />}
                      isPrivacy={isPrivacy}
                    />
                    <MiniKpi
                      label="Despesas"
                      valor={saldo.despesas}
                      color="coral"
                      icon={<TrendingDown className="w-3.5 h-3.5" />}
                      isPrivacy={isPrivacy}
                    />
                    <MiniKpi
                      label="Lucro"
                      valor={saldo.saldo}
                      color={saldo.saldo >= 0 ? 'teal' : 'coral'}
                      icon={<CircleDollarSign className="w-3.5 h-3.5" />}
                      isPrivacy={isPrivacy}
                      destaque
                    />
                  </div>
                </div>
              </div>

              {/* ── Zona 2: Gráfico de Fluxo de Caixa ─────────────────────── */}
              <div className="bg-surface rounded-3xl border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-semibold text-text-primary">Fluxo de Caixa</h2>
                    <p className="text-xs text-text-secondary mt-0.5">Entradas × Saídas — últimos 6 meses</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className="w-2 h-2 rounded-full bg-teal inline-block shrink-0" /> Receita
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className="w-2 h-2 rounded-full bg-coral inline-block shrink-0" /> Despesas
                    </span>
                  </div>
                </div>
                <div className="h-[200px]">
                  <GanhosDespesasChart data={chartData} />
                </div>
              </div>
            </>
          )}

          {/* ── Zona 3: Extrato do Mês ──────────────────────────────────────── */}
          <div className="bg-surface rounded-3xl border border-border overflow-hidden">
            {/* Header do extrato */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-text-primary">Extrato do Mês</h2>
              <span className="font-mono text-xs text-text-secondary ml-1">
                {lancamentos.length} {lancamentos.length !== 1 ? 'lançamentos' : 'lançamento'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportCsv()}
                  disabled={isExporting}
                  title="Exportar extrato como CSV"
                  className="rounded-xl border-border text-text-secondary hover:bg-surface-alt gap-1.5 text-xs font-semibold"
                >
                  {isExporting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />
                  }
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSheetMode('saida')}
                  className="rounded-xl border-border text-text-secondary hover:text-coral hover:border-coral/40 hover:bg-coral/5 gap-1.5 text-xs font-semibold"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Saída
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSheetMode('entrada')}
                  className="rounded-xl bg-teal hover:bg-teal-lt text-white gap-1.5 text-xs font-semibold"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Entrada
                </Button>
              </div>
            </div>

            {/* Lista de lançamentos */}
            {lancamentos.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary font-medium">Nenhum lançamento registrado este mês.</p>
                <p className="text-xs text-text-secondary mt-1">Use os botões acima para registrar entradas e saídas.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {lancamentos.map(l => {
                    const isPagamento = l.kind === 'pagamento';
                    const isSaida     = l.kind === 'saida';
                    const isEntrada   = l.kind === 'entrada';

                    const label = isSaida
                      ? ((l.item as Despesa).descricao ?? (l.item as Despesa).categoria)
                      : isEntrada
                        ? ((l.item as ReceitaManual).descricao ?? (l.item as ReceitaManual).forma)
                        : (l.item as PagamentoPago).paciente_nome;

                    const formaRaw = isPagamento
                      ? ((l.item as PagamentoPago).forma_pagamento ?? 'outro')
                      : isEntrada ? (l.item as ReceitaManual).forma : '';

                    const badge = isSaida
                      ? (l.item as Despesa).categoria
                      : isPagamento
                        ? (FORMA_LABEL[formaRaw] ?? formaRaw.toUpperCase())
                        : (l.item as ReceitaManual).forma.toUpperCase();

                    const badgeCss = isSaida
                      ? categoriaCor((l.item as Despesa).categoria)
                      : isPagamento
                        ? (FORMA_CORES[formaRaw] ?? FORMA_CORES.outro)
                        : formaCor((l.item as ReceitaManual).forma);

                    const subInfo = isSaida ? (l.item as Despesa).tipo : isPagamento ? 'orçamento' : null;

                    return (
                      <motion.div
                        key={`${l.kind}-${l.id}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-3 px-6 py-3.5 group hover:bg-surface-alt transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSaida ? 'bg-coral/8 text-coral' : 'bg-teal/8 text-teal'
                        }`}>
                          {isSaida
                            ? <ArrowUpRight className="w-3.5 h-3.5" />
                            : isPagamento
                              ? <CreditCard className="w-3.5 h-3.5" />
                              : <ArrowDownLeft className="w-3.5 h-3.5" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeCss}`}>
                              {badge}
                            </span>
                            {subInfo && (
                              <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-bold ${
                                subInfo === 'fixo'
                                  ? 'bg-teal/10 text-teal'
                                  : subInfo === 'orçamento'
                                    ? 'bg-teal/5 text-teal/70'
                                    : 'bg-surface-alt text-text-secondary'
                              }`}>
                                {subInfo}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-text-primary font-medium truncate">{label}</span>
                            <span className="font-mono text-[10px] text-text-secondary shrink-0">
                              {format(parseISO(l.data), 'dd/MM')}
                            </span>
                          </div>
                        </div>

                        <span className={`font-mono text-sm font-semibold shrink-0 tabular-nums ${isSaida ? 'text-coral' : 'text-teal'}`}>
                          {isPrivacy ? '••••••' : `${isSaida ? '−' : '+'}R$ ${fmt(l.item.valor)}`}
                        </span>

                        {!isPagamento ? (
                          <button
                            onClick={() => isSaida ? void handleDelete(l.id) : void handleDeleteReceita(l.id)}
                            disabled={isSaida ? removendo === l.id : removendoReceita === l.id}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-coral hover:bg-coral/10 transition-all shrink-0"
                          >
                            {(isSaida ? removendo === l.id : removendoReceita === l.id)
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        ) : (
                          <div className="w-7 h-7 shrink-0" />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Rodapé saldo */}
                <div className="flex items-center justify-between px-6 py-3 bg-surface-alt">
                  <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Saldo do mês</span>
                  <span className={`font-mono font-bold tabular-nums ${saldo.saldo >= 0 ? 'text-teal' : 'text-coral'}`}>
                    {isPrivacy ? '••••••' : `${saldo.saldo >= 0 ? '+' : '−'}R$ ${fmt(Math.abs(saldo.saldo))}`}
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* ── Zona 4: Receita Prevista (pagamentos pendentes) ─────────────── */}
          {pagamentosPendentes.length > 0 && (
            <div className="bg-surface rounded-3xl border border-border overflow-hidden mt-6">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                <div className="w-6 h-6 rounded-lg bg-teal/10 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-teal" />
                </div>
                <h2 className="font-semibold text-text-primary">Receita Prevista</h2>
                <span className="font-mono text-xs text-text-secondary ml-1">
                  {pagamentosPendentes.length} {pagamentosPendentes.length !== 1 ? 'pagamentos pendentes' : 'pagamento pendente'}
                </span>
                <div className="ml-auto">
                  <span className={`font-mono text-sm font-bold tabular-nums text-teal`}>
                    {isPrivacy
                      ? '••••••'
                      : `+R$ ${fmt(pagamentosPendentes.reduce((s, p) => s + p.valor, 0))}`
                    }
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {pagamentosPendentes.slice(0, 8).map(p => {
                  const vencido = p.data_vencimento != null && p.data_vencimento < new Date().toISOString().split('T')[0];
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-surface-alt transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        vencido ? 'bg-coral/8 text-coral' : 'bg-teal/8 text-teal'
                      }`}>
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            vencido ? 'bg-coral/10 text-coral' : 'bg-surface-alt text-text-secondary'
                          }`}>
                            {vencido ? 'Vencido' : 'Pendente'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-text-primary font-medium truncate">{p.paciente_nome}</span>
                          {p.data_vencimento && (
                            <span className={`font-mono text-[10px] shrink-0 ${vencido ? 'text-coral' : 'text-text-secondary'}`}>
                              vence {format(parseISO(p.data_vencimento), 'dd/MM')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold shrink-0 tabular-nums text-text-secondary">
                        {isPrivacy ? '••••••' : `R$ ${fmt(p.valor)}`}
                      </span>
                    </div>
                  );
                })}
                {pagamentosPendentes.length > 8 && (
                  <div className="px-6 py-3 text-center">
                    <a href="/dashboard/orcamentos" className="text-xs text-teal font-semibold flex items-center justify-center gap-1.5 hover:text-teal-lt transition-colors">
                      Ver todos os orçamentos <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      </PlanGuard>

      {/* ── Sheet: formulário de lançamento ──────────────────────────────────── */}
      <Sheet open={sheetMode !== null} onOpenChange={open => { if (!open) setSheetMode(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-surface border-l border-border p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              {sheetMode === 'saida' ? (
                <>
                  <div className="w-7 h-7 rounded-lg bg-coral/10 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 text-coral" />
                  </div>
                  Registrar Saída
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4 text-teal" />
                  </div>
                  Registrar Entrada
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {sheetMode === 'saida' ? (
              <form id="form-saida" onSubmit={e => void handleSubmit(e)} className="space-y-4">
                {role === 'secretaria' && (
                  <DentistaSelector
                    value={form.dentistaId ?? ''}
                    onChange={v => {
                      setSelectedDentistaId(v);
                      setForm(f => ({ ...f, dentistaId: v || undefined }));
                      setFormReceita(f => ({ ...f, dentistaId: v || undefined }));
                    }}
                    dentistas={dentistasClinica}
                  />
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Valor (R$)</Label>
                  <Input
                    type="number" min="0.01" step="0.01" placeholder="0,00"
                    value={form.valor || ''}
                    onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                    className="rounded-xl font-mono" required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => { if (v) setForm(f => ({ ...f, categoria: v })); }}>
                    <SelectTrigger className="w-full h-10 rounded-xl border border-border bg-surface text-text-primary focus:ring-2 focus:ring-teal/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border border-border">
                      {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Tipo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['variavel', 'fixo'] as const).map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: t }))}
                        className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                          form.tipo === t
                            ? 'bg-teal/10 border-teal text-teal'
                            : 'border-border text-text-secondary hover:bg-surface-alt'
                        }`}
                      >
                        {t === 'variavel' ? 'Variável' : 'Fixo'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Data</Label>
                  <Input
                    type="date" value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="rounded-xl font-mono" required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Descrição <span className="text-xs">(opcional)</span></Label>
                  <Input
                    value={form.descricao}
                    onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Compra de luvas e máscaras"
                    className="rounded-xl" maxLength={200}
                  />
                </div>
              </form>
            ) : (
              <form id="form-entrada" onSubmit={e => void handleSubmitReceita(e)} className="space-y-4">
                {role === 'secretaria' && (
                  <DentistaSelector
                    value={formReceita.dentistaId ?? ''}
                    onChange={v => {
                      setSelectedDentistaId(v);
                      setForm(f => ({ ...f, dentistaId: v || undefined }));
                      setFormReceita(f => ({ ...f, dentistaId: v || undefined }));
                    }}
                    dentistas={dentistasClinica}
                  />
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Valor (R$)</Label>
                  <Input
                    type="number" min="0.01" step="0.01" placeholder="0,00"
                    value={formReceita.valor || ''}
                    onChange={e => setFormReceita(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                    className="rounded-xl font-mono" required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Forma de recebimento</Label>
                  <Select value={formReceita.forma} onValueChange={v => setFormReceita(f => ({ ...f, forma: v as NovaReceitaForm['forma'] }))}>
                    <SelectTrigger className="w-full h-10 rounded-xl border border-border bg-surface text-text-primary focus:ring-2 focus:ring-teal/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border border-border">
                      {FORMAS_ENTRADA.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Data</Label>
                  <Input
                    type="date" value={formReceita.data}
                    onChange={e => setFormReceita(f => ({ ...f, data: e.target.value }))}
                    className="rounded-xl font-mono" required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-text-secondary">Descrição <span className="text-xs">(opcional)</span></Label>
                  <Input
                    value={formReceita.descricao}
                    onChange={e => setFormReceita(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Repasse convênio Amil"
                    className="rounded-xl" maxLength={200}
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer com botão de submit */}
          <div className="px-6 py-4 border-t border-border">
            <Button
              type="submit"
              form={sheetMode === 'saida' ? 'form-saida' : 'form-entrada'}
              disabled={sheetMode === 'saida' ? salvando : salvandoReceita}
              className={`w-full rounded-xl font-semibold ${
                sheetMode === 'saida'
                  ? 'bg-surface-alt hover:bg-coral/10 text-coral border border-coral/30'
                  : 'bg-teal hover:bg-teal-lt text-white'
              }`}
            >
              {(sheetMode === 'saida' ? salvando : salvandoReceita)
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : sheetMode === 'saida'
                  ? <><ArrowUpRight className="w-4 h-4 mr-2" />Registrar Saída</>
                  : <><ArrowDownLeft className="w-4 h-4 mr-2" />Registrar Entrada</>
              }
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function DentistaSelector({
  value, onChange, dentistas,
}: {
  value: string;
  onChange: (v: string) => void;
  dentistas: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-text-secondary flex items-center gap-1.5">
        <UserRound className="w-3.5 h-3.5" />
        Dentista responsável
        <span className="text-coral">*</span>
      </Label>
      <Select value={value} onValueChange={v => { if (v !== null) onChange(v); }}>
        <SelectTrigger className="w-full h-10 rounded-xl border border-border bg-surface text-text-primary focus:ring-2 focus:ring-teal/50">
          <SelectValue placeholder="Selecione o dentista..." />
        </SelectTrigger>
        <SelectContent className="bg-surface border border-border">
          {dentistas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── IntelCard ────────────────────────────────────────────────────────────────

function IntelCard({
  label, value, sub, positive, isPrivacy,
}: {
  label: string;
  value: string;
  sub: string;
  positive: boolean | null;
  isPrivacy: boolean;
}) {
  const valueColor = positive === null
    ? 'text-text-primary'
    : positive
      ? 'text-teal'
      : 'text-coral';

  return (
    <div className="bg-surface rounded-2xl border border-border p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2">{label}</p>
      <p className={`font-mono text-xl font-bold tabular-nums ${valueColor}`}>
        {isPrivacy ? '•••' : value}
      </p>
      <p className="text-[10px] text-text-secondary mt-1">{sub}</p>
    </div>
  );
}

// ─── MiniKpi ──────────────────────────────────────────────────────────────────

function MiniKpi({
  label, valor, color, icon, isPrivacy, destaque = false,
}: {
  label:     string;
  valor:     number;
  color:     'teal' | 'coral';
  icon:      React.ReactNode;
  isPrivacy: boolean;
  destaque?: boolean;
}) {
  const isTeal = color === 'teal';
  const isNeg  = valor < 0;
  const display = isPrivacy
    ? '••••••'
    : Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={`px-4 py-3 rounded-2xl border min-w-[120px] ${
      destaque
        ? isNeg
          ? 'bg-coral/5 border-coral/20'
          : 'bg-teal/5 border-teal/20'
        : 'bg-surface border-border'
    }`}>
      <div className={`flex items-center gap-1.5 mb-1 ${isTeal ? 'text-teal' : 'text-coral'}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary">{label}</span>
      </div>
      <div className={`font-mono text-base font-semibold tabular-nums ${
        destaque ? (isNeg ? 'text-coral' : 'text-teal') : 'text-text-primary'
      }`}>
        {isPrivacy ? display : (
          <>
            {isNeg && destaque ? '−' : ''}
            <span className="text-xs text-text-secondary mr-0.5">R$</span>
            {display}
          </>
        )}
      </div>
    </div>
  );
}
