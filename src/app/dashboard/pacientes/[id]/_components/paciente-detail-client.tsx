'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  Plus,
  Edit2,
  FileDown,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  Lock,
  Stethoscope,
  MoreHorizontal,
  Activity,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import dynamic from 'next/dynamic';

const TabSkeleton = () => (
  <div className="animate-pulse space-y-4 p-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-16 rounded-xl bg-surface-alt" />
    ))}
  </div>
);

const DocumentosTab   = dynamic(() => import('@/components/pacientes/DocumentosTab').then(m => m.DocumentosTab),     { ssr: false, loading: () => <TabSkeleton /> });
const PlanejamentoTab = dynamic(() => import('@/components/pacientes/PlanejamentoTab').then(m => m.PlanejamentoTab), { ssr: false, loading: () => <TabSkeleton /> });
const FichasTab       = dynamic(() => import('@/components/pacientes/FichasTab').then(m => m.FichasTab),             { ssr: false, loading: () => <TabSkeleton /> });
import { createClient } from '@/lib/supabase/client';
import { saveRecentPatient } from '@/components/command-palette/command-palette';
import { marcarFollowUp, limparFollowUp, snoozeFollowUp } from '../../followup-actions';
import { atualizarPaciente } from '../actions';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { temFeature } from '@/lib/planos';
import {
  atualizarStatusOrcamento,
  registrarPagamento,
  criarOrcamento,
  editarOrcamento,
  excluirOrcamento,
  type FormaPagamento,
  type StatusOrcamento,
} from '@/app/dashboard/orcamentos/actions';
import { criarAgendamento } from '@/app/dashboard/agendamentos/actions';
import type { Paciente } from '@/types/database';
import type { TimelineEvent } from '@/server/patients/get-visible-timeline-events';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { STATUS_ORCAMENTO } from '@/lib/constants/orcamento-status';
import type { OrcamentoComItens, OrcamentoItem, Pagamento, FichaParaOrc, ProcedimentoClinica, NovoOrcItem, OrcEditItem } from './types';
import { EditarPacienteModal } from './modals/editar-paciente-modal';
import { DetalheOrcamentoModal } from './modals/detalhe-orcamento-modal';
import { ConfirmarDeleteOrcModal } from './modals/confirmar-delete-orc-modal';
import { NovaConsultaModal } from './modals/nova-consulta-modal';
import { NovoOrcamentoModal } from './modals/novo-orcamento-modal';

type FichaRecente = {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentista: { nome: string } | null;
};

type FichaParaPendencia = {
  id: string;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  procedimentos_concluidos: string[];
};

type PendenciaItem = {
  fichaId: string;
  tooth: number;
  descricao: string;
  key: string;
  globalKey: string;
};

const ARCH_LABEL_SHORT: Record<number, string> = { 97: 'Sup.', 98: 'Inf.', 99: 'Boca' };

type AgendamentoTabItem = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  duracao_minutos: number;
  dentista: { nome: string } | null;
};

const STATUS_AGENDA_MAP: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Agendado',       cls: 'bg-surface-alt text-text-secondary' },
  confirmed:   { label: 'Confirmado',     cls: 'bg-teal/10 text-teal' },
  completed:   { label: 'Realizado',      cls: 'bg-teal/10 text-teal' },
  cancelled:   { label: 'Cancelado',      cls: 'bg-coral/10 text-coral' },
  no_show:     { label: 'Não compareceu', cls: 'bg-coral/10 text-coral' },
  in_progress: { label: 'Em andamento',   cls: 'bg-teal/10 text-teal' },
  rescheduled: { label: 'Reagendado',     cls: 'bg-surface-alt text-text-secondary' },
};

type AgendamentoProximo = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
};

interface PacienteDetailClientProps {
  paciente: Paciente;
  agendamentoProximo: AgendamentoProximo | null;
  orcamentos: OrcamentoComItens[];
  clinicaId: string;
  dentistaId: string;
  role: DentistaRole;
  plano: PlanoId;
  fichasRecentesSSR?: FichaRecente[];
  timeline?: TimelineEvent[];
}

