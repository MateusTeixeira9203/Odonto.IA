'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  CircleDollarSign,
  Tag,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Despesa, SaldoMes, NovaDespesaForm, ChartPoint } from '../actions';
import { criarDespesa, excluirDespesa } from '../actions';
import { GanhosDespesasChart } from '../../_components/ganhos-despesas-chart';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { PlanGuard } from '@/components/plan-guard';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  'Aluguel', 'Material', 'Equipamento', 'Salário', 'Marketing',
  'Serviços', 'Impostos', 'Manutenção', 'Outro',
] as const;

const CATEGORIA_CORES: Record<string, string> = {
  aluguel:     'bg-surface-alt text-text-secondary',
  material:    'bg-teal/10 text-teal',
  equipamento: 'bg-teal/10 text-teal',
  salário:     'bg-surface-alt text-text-secondary',
  marketing:   'bg-surface-alt text-text-secondary',
  serviços:    'bg-teal/10 text-teal',
  impostos:    'bg-coral/10 text-coral',
  manutenção:  'bg-surface-alt text-text-secondary',
  outro:       'bg-surface-alt text-text-secondary',
};

function categoriaCor(cat: string): string {
  return CATEGORIA_CORES[cat.toLowerCase()] ?? CATEGORIA_CORES.outro;
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  mesAtual:         string;
  despesasIniciais: Despesa[];
  saldoInicial:     SaldoMes;
  chartData:        ChartPoint[];
  role:             DentistaRole;
  plano:            PlanoId;
  dentistaId:       string;
  /** Lista de dentistas da clínica — usada pelo seletor da secretária */
  dentistasClinica: { id: string; nome: string }[];
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FinanceiroClient({
  mesAtual,
  despesasIniciais,
  saldoInicial,
  chartData,
  role,
  plano,
  dentistaId,
  dentistasClinica,
}: Props) {
  const router  = useRouter();
  const [despesas, setDespesas] = useState<Despesa[]>(despesasIniciais);
  const [saldo,    setSaldo]    = useState<SaldoMes>(saldoInicial);

  // Formulário
  const [form, setForm] = useState<NovaDespesaForm>({
    valor:     0,
    categoria: 'Outro',
    tipo:      'variavel',
    data:      format(new Date(), 'yyyy-MM-dd'),
    descricao: '',
    // Secretária começa sem dentista selecionado; outros usam o próprio ID
    dentistaId: role === 'secretaria' ? '' : dentistaId,
  });
  const [salvando,   setSalvando]   = useState(false);
  const [removendo,  setRemovendo]  = useState<string | null>(null);

  const mesDate = parseISO(`${mesAtual}-01`);
  const mesLabel = format(mesDate, "MMMM 'de' yyyy", { locale: ptBR });

  function navMes(delta: number) {
    const prox = delta > 0 ? addMonths(mesDate, 1) : subMonths(mesDate, 1);
    router.push(`/dashboard/financeiro?mes=${format(prox, 'yyyy-MM')}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.valor || form.valor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (role === 'secretaria' && !form.dentistaId) {
      toast.error('Selecione o dentista responsável pela despesa');
      return;
    }

    setSalvando(true);
    try {
      const res = await criarDespesa(form);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao salvar'); return; }

      const novaDespesa: Despesa = {
        id:          res.id ?? crypto.randomUUID(),
        clinica_id:  '',
        dentista_id: form.dentistaId ?? null,
        valor:       form.valor,
        categoria:   form.categoria,
        tipo:        form.tipo,
        data:        form.data,
        descricao:   form.descricao?.trim() || null,
        created_at:  new Date().toISOString(),
      };

      // Adiciona à lista só se pertence ao mês atual
      if (form.data.startsWith(mesAtual)) {
        setDespesas(prev => [novaDespesa, ...prev]);
        setSaldo(prev => ({ ...prev, despesas: prev.despesas + form.valor, saldo: prev.saldo - form.valor }));
      }

      toast.success('Despesa registrada!');
      // Secretária resetar o dentista selecionado também
      setForm(f => ({
        ...f,
        valor: 0,
        descricao: '',
        dentistaId: role === 'secretaria' ? '' : dentistaId,
      }));
    } finally {
      setSalvando(false);
    }
  }

  async function handleDelete(id: string) {
    const despesa = despesas.find(d => d.id === id);
    if (!despesa) return;

    setRemovendo(id);
    try {
      const res = await excluirDespesa(id);
      if (!res.ok) { toast.error(res.erro ?? 'Erro ao remover'); return; }

      setDespesas(prev => prev.filter(d => d.id !== id));
      setSaldo(prev => ({
        ...prev,
        despesas: prev.despesas - despesa.valor,
        saldo:    prev.saldo    + despesa.valor,
      }));
      toast.success('Despesa removida');
    } finally {
      setRemovendo(null);
    }
  }

  const showSummary = role !== 'secretaria';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-6xl mx-auto w-full"
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-[--color-black] dark:text-white">
              Financeiro
            </h1>
            <p className="text-sm text-[--color-gray-md] capitalize">{mesLabel}</p>
          </div>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navMes(-1)}
            className="w-8 h-8 rounded-xl border border-[--color-border] dark:border-white/10 flex items-center justify-center hover:bg-[--color-surface-alt] dark:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-[--color-gray-md]" />
          </button>
          <span className="font-mono text-xs uppercase tracking-widest text-[--color-gray-md] px-2 capitalize">
            {format(mesDate, 'MMM yyyy', { locale: ptBR })}
          </span>
          <button
            onClick={() => navMes(1)}
            disabled={mesAtual >= format(new Date(), 'yyyy-MM')}
            className="w-8 h-8 rounded-xl border border-[--color-border] dark:border-white/10 flex items-center justify-center hover:bg-[--color-surface-alt] dark:hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4 text-[--color-gray-md]" />
          </button>
        </div>
      </div>

      {/* ── PlanGuard: SOLO não tem financeiro ─────────────────────────────── */}
      <PlanGuard plano={plano} feature="financeiro" featureName="Módulo Financeiro" requiredPlan="BASICO">
        <>
          {/* ── Top: KPIs (30%) + Fluxo de Caixa (70%) ───────────────────── */}
          {showSummary && (
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_7fr] gap-6 mb-8">
              {/* Left: 3 KPI cards stacked */}
              <div className="flex flex-col gap-4">
                <SummaryCard
                  label="Receita"
                  valor={saldo.receita}
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="teal"
                />
                <SummaryCard
                  label="Despesas"
                  valor={saldo.despesas}
                  icon={<TrendingDown className="w-4 h-4" />}
                  color="coral"
                />
                <SummaryCard
                  label="Lucro Líquido"
                  valor={saldo.saldo}
                  icon={<CircleDollarSign className="w-4 h-4" />}
                  color={saldo.saldo >= 0 ? 'teal' : 'coral'}
                  destaque
                />
              </div>

              {/* Right: Fluxo de Caixa chart */}
              <div className="bg-surface rounded-3xl border border-[--color-border] p-6 flex flex-col">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="font-semibold text-[--color-black] dark:text-white">
                      Fluxo de Caixa
                    </h2>
                    <p className="text-xs text-[--color-gray-md] mt-0.5">
                      Entradas × Saídas — últimos 6 meses
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs text-[--color-gray-md]">
                      <span className="w-2 h-2 rounded-full bg-teal inline-block shrink-0" />
                      Receita
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[--color-gray-md]">
                      <span className="w-2 h-2 rounded-full bg-coral inline-block shrink-0" />
                      Despesas
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-h-[180px]">
                  <GanhosDespesasChart data={chartData} />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ── Formulário ────────────────────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="bg-surface rounded-3xl border border-[--color-border] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Plus className="w-4 h-4 text-teal" />
                  <h2 className="font-semibold text-[--color-black] dark:text-white">
                    Nova Despesa
                  </h2>
                </div>

                <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
                  {/* Seletor de dentista — obrigatório para secretária */}
                  {role === 'secretaria' && (
                    <div className="space-y-1.5">
                      <Label className="text-sm text-[--color-gray-md] flex items-center gap-1.5">
                        <UserRound className="w-3.5 h-3.5" />
                        Dentista responsável
                        <span className="text-coral">*</span>
                      </Label>
                    <Select
                      value={form.dentistaId ?? ''}
                      onValueChange={v => setForm(f => ({ ...f, dentistaId: v || undefined }))}
                    >
                      <SelectTrigger className="w-full h-10 rounded-xl border border-[--color-border] bg-surface text-text-primary focus:ring-2 focus:ring-teal/50">
                        <SelectValue placeholder="Selecione o dentista..." />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border border-[--color-border]">
                        {dentistasClinica.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                  )}

                  {/* Valor */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-[--color-gray-md]">Valor (R$)</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      value={form.valor || ''}
                      onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                      className="rounded-xl font-mono"
                      required
                    />
                  </div>

                  {/* Categoria */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-[--color-gray-md]">Categoria</Label>
                    <Select
                      value={form.categoria}
                      onValueChange={v => setForm(f => ({ ...f, categoria: v as any }))}
                    >
                      <SelectTrigger className="w-full h-10 rounded-xl border border-[--color-border] bg-surface text-text-primary focus:ring-2 focus:ring-teal/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border border-[--color-border]">
                        {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-[--color-gray-md]">Tipo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['variavel', 'fixo'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, tipo: t }))}
                          className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                            form.tipo === t
                              ? 'bg-teal/10 border-teal text-teal'
                              : 'border-[--color-border] dark:border-white/10 text-[--color-gray-md] hover:bg-[--color-surface-alt] dark:hover:bg-white/5'
                          }`}
                        >
                          {t === 'variavel' ? 'Variável' : 'Fixo'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-[--color-gray-md]">Data</Label>
                    <Input
                      type="date"
                      value={form.data}
                      onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                      className="rounded-xl font-mono"
                      required
                    />
                  </div>

                  {/* Descrição */}
                  <div className="space-y-1.5">
                    <Label className="text-sm text-[--color-gray-md]">
                      Descrição <span className="text-xs">(opcional)</span>
                    </Label>
                    <Input
                      value={form.descricao}
                      onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Ex: Compra de luvas e máscaras"
                      className="rounded-xl"
                      maxLength={200}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={salvando}
                    className="w-full bg-teal hover:bg-teal-lt text-white rounded-xl font-semibold"
                  >
                    {salvando
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Plus className="w-4 h-4 mr-2" />
                    }
                    Registrar Despesa
                  </Button>
                </form>
              </div>
            </div>

            {/* ── Lista de Despesas ────────────────────────────────────── */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-[--color-gray-md]" />
                <h2 className="font-semibold text-[--color-black] dark:text-white">
                  Despesas do Mês
                </h2>
                <span className="ml-auto font-mono text-xs text-[--color-gray-md]">
                  {despesas.length} {despesas.length !== 1 ? 'lançamentos' : 'lançamento'}
                </span>
              </div>

              <div className="bg-surface rounded-3xl border border-[--color-border] overflow-hidden">
                {despesas.length === 0 ? (
                  <div className="p-12 text-center">
                    <Wallet className="w-8 h-8 text-[--color-border] mx-auto mb-3" />
                    <p className="text-sm text-[--color-gray-md] font-medium">
                      Nenhuma despesa registrada este mês.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[--color-border] dark:divide-white/5">
                    <AnimatePresence initial={false}>
                      {despesas.map(d => (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-3 px-5 py-4 group hover:bg-[--color-surface-alt] dark:hover:bg-white/5 transition-colors"
                        >
                          {/* Categoria badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${categoriaCor(d.categoria)}`}>
                            {d.categoria}
                          </span>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-[--color-black] dark:text-white font-medium truncate">
                              {d.descricao ?? d.categoria}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-[--color-gray-md]">
                                {format(parseISO(d.data), 'dd/MM/yyyy')}
                              </span>
                              <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-bold ${
                                d.tipo === 'fixo'
                                  ? 'bg-teal/10 text-teal'
                                  : 'bg-surface-alt text-text-secondary'
                              }`}>
                                {d.tipo}
                              </span>
                            </div>
                          </div>

                          {/* Valor */}
                          <span className="font-mono text-sm font-semibold text-coral shrink-0">
                            − R$ {fmt(d.valor)}
                          </span>

                          {/* Delete */}
                          <button
                            onClick={() => void handleDelete(d.id)}
                            disabled={removendo === d.id}
                            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-coral hover:bg-coral-pale dark:hover:bg-white/5 transition-all shrink-0"
                          >
                            {removendo === d.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Total */}
                    <div className="flex items-center justify-between px-5 py-3 bg-[--color-surface-alt] dark:bg-white/5">
                      <span className="text-xs font-mono uppercase tracking-widest text-[--color-gray-md]">
                        Total
                      </span>
                      <span className="font-mono font-bold text-coral">
                        R$ {fmt(saldo.despesas)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      </PlanGuard>
    </motion.div>
  );
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, valor, icon, color, destaque = false,
}: {
  label: string;
  valor: number;
  icon: React.ReactNode;
  color: 'teal' | 'coral';
  destaque?: boolean;
}) {
  const isTeal = color === 'teal';
  const isNeg  = valor < 0;

  if (destaque) {
    return (
      <div
        className={`p-5 rounded-3xl border shadow-md relative overflow-hidden flex-1 ${
          isNeg
            ? 'bg-coral-pale/30 border-coral/20 dark:bg-coral-pale/10 dark:border-coral/25'
            : 'bg-teal/5 border-teal/20 dark:bg-teal/10 dark:border-teal/30'
        }`}
        style={!isNeg ? { boxShadow: '0 10px 30px -10px rgba(47,156,133,0.15)' } : {}}
      >
        <div className={`flex items-center gap-1.5 mb-2 ${isNeg ? 'text-coral' : 'text-teal'}`}>
          {icon}
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]">{label}</span>
        </div>
        <div className={`font-mono text-2xl font-semibold tracking-tight ${isNeg ? 'text-coral' : 'text-teal'}`}>
          <span className="text-sm mr-1">{isNeg ? '−' : ''}R$</span>
          {Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface p-5 rounded-3xl border border-[--color-border] shadow-sm flex-1">
      <div className={`flex items-center gap-1.5 mb-2 ${isTeal ? 'text-teal' : 'text-coral'}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[--color-gray-md]">{label}</span>
      </div>
      <div className="font-mono text-2xl font-semibold text-[--color-black] dark:text-white tracking-tight">
        <span className="text-sm text-[--color-gray-md] mr-1">R$</span>
        {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}