export function PacienteDetailClient({
  paciente,
  agendamentoProximo,
  orcamentos,
  clinicaId,
  dentistaId,
  role,
  plano,
  fichasRecentesSSR,
  timeline = [],
}: PacienteDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canViewClinical  = true;
  const canWriteClinical = role === 'admin' || role === 'dentista';

  const [activeTab, setActiveTab] = useState('resumo');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(['resumo']));

  // Lê ?tab= da URL para navegar direto à aba correta (ex: vindo do AttentionPanel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
      setMountedTabs(prev => new Set([...prev, tab]));
    }
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setMountedTabs(prev => prev.has(tab) ? prev : new Set([...prev, tab]));
  }, []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editNome, setEditNome] = useState(paciente.nome);
  const [editTelefone, setEditTelefone] = useState(paciente.telefone ?? '');
  const [editEmail, setEditEmail] = useState(paciente.email ?? '');
  const [editEndereco, setEditEndereco] = useState(paciente.endereco ?? '');
  const [editError, setEditError] = useState<string | null>(null);

  // Dados exibíveis do paciente — atualizados localmente após edição (sem router.refresh)
  const [displayNome, setDisplayNome] = useState(paciente.nome);
  const [displayTelefone, setDisplayTelefone] = useState<string | null>(paciente.telefone ?? null);
  const [displayEmail, setDisplayEmail] = useState<string | null>(paciente.email ?? null);
  const [displayEndereco, setDisplayEndereco] = useState<string | null>(paciente.endereco ?? null);

  // Orçamentos — cópia local para atualizações otimistas
  const [orcamentosState, setOrcamentosState] = useState<OrcamentoComItens[]>(orcamentos);
  useEffect(() => { setOrcamentosState(orcamentos); }, [orcamentos]);

  // Persiste paciente como recente para a Command Palette
  useEffect(() => {
    saveRecentPatient({ id: paciente.id, nome: paciente.nome });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.id]);

  // Aba Agenda — lazy fetch ao abrir pela primeira vez
  const [agendamentosTabData, setAgendamentosTabData] = useState<AgendamentoTabItem[] | null>(null);
  const [loadingAgendamentos, setLoadingAgendamentos] = useState(false);

  const [detalheOrcId, setDetalheOrcId] = useState<string | null>(null);
  const [isNovoOrcOpen, setIsNovoOrcOpen] = useState(false);
  const [procedimentosClinica, setProcedimentosClinica] = useState<ProcedimentoClinica[]>([]);
  const [novoOrcItens, setNovoOrcItens] = useState<NovoOrcItem[]>([
    { procedimentoId: '', descricao: '', quantidade: 1, preco: 0 },
  ]);
  const [pagForm, setPagForm] = useState({
    valor: '',
    formaPagamento: 'pix' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
  });
  const [orcSaving, setOrcSaving] = useState(false);
  const [pagSaving, setPagSaving] = useState(false);
  const [orcError, setOrcError] = useState<string | null>(null);
  const [pagError, setPagError] = useState<string | null>(null);
  const [isLoadingFichaParaOrc, setIsLoadingFichaParaOrc] = useState(false);
  const [fichasParaOrc, setFichasParaOrc] = useState<FichaParaOrc[]>([]);
  const [etapaNovoOrc, setEtapaNovoOrc] = useState<'selecionar' | 'itens'>('itens');
  const [novoOrcValorFinal, setNovoOrcValorFinal] = useState<number | null>(null);

  // Edição de orçamento
  const [orcEditMode, setOrcEditMode] = useState(false);
  const [orcEditItens, setOrcEditItens] = useState<OrcEditItem[]>([]);
  const [orcEditSaving, setOrcEditSaving] = useState(false);
  const [orcEditError, setOrcEditError] = useState<string | null>(null);

  // Exclusão de orçamento
  const [confirmDeleteOrcId, setConfirmDeleteOrcId] = useState<string | null>(null);
  const [orcDeleteSaving, setOrcDeleteSaving] = useState(false);
  const [orcDeleteError, setOrcDeleteError] = useState<string | null>(null);

  // Contato dropdown (⋯)
  const [showContato, setShowContato] = useState(false);

  // Nova Consulta
  const [isNovaConsultaOpen, setIsNovaConsultaOpen] = useState(false);
  const [consultaForm, setConsultaForm] = useState({
    data: '',
    hora: '',
    duracao: '30',
    observacoes: '',
  });
  const [consultaSaving, setConsultaSaving] = useState(false);
  const [consultaError, setConsultaError] = useState<string | null>(null);

  // Atividades recentes (visão geral) — inicializado do SSR, sem roundtrip extra ao montar
  const [fichasRecentes, setFichasRecentes] = useState<FichaRecente[]>(fichasRecentesSSR ?? []);
  // Sincroniza quando servidor re-renderizar (ex: após router.refresh())
  useEffect(() => {
    if (fichasRecentesSSR !== undefined) setFichasRecentes(fichasRecentesSSR);
  }, [fichasRecentesSSR]);

  // Follow-up
  const [followupPendente, setFollowupPendente] = useState<boolean>(paciente.followup_pendente ?? false);
  const [followupNota, setFollowupNota] = useState<string>(paciente.followup_nota ?? '');
  const [showFollowupInput, setShowFollowupInput] = useState(false);
  const [followupSaving, setFollowupSaving] = useState(false);

  // Pendências — widget persistente acima das abas
  const [pendencias, setPendencias] = useState<PendenciaItem[]>([]);
  const [pendenciasConcluidas, setPendenciasConcluidas] = useState<Set<string>>(new Set());
  const [togglingPendencia, setTogglingPendencia] = useState<string | null>(null);

  // Tab highlight + switch — acionados pelo tour DEX via CustomEvent
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setHighlightedTab(detail);
      if (detail) {
        clearTimer = setTimeout(() => setHighlightedTab(null), 3000);
      }
    };
    window.addEventListener('dex:highlight-tab', handler);
    return () => {
      window.removeEventListener('dex:highlight-tab', handler);
      clearTimeout(clearTimer);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const tabValue = (e as CustomEvent<string>).detail;
      if (tabValue) handleTabChange(tabValue);
    };
    window.addEventListener('dex:switch-tab', handler);
    return () => window.removeEventListener('dex:switch-tab', handler);
  }, [handleTabChange]);

  useEffect(() => {
    if (activeTab !== 'agenda' || agendamentosTabData !== null) return;
    setLoadingAgendamentos(true);
    const supabase = createClient();
    void supabase
      .from('agendamentos')
      .select('id, data_hora, status, observacoes, duracao_minutos, dentista:dentistas(nome)')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicaId)
      .order('data_hora', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setAgendamentosTabData((data as unknown as AgendamentoTabItem[]) ?? []);
        setLoadingAgendamentos(false);
      });
  }, [activeTab, agendamentosTabData, paciente.id, clinicaId]);

  const iniciais = displayNome
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const endereco = [
    displayEndereco,
    paciente.cidade && paciente.estado
      ? `${paciente.cidade}, ${paciente.estado}`
      : (paciente.cidade ?? paciente.estado),
  ]
    .filter(Boolean)
    .join(' — ');

  const dataNascimento = paciente.data_nascimento
    ? format(parseISO(paciente.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })
    : null;

  const membroDesde = format(parseISO(paciente.created_at), "MMM 'de' yyyy", { locale: ptBR });

  const idade = paciente.data_nascimento
    ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  // Orçamento selecionado no detalhe
  const detalheOrc = orcamentosState.find((o) => o.id === detalheOrcId) ?? null;
  const novoOrcSubtotal = useMemo(
    () => novoOrcItens.reduce((s, i) => s + i.quantidade * i.preco, 0),
    [novoOrcItens]
  );
  const novoOrcTotal = useMemo(
    () => novoOrcValorFinal !== null ? Math.max(0, novoOrcValorFinal) : novoOrcSubtotal,
    [novoOrcSubtotal, novoOrcValorFinal]
  );

  const resumoFinanceiro = useMemo(() => {
    const allPagamentos = orcamentosState.flatMap(o => o.pagamentos);
    return {
      totalAprovado: orcamentosState
        .filter(o => o.status === 'aprovado')
        .reduce((s, o) => s + (o.total ?? 0), 0),
      totalPago: allPagamentos
        .filter(p => p.status === 'pago')
        .reduce((s, p) => s + p.valor, 0),
      totalPendente: allPagamentos
        .filter(p => p.status === 'pendente')
        .reduce((s, p) => s + p.valor, 0),
      temHistorico: allPagamentos.length > 0,
    };
  }, [orcamentosState]);

  const orcamentosAprovados = useMemo(
    () => orcamentosState.filter(o => o.status === 'aprovado'),
    [orcamentosState]
  );
  const orcamentosAbertos = useMemo(
    () => orcamentosState.filter(o => ['rascunho', 'enviado'].includes(o.status)),
    [orcamentosState]
  );
  const orcamentosAguardando = useMemo(
    () => orcamentosState.filter(o => o.status === 'enviado'),
    [orcamentosState]
  );
  const pendenciasAtivas = useMemo(
    () => pendencias.filter(p => !pendenciasConcluidas.has(p.globalKey)),
    [pendencias, pendenciasConcluidas]
  );

  // Procedimentos clínicos dos orçamentos aprovados — headline da Col 2
  const procedimentosPrincipais = useMemo(() => {
    const itens = orcamentosAprovados.flatMap(o => o.itens ?? []);
    return itens.sort((a, b) => (b.preco_total ?? 0) - (a.preco_total ?? 0));
  }, [orcamentosAprovados]);

  const handleMarcarFollowUp = async () => {
    setFollowupSaving(true);
    const res = await marcarFollowUp(paciente.id, followupNota || undefined);
    if (res.ok) {
      setFollowupPendente(true);
      setShowFollowupInput(false);
      toast.success('Follow-up marcado');
    } else {
      toast.error(res.erro ?? 'Erro ao marcar');
    }
    setFollowupSaving(false);
  };

  const handleLimparFollowUp = async () => {
    const notaAnterior = followupNota;
    setFollowupSaving(true);
    const res = await limparFollowUp(paciente.id);
    if (res.ok) {
      setFollowupPendente(false);
      setFollowupNota('');
      toast.success('Follow-up concluído', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            const restore = await marcarFollowUp(paciente.id, notaAnterior || undefined);
            if (restore.ok) {
              setFollowupPendente(true);
              setFollowupNota(notaAnterior);
              toast.success('Follow-up restaurado');
            }
          },
        },
        duration: 6000,
      });
    } else {
      toast.error(res.erro ?? 'Não foi possível concluir o follow-up. Tente novamente.');
    }
    setFollowupSaving(false);
  };

  const handleSnooze = async (days: number) => {
    setFollowupSaving(true);
    const res = await snoozeFollowUp(paciente.id, days);
    if (res.ok) {
      const label = days === 1 ? 'amanhã' : `${days} dias`;
      toast.success(`Follow-up adiado para ${label}`);
    } else {
      toast.error(res.erro ?? 'Erro ao adiar');
    }
    setFollowupSaving(false);
  };

  const handleSaveEdit = () => {
    setEditError(null);
    startTransition(async () => {
      const result = await atualizarPaciente(paciente.id, {
        nome: editNome,
        telefone: editTelefone || null,
        email: editEmail || null,
        endereco: editEndereco || null,
      });
      if (result.error) {
        setEditError(result.error);
      } else {
        setDisplayNome(editNome);
        setDisplayTelefone(editTelefone || null);
        setDisplayEmail(editEmail || null);
        setDisplayEndereco(editEndereco || null);
        setIsEditModalOpen(false);
      }
    });
  };

  // Busca procedimentos da clínica, fichas recentes e pendências ao montar
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from('procedimentos')
      .select('id, nome, preco_padrao')
      .eq('clinica_id', clinicaId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProcedimentosClinica(data ?? []));

    if (!canViewClinical) return;

    // fichasRecentes já foram carregadas no servidor — evita roundtrip desnecessário
    if (fichasRecentesSSR === undefined) {
      void supabase
        .from('fichas')
        .select('id, created_at, queixa_principal, anotacoes, dentista:dentistas(nome)')
        .eq('paciente_id', paciente.id)
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setFichasRecentes((data as unknown as FichaRecente[]) ?? []));
    }

    void supabase
      .from('fichas')
      .select('id, dentes_afetados, dentes_observacoes, procedimentos_concluidos')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicaId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const fichas = (data as unknown as FichaParaPendencia[]) ?? [];
        const items: PendenciaItem[] = [];
        const concluidos = new Set<string>();
        for (const ficha of fichas) {
          (ficha.procedimentos_concluidos ?? []).forEach((k) =>
            concluidos.add(`${ficha.id}::${k}`)
          );
          for (const tooth of ficha.dentes_afetados ?? []) {
            const raw = ficha.dentes_observacoes?.[String(tooth)] ?? '';
            raw.split('\n').filter(Boolean).forEach((note, i) => {
              items.push({
                fichaId: ficha.id,
                tooth,
                descricao: note,
                key: `${tooth}_${i}`,
                globalKey: `${ficha.id}::${tooth}_${i}`,
              });
            });
          }
        }
        setPendencias(items);
        setPendenciasConcluidas(concluidos);
      });
  }, [clinicaId, paciente.id]);

  const togglePendencia = async (item: PendenciaItem) => {
    if (togglingPendencia === item.globalKey) return;
    setTogglingPendencia(item.globalKey);
    try {
      const supabase = createClient();
      const { data: fichaData } = await supabase
        .from('fichas')
        .select('procedimentos_concluidos')
        .eq('id', item.fichaId)
        .single();
      const current: string[] = (fichaData as { procedimentos_concluidos: string[] } | null)?.procedimentos_concluidos ?? [];
      const isDone = pendenciasConcluidas.has(item.globalKey);
      const next = isDone ? current.filter((k) => k !== item.key) : [...current, item.key];
      await supabase
        .from('fichas')
        .update({ procedimentos_concluidos: next })
        .eq('id', item.fichaId)
        .eq('clinica_id', clinicaId);
      setPendenciasConcluidas((prev) => {
        const s = new Set(prev);
        isDone ? s.delete(item.globalKey) : s.add(item.globalKey);
        return s;
      });
    } finally {
      setTogglingPendencia(null);
    }
  };

  const handleStatusChange = useCallback(async (orcId: string, status: StatusOrcamento) => {
    const result = await atualizarStatusOrcamento(orcId, status);
    if (!result.error) {
      setOrcamentosState((prev) =>
        prev.map((o) => (o.id === orcId ? { ...o, status } : o))
      );
    }
  }, []);

  const handleRegistrarPagamento = async () => {
    if (!detalheOrcId) return;
    const valor = parseFloat(pagForm.valor.replace(',', '.'));
    if (!valor || valor <= 0) {
      setPagError('Informe um valor válido.');
      return;
    }
    setPagError(null);
    setPagSaving(true);

    const result = await registrarPagamento({
      orcamentoId: detalheOrcId,
      pacienteId: paciente.id,
      valor,
      formaPagamento: pagForm.formaPagamento,
      data: pagForm.data,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      const novoPag: Pagamento = {
        id:              result.id ?? crypto.randomUUID(),
        valor,
        status:          'pago',
        forma_pagamento: pagForm.formaPagamento,
        data_pagamento:  pagForm.data,
        marcado_por:     null,
      };
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? { ...o, pagamentos: [...o.pagamentos, novoPag] }
            : o
        )
      );
      setPagForm({
        valor: '',
        formaPagamento: 'pix',
        data: new Date().toISOString().split('T')[0],
      });
    }
    setPagSaving(false);
  };

  // Converte dentes_afetados + dentes_observacoes de uma ficha em itens de orçamento.
  // Suporta múltiplos procedimentos por dente (separados por '\n').
  const fichaParaItens = (ficha: FichaParaOrc): NovoOrcItem[] => {
    const dentes = ficha.dentes_afetados ?? [];
    const obs = ficha.dentes_observacoes ?? {};
    if (dentes.length === 0) return [{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }];

    // Agrupa dentes por procedimento: mesmo texto em vários dentes → um item com quantidade N
    const procToTeeth = new Map<string, number[]>();
    for (const tooth of dentes) {
      const procs = (obs[String(tooth)] ?? '').split('\n').filter(Boolean);
      for (const proc of procs) {
        procToTeeth.set(proc, [...(procToTeeth.get(proc) ?? []), tooth]);
      }
    }

    if (procToTeeth.size === 0) {
      return dentes.map((t) => ({ procedimentoId: '', descricao: `Dente ${t}`, quantidade: 1, preco: 0 }));
    }

    return Array.from(procToTeeth.entries()).map(([proc, teeth]) => {
      const match = procedimentosClinica.find(
        (p) =>
          p.nome.toLowerCase().includes(proc.toLowerCase()) ||
          proc.toLowerCase().includes(p.nome.toLowerCase()),
      );
      const descricao =
        teeth.length > 1
          ? `${match?.nome ?? proc} (D${teeth.join(', D')})`
          : match?.nome ?? `D${teeth[0]} — ${proc}`;
      return {
        procedimentoId: match?.id ?? '',
        descricao,
        quantidade: teeth.length,
        preco: match?.preco_padrao ?? 0,
      };
    });
  };

  const abrirNovoOrcamento = async () => {
    setOrcError(null);
    setIsLoadingFichaParaOrc(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('fichas')
        .select('id, created_at, queixa_principal, dentes_afetados, dentes_observacoes')
        .eq('paciente_id', paciente.id)
        .eq('clinica_id', clinicaId)
        .order('created_at', { ascending: false })
        .limit(10);

      const fichas = (data as unknown as FichaParaOrc[]) ?? [];
      setFichasParaOrc(fichas);

      if (fichas.length > 1) {
        // Mais de uma ficha: dentista escolhe qual usar
        setEtapaNovoOrc('selecionar');
        setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      } else {
        // 0 ou 1 ficha: vai direto para os itens
        setNovoOrcItens(fichas.length === 1 ? fichaParaItens(fichas[0]) : [{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
        setEtapaNovoOrc('itens');
      }
    } catch {
      setFichasParaOrc([]);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      setEtapaNovoOrc('itens');
    } finally {
      setIsLoadingFichaParaOrc(false);
    }
    setIsNovoOrcOpen(true);
  };

  const selecionarFichaParaOrc = (fichaId: string | null) => {
    if (!fichaId) {
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
    } else {
      const ficha = fichasParaOrc.find((f) => f.id === fichaId);
      setNovoOrcItens(ficha ? fichaParaItens(ficha) : [{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
    }
    setEtapaNovoOrc('itens');
  };

  const handleCriarOrcamento = async () => {
    // Exige ao menos descrição — preço pode ser 0 (dentista define depois)
    const itensValidos = novoOrcItens.filter((i) => i.descricao.trim());
    if (itensValidos.length === 0) {
      setOrcError('Adicione ao menos um procedimento com descrição.');
      return;
    }
    const temSemPreco = itensValidos.some((i) => i.preco === 0);
    if (temSemPreco) {
      setOrcError('Atenção: alguns procedimentos estão sem valor. Defina o preço antes de continuar.');
      return;
    }
    setOrcError(null);
    setOrcSaving(true);

    const subtotalValido = itensValidos.reduce((s, i) => s + i.quantidade * i.preco, 0);
    const finalValido    = novoOrcValorFinal !== null ? Math.max(0, novoOrcValorFinal) : subtotalValido;
    const descontoValor  = Math.max(0, Math.round((subtotalValido - finalValido) * 100) / 100);

    const result = await criarOrcamento({
      pacienteId: paciente.id,
      desconto:   descontoValor,
      itens: itensValidos.map((i) => ({
        procedimentoId: i.procedimentoId || null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.preco,
      })),
    });

    if (result.error) {
      setOrcError(result.error);
    } else {
      const novoOrc: OrcamentoComItens = {
        id: result.id ?? crypto.randomUUID(),
        status: 'rascunho',
        total: Math.max(0, subtotalValido - descontoValor),
        created_at: new Date().toISOString(),
        validade_dias: 30,
        condicoes_pagamento: null,
        itens: itensValidos.map((i, idx) => ({
          id: `temp-${idx}`,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_total: i.quantidade * i.preco,
        })),
        pagamentos: [],
        aprovado_por: null,
        aprovado_em: null,
      };
      setOrcamentosState((prev) => [novoOrc, ...prev]);
      setIsNovoOrcOpen(false);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: 0 }]);
      toast.success('Orçamento criado como rascunho', {
        description: 'Revise os itens e envie para o paciente quando estiver pronto.',
        duration: 4000,
      });
    }
    setOrcSaving(false);
  };

  const handleOpenEditOrc = () => {
    if (!detalheOrc) return;
    setOrcEditItens(
      detalheOrc.itens.map((item) => ({
        id: item.id,
        descricao: item.descricao ?? '',
        quantidade: item.quantidade,
        preco_unitario:
          item.quantidade > 0 ? (item.preco_total ?? 0) / item.quantidade : (item.preco_total ?? 0),
      }))
    );
    setOrcEditError(null);
    setOrcEditMode(true);
  };

  const handleSalvarEdicaoOrc = async () => {
    if (!detalheOrc) return;
    const itensValidos = orcEditItens.filter((i) => i.descricao.trim() && i.preco_unitario > 0);
    if (itensValidos.length === 0) {
      setOrcEditError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setOrcEditSaving(true);
    const result = await editarOrcamento(detalheOrc.id, itensValidos);
    if (result.error) {
      setOrcEditError(result.error);
    } else {
      const novoTotal = itensValidos.reduce((sum, i) => sum + i.quantidade * i.preco_unitario, 0);
      const novosItens: OrcamentoItem[] = itensValidos.map((i) => ({
        id: i.id ?? crypto.randomUUID(),
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_total: i.quantidade * i.preco_unitario,
      }));
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrc.id ? { ...o, total: novoTotal, itens: novosItens } : o
        )
      );
      setOrcEditMode(false);
    }
    setOrcEditSaving(false);
  };

  const handleExcluirOrc = async () => {
    if (!confirmDeleteOrcId) return;
    setOrcDeleteSaving(true);
    setOrcDeleteError(null);
    const result = await excluirOrcamento(confirmDeleteOrcId, paciente.id);
    if (!result.error) {
      setOrcamentosState((prev) => prev.filter((o) => o.id !== confirmDeleteOrcId));
      setDetalheOrcId(null);
      setConfirmDeleteOrcId(null);
    } else {
      setOrcDeleteError(result.error);
    }
    setOrcDeleteSaving(false);
  };

  const handleNovaConsulta = async () => {
    if (!consultaForm.data || !consultaForm.hora) {
      setConsultaError('Informe data e hora.');
      return;
    }
    setConsultaError(null);
    setConsultaSaving(true);
    const dataHora = `${consultaForm.data}T${consultaForm.hora}:00`;
    const result = await criarAgendamento({
      pacienteId: paciente.id,
      dataHora,
      duracaoMinutos: parseInt(consultaForm.duracao, 10) || 30,
      observacoes: consultaForm.observacoes || null,
    });
    if (result.error) {
      setConsultaError(result.error);
    } else {
      setIsNovaConsultaOpen(false);
      setConsultaForm({ data: '', hora: '', duracao: '30', observacoes: '' });
      setAgendamentosTabData(null); // força recarregar a aba Agenda na próxima abertura
      toast.success('Consulta agendada.');
    }
    setConsultaSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">

      {/* ── HEADER (Task 6) ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard/pacientes')}
            className="p-2 hover:bg-surface rounded-xl transition-colors border border-transparent hover:border-border/40 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-teal flex items-center justify-center text-white font-bold text-base shadow-md shrink-0">
            {iniciais}
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-text-primary leading-none truncate">{displayNome}</h1>
            <p className="text-text-secondary text-sm font-medium mt-0.5">
              {idade !== null ? `${idade} anos · ` : ''}Paciente desde {membroDesde}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setConsultaError(null); setIsNovaConsultaOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal-lt transition-colors shadow-md"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Consulta</span>
          </button>

          {/* ⋯ dropdown — contato + editar + exportar */}
          <div className="relative">
            {showContato && (
              <div className="fixed inset-0 z-20" onClick={() => setShowContato(false)} />
            )}
            <button
              onClick={() => setShowContato(v => !v)}
              className="flex items-center gap-2 px-3 py-2.5 bg-surface-alt rounded-xl text-xs font-bold text-text-primary hover:bg-surface-alt/70 transition-colors border border-border/40"
              title="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showContato && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 z-30 bg-surface border border-border/60 rounded-2xl shadow-lg p-4 min-w-[220px]"
                >
                  {(displayTelefone || displayEmail || endereco) && (
                    <>
                      <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">Contato</p>
                      <div className="space-y-2 mb-3">
                        {displayTelefone && (
                          <div className="flex items-center gap-2 text-sm text-text-primary">
                            <Phone className="w-3.5 h-3.5 text-teal shrink-0" />
                            {displayTelefone}
                          </div>
                        )}
                        {displayEmail && (
                          <div className="flex items-center gap-2 text-sm text-text-primary">
                            <Mail className="w-3.5 h-3.5 text-teal shrink-0" />
                            <span className="truncate">{displayEmail}</span>
                          </div>
                        )}
                        {endereco && (
                          <div className="flex items-start gap-2 text-sm text-text-primary">
                            <MapPin className="w-3.5 h-3.5 text-teal shrink-0 mt-0.5" />
                            <span className="leading-snug">{endereco}</span>
                          </div>
                        )}
                      </div>
                      <div className="h-px bg-border/40 mb-3" />
                    </>
                  )}
                  <div className="space-y-0.5">
                    <button
                      onClick={() => { setIsEditModalOpen(true); setShowContato(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 w-full hover:bg-surface-alt rounded-xl text-xs font-semibold text-text-primary transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-text-secondary" />
                      Editar Paciente
                    </button>
                    <button
                      onClick={() => { window.open(`/api/pacientes/${paciente.id}/prontuario`, '_blank'); setShowContato(false); }}
                      className="flex items-center gap-2.5 px-3 py-2 w-full hover:bg-surface-alt rounded-xl text-xs font-semibold text-text-primary transition-colors"
                    >
                      <FileDown className="w-3.5 h-3.5 text-text-secondary" />
                      Exportar prontuário
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6"
        >


          {/* Tabs — IDs usados pelo tour DEX */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="bg-surface p-1.5 rounded-2xl border border-border/60 shadow-sm mb-6 flex-wrap h-auto gap-1">
              {(
                [
                  ['resumo',        'Resumo',       undefined],
                  ...(canWriteClinical ? [['tratamento',   'Tratamento',   'tab-apresentacao'] as const] : []),
                  ...(canViewClinical  ? [['ficha-clinica','Ficha Clínica','tab-fichas'      ] as const] : []),
                  ['agenda',        'Agenda',        undefined],
                  ['orcamentos',    'Orçamentos',   'tab-orcamento'   ],
                  ['arquivos',      'Arquivos',     'tab-documentos'  ],
                ] as [string, string, string | undefined][]
              ).map(([val, label, tourId]) => (
                <TabsTrigger
                  key={val}
                  id={tourId}
                  value={val}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold text-text-secondary transition-all duration-300 data-[state=active]:bg-teal/10 data-[state=active]:text-teal data-[state=active]:border data-[state=active]:border-teal/20 data-[state=active]:shadow-none hover:text-text-primary${tourId && highlightedTab === tourId ? ' ring-2 ring-teal/60 shadow-[0_0_14px_theme(colors.teal/0.45)]' : ''}`}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div>
              <div>
                {/* Resumo */}
                <TabsContent value="resumo" className="mt-0 space-y-6">
                  {/* ── 1. Atividade Recente ──────────────────────────────── */}
                  {canWriteClinical && (
                    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-xl text-text-primary">Atividade Recente</h3>
                        <FileText className="w-5 h-5 text-teal" />
                      </div>
                      {fichasRecentes.length === 0 ? (
                        <div className="text-center py-6">
                          <FileText className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
                          <p className="text-sm text-text-secondary">Nenhum registro clínico ainda.</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {fichasRecentes.map((ficha) => (
                            <div
                              key={ficha.id}
                              className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0"
                            >
                              <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="w-4 h-4 text-teal" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-text-primary truncate">
                                  {ficha.queixa_principal ?? 'Evolução clínica'}
                                </div>
                                {ficha.anotacoes && (
                                  <div className="text-xs text-text-secondary truncate mt-0.5">
                                    {ficha.anotacoes}
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-text-secondary">
                                    {format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                  {ficha.dentista && (
                                    <span className="text-xs text-teal font-medium">
                                      {ficha.dentista.nome}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 2. Resumo Financeiro ──────────────────────────────── */}
                  {resumoFinanceiro.temHistorico && (
                    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-xl text-text-primary">Financeiro</h3>
                        <CreditCard className="w-5 h-5 text-teal" />
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-surface-alt rounded-xl p-3 text-center">
                          <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">Aprovado</p>
                          <p className="font-mono text-base font-bold text-text-primary tabular-nums">
                            {resumoFinanceiro.totalAprovado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div className="bg-teal/5 rounded-xl p-3 text-center border border-teal/15">
                          <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">Recebido</p>
                          <p className="font-mono text-base font-bold text-teal tabular-nums">
                            {resumoFinanceiro.totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div className={`rounded-xl p-3 text-center ${
                          resumoFinanceiro.totalPendente > 0
                            ? 'bg-coral/5 border border-coral/15'
                            : 'bg-surface-alt'
                        }`}>
                          <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-secondary mb-1">Pendente</p>
                          <p className={`font-mono text-base font-bold tabular-nums ${
                            resumoFinanceiro.totalPendente > 0 ? 'text-coral' : 'text-text-secondary'
                          }`}>
                            {resumoFinanceiro.totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>
                      {resumoFinanceiro.totalAprovado > 0 && (
                        <div className="w-full bg-surface-alt rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (resumoFinanceiro.totalPago / resumoFinanceiro.totalAprovado) * 100)}%` }}
                          />
                        </div>
                      )}
                      <button
                        onClick={() => setActiveTab('orcamentos')}
                        className="w-full mt-3 py-2.5 text-xs font-bold text-teal hover:text-teal-lt transition-colors flex items-center justify-center gap-2"
                      >
                        Ver Orçamentos <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ── 3. Timeline Clínica ───────────────────────────────── */}
                  {timeline.length > 0 && (
                    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading text-xl text-text-primary">Histórico</h3>
                        <Clock className="w-5 h-5 text-teal" />
                      </div>
                      <div className="relative">
                        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border/60" />
                        <div className="space-y-0">
                          {timeline.slice(0, 8).map((event, idx) => {
                            const dotColor =
                              event.type === 'payment_registered' ? 'bg-teal'
                              : event.type === 'appointment_cancelled' ? 'bg-coral'
                              : event.type === 'consultation_created' ? 'bg-teal'
                              : 'bg-surface-alt border border-border';
                            return (
                              <div key={event.id} className="flex gap-4 pb-4 last:pb-0">
                                <div className="relative z-10 mt-1 shrink-0">
                                  <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                                </div>
                                <div className="flex-1 min-w-0 pb-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-medium text-text-primary leading-snug">
                                      {event.title}
                                    </p>
                                    <span className="text-xs font-mono text-text-secondary shrink-0">
                                      {format(parseISO(event.timestamp), 'dd/MM', { locale: ptBR })}
                                    </span>
                                  </div>
                                  {event.description && (
                                    <p className="text-xs text-text-secondary mt-0.5 truncate">{event.description}</p>
                                  )}
                                  {event.actor && (
                                    <p className="text-[11px] text-teal mt-0.5">{event.actor}</p>
                                  )}
                                  {idx < timeline.slice(0, 8).length - 1 && (
                                    <div className="h-px bg-border/30 mt-3" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* placeholder para que a aba nunca fique completamente vazia */}
                  {!canWriteClinical && !resumoFinanceiro.temHistorico && timeline.length === 0 && (
                    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-10 text-center">
                      <Clock className="w-10 h-10 text-text-secondary/20 mx-auto mb-3" />
                      <p className="text-sm text-text-secondary">Nenhuma atividade registrada ainda.</p>
                    </div>
                  )}
                </TabsContent>

                {canViewClinical && (
                  <TabsContent value="ficha-clinica" className="mt-0">
                    {mountedTabs.has('ficha-clinica') && (
                      <FichasTab
                        patientId={paciente.id}
                        clinicaId={clinicaId}
                        dentistaId={dentistaId}
                        plano={plano}
                        canWrite={canWriteClinical}
                      />
                    )}
                  </TabsContent>
                )}

                {canWriteClinical && (
                  <TabsContent value="tratamento" className="mt-0">
                    {mountedTabs.has('tratamento') && (
                      temFeature(plano, 'planejamentoIA') ? (
                        <PlanejamentoTab patientId={paciente.id} clinicaId={clinicaId} patientName={displayNome} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-teal" />
                          </div>
                          <div>
                            <p className="font-bold text-text-primary mb-1">Disponível no Plano Básico</p>
                            <p className="text-sm text-text-secondary max-w-xs">Faça upgrade para acessar o Planejamento com IA — apresentações visuais e planos de tratamento completos.</p>
                          </div>
                        </div>
                      )
                    )}
                  </TabsContent>
                )}

                {/* Orçamentos */}
                <TabsContent value="orcamentos" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary font-medium">
                      {orcamentosState.length} orçamento{orcamentosState.length !== 1 ? 's' : ''}
                    </span>
                    {role !== 'secretaria' && (
                      <button
                        onClick={() => void abrirNovoOrcamento()}
                        disabled={isLoadingFichaParaOrc}
                        className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md disabled:opacity-60"
                      >
                        {isLoadingFichaParaOrc ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Novo Orçamento
                      </button>
                    )}
                  </div>

                  {orcamentosState.length === 0 ? (
                    <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 text-center">
                      <CreditCard className="w-12 h-12 text-teal/20 mx-auto mb-4" />
                      <h3 className="font-heading text-2xl text-text-primary mb-2">
                        Nenhum orçamento
                      </h3>
                      <p className="text-text-secondary text-sm max-w-md mx-auto">
                        Nenhum orçamento ainda. Clique em + Novo Orçamento para criar.
                      </p>
                    </div>
                  ) : (
                    orcamentosState.map((orc) => {
                      const st = STATUS_ORCAMENTO[orc.status] ?? STATUS_ORCAMENTO.rascunho;
                      const StatusIcon =
                        orc.status === 'aprovado'
                          ? CheckCircle2
                          : orc.status === 'recusado'
                          ? XCircle
                          : AlertCircle;
                      return (
                        <div
                          key={orc.id}
                          onClick={() => setDetalheOrcId(orc.id)}
                          className={`rounded-2xl border shadow-sm p-6 cursor-pointer transition-colors ${
                            (orc.status === 'rascunho' || orc.status === 'enviado')
                              ? 'bg-amber-500/[0.03] border-amber-500/40 hover:border-amber-500/60'
                              : 'bg-surface border-border/60 hover:border-teal/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface-alt flex items-center justify-center">
                                <StatusIcon className="w-5 h-5 text-teal" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${st.cls}`}
                                  >
                                    {st.label}
                                  </span>
                                </div>
                                <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(parseISO(orc.created_at), 'dd/MM/yyyy', {
                                    locale: ptBR,
                                  })}
                                  {orc.validade_dias && (
                                    <> • Validade: {orc.validade_dias} dias</>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-mono text-lg font-bold text-text-primary">
                                  R${' '}
                                  {(orc.total ?? 0).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                  })}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-text-secondary" />
                            </div>
                          </div>

                          {orc.itens.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {orc.itens.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2 text-text-secondary">
                                    <FileText className="w-3 h-3" />
                                    {item.descricao ?? '—'}
                                    {item.quantidade > 1 && (
                                      <span className="font-mono">×{item.quantidade}</span>
                                    )}
                                  </div>
                                  <span className="font-mono text-text-primary font-medium">
                                    R${' '}
                                    {(item.preco_total ?? 0).toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {orc.pagamentos.length > 0 && (
                            <div className="pt-3 border-t border-border/40">
                              <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">
                                Pagamentos
                              </div>
                              {orc.pagamentos.map((pg) => (
                                <div
                                  key={pg.id}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-text-secondary capitalize">
                                    {pg.forma_pagamento ?? 'Não informado'} •{' '}
                                    <span
                                      className={
                                        pg.status === 'pago' ? 'text-teal' : 'text-yellow-600'
                                      }
                                    >
                                      {pg.status}
                                    </span>
                                  </span>
                                  <span className="font-mono font-medium text-text-primary">
                                    R${' '}
                                    {pg.valor.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </TabsContent>

                {/* Agenda do paciente */}
                <TabsContent value="agenda" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary font-medium">
                      Histórico de consultas
                    </span>
                    <button
                      onClick={() => { setConsultaError(null); setIsNovaConsultaOpen(true); }}
                      className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nova Consulta
                    </button>
                  </div>

                  {loadingAgendamentos ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="bg-surface rounded-2xl border border-border/60 p-5 animate-pulse">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-surface-alt rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-20 bg-surface-alt rounded" />
                              <div className="h-4 w-48 bg-surface-alt rounded" />
                              <div className="h-3 w-32 bg-surface-alt rounded" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : agendamentosTabData?.length === 0 ? (
                    <div className="bg-surface rounded-2xl border border-border shadow-sm p-10 text-center">
                      <Calendar className="w-12 h-12 text-teal/20 mx-auto mb-4" />
                      <h3 className="font-heading text-2xl text-text-primary mb-2">Nenhuma consulta</h3>
                      <p className="text-text-secondary text-sm">Nenhuma consulta registrada para este paciente ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agendamentosTabData?.map((ag) => {
                        const statusInfo = STATUS_AGENDA_MAP[ag.status] ?? { label: ag.status, cls: 'bg-surface-alt text-text-secondary' };
                        const isUpcoming = new Date(ag.data_hora) > new Date();
                        return (
                          <div
                            key={ag.id}
                            className="bg-surface rounded-2xl border border-border/60 shadow-sm p-5 flex items-start gap-4"
                          >
                            <div className="w-12 h-12 bg-surface-alt rounded-xl flex flex-col items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-teal uppercase">
                                {format(parseISO(ag.data_hora), 'MMM', { locale: ptBR })}
                              </span>
                              <span className="text-base font-bold text-text-primary leading-none">
                                {format(parseISO(ag.data_hora), 'dd')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${statusInfo.cls}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <div className="font-medium text-sm text-text-primary">
                                {format(parseISO(ag.data_hora), "EEEE, 'às' HH:mm", { locale: ptBR })}
                              </div>
                              {ag.observacoes && (
                                <div className="text-xs text-text-secondary mt-0.5 truncate">{ag.observacoes}</div>
                              )}
                              {ag.dentista && (
                                <div className="text-xs text-teal mt-0.5 font-medium">{ag.dentista.nome}</div>
                              )}
                            </div>
                            {canWriteClinical && isUpcoming && !['cancelled', 'no_show', 'completed'].includes(ag.status) && (
                              <button
                                onClick={() => router.push(`/consulta/${ag.id}`)}
                                className="shrink-0 px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-bold hover:bg-teal-lt transition-colors"
                              >
                                Iniciar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Arquivos */}
                <TabsContent value="arquivos" className="mt-0">
                  {mountedTabs.has('arquivos') && (
                    <DocumentosTab patientId={paciente.id} clinicaId={clinicaId} />
                  )}
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </motion.div>
      </div>

      <EditarPacienteModal
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setEditNome(paciente.nome);
            setEditTelefone(paciente.telefone ?? '');
            setEditEmail(paciente.email ?? '');
            setEditEndereco(paciente.endereco ?? '');
            setEditError(null);
          }
        }}
        editNome={editNome}
        setEditNome={setEditNome}
        editTelefone={editTelefone}
        setEditTelefone={setEditTelefone}
        editEmail={editEmail}
        setEditEmail={setEditEmail}
        editEndereco={editEndereco}
        setEditEndereco={setEditEndereco}
        editError={editError}
        isPending={isPending}
        onSave={handleSaveEdit}
      />

      <DetalheOrcamentoModal
        detalheOrc={detalheOrc}
        detalheOrcId={detalheOrcId}
        onClose={() => {
          setDetalheOrcId(null);
          setPagError(null);
          setOrcEditMode(false);
          setOrcEditError(null);
          setPagForm({ valor: '', formaPagamento: 'pix', data: new Date().toISOString().split('T')[0] });
        }}
        pagForm={pagForm}
        setPagForm={setPagForm}
        pagSaving={pagSaving}
        pagError={pagError}
        orcEditMode={orcEditMode}
        setOrcEditMode={setOrcEditMode}
        orcEditItens={orcEditItens}
        setOrcEditItens={setOrcEditItens}
        orcEditSaving={orcEditSaving}
        orcEditError={orcEditError}
        setOrcEditError={setOrcEditError}
        onOpenEditOrc={handleOpenEditOrc}
        onSalvarEdicaoOrc={handleSalvarEdicaoOrc}
        onStatusChange={handleStatusChange}
        onRegistrarPagamento={handleRegistrarPagamento}
        onDeleteClick={setConfirmDeleteOrcId}
      />

      <ConfirmarDeleteOrcModal
        confirmDeleteOrcId={confirmDeleteOrcId}
        onOpenChange={(open) => { if (!open) { setConfirmDeleteOrcId(null); setOrcDeleteError(null); } }}
        orcDeleteSaving={orcDeleteSaving}
        orcDeleteError={orcDeleteError}
        onExcluir={handleExcluirOrc}
      />

      <NovaConsultaModal
        open={isNovaConsultaOpen}
        onOpenChange={(open) => {
          setIsNovaConsultaOpen(open);
          if (!open) setConsultaError(null);
        }}
        pacienteNome={displayNome}
        consultaForm={consultaForm}
        setConsultaForm={setConsultaForm}
        consultaError={consultaError}
        consultaSaving={consultaSaving}
        onNovaConsulta={handleNovaConsulta}
      />

      <NovoOrcamentoModal
        open={isNovoOrcOpen}
        onOpenChange={(open) => {
          setIsNovoOrcOpen(open);
          if (!open) { setEtapaNovoOrc('itens'); setFichasParaOrc([]); setOrcError(null); setNovoOrcValorFinal(null); }
        }}
        etapaNovoOrc={etapaNovoOrc}
        setEtapaNovoOrc={setEtapaNovoOrc}
        fichasParaOrc={fichasParaOrc}
        orcError={orcError}
        novoOrcItens={novoOrcItens}
        setNovoOrcItens={setNovoOrcItens}
        procedimentosClinica={procedimentosClinica}
        novoOrcSubtotal={novoOrcSubtotal}
        novoOrcTotal={novoOrcTotal}
        novoOrcValorFinal={novoOrcValorFinal}
        setNovoOrcValorFinal={setNovoOrcValorFinal}
        orcSaving={orcSaving}
        onCriarOrcamento={handleCriarOrcamento}
        onSelecionarFicha={selecionarFichaParaOrc}
      />
    </div>
  );
}
