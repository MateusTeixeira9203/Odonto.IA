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
  AlertCircle,
  FileText,
  FilePlus,
  FileSignature,
  Loader2,
  Activity,
  Bell,
  Paperclip,
  Trash2,
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
import { PageContainer } from '@/components/layout/page-container';
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
const ProntuarioTab   = dynamic(() => import('@/components/pacientes/ProntuarioTab').then(m => m.ProntuarioTab),     { ssr: false, loading: () => <TabSkeleton /> });
import { createClient } from '@/lib/supabase/client';
import { saveRecentPatient } from '@/components/command-palette/command-palette';
import { marcarFollowUp, limparFollowUp, snoozeFollowUp } from '../../followup-actions';
import { atualizarPaciente } from '../actions';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import {
  registrarPagamento,
  editarPagamento,
  marcarPagamentoPago,
  excluirPagamento,
  estornarPagamento,
  editarOrcamento,
  excluirOrcamento,
  gerarParcelas,
  reorganizarParcelas,
  atualizarMostrarValorPorItem,
  // R-114 — substituem atualizarStatusOrcamento nesta tela (o dentista/perfil do paciente).
  alternarAprovacaoItem,
  aprovarTodosItens,
  type FormaPagamento,
} from '@/app/dashboard/orcamentos/actions';
import { deriveEstadoOrcamento, rotuloEstado } from '@/lib/orcamentos/estado';
import type { Paciente } from '@/types/database';
import type { TimelineEvent } from '@/server/patients/get-visible-timeline-events';
import { addMonths, format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarDataFicha } from '@/lib/format-data-ficha';
import { toast } from 'sonner';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import type { OrcamentoComItens, OrcamentoItem, Pagamento, ProcedimentoClinica, OrcEditItem } from './types';
import { EditarPacienteModal } from './modals/editar-paciente-modal';
import { DetalheOrcamentoModal } from './modals/detalhe-orcamento-modal';
import { ConfirmarDeleteOrcModal } from './modals/confirmar-delete-orc-modal';
import { ExcluirPacienteModal } from './modals/excluir-paciente-modal';
import { excluirPaciente } from '@/server/patients/excluir-paciente';
import { MarcarRetornoModal } from '@/components/pacientes/marcar-retorno-modal';
import { useMarcarRetorno } from '@/hooks/use-marcar-retorno';
import { formatHora as formatHoraRetorno } from '@/lib/agenda/disponibilidade';
import { EmitirDocumentoModal } from '@/components/pacientes/EmitirDocumentoModal';
import { EmitirAceiteModal } from '@/components/pacientes/EmitirAceiteModal';
import { NovoOrcamentoModal } from './modals/novo-orcamento-modal';
import { useOrcamentoModal } from './use-orcamento-modal';
import { ApresentarPaciente } from '@/components/pacientes/ApresentarPaciente';

import type { FichaRecente } from '@/server/patients/get-patient-workspace-data';
import type { ProntuarioLongitudinalData } from '@/server/patients/get-prontuario-longitudinal';

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
  orcamentosAviso?: string | null;
  clinicaId: string;
  dentistaId: string;
  role: DentistaRole;
  plano: PlanoId;
  fichasRecentesSSR?: FichaRecente[];
  timeline?: TimelineEvent[];
  prontuario?: ProntuarioLongitudinalData;
}

export function PacienteDetailClient({
  paciente,
  agendamentoProximo,
  orcamentos,
  orcamentosAviso = null,
  clinicaId,
  dentistaId,
  role,
  plano,
  fichasRecentesSSR,
  timeline = [],
  prontuario,
}: PacienteDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canViewClinical  = role === 'admin' || role === 'dentista';
  const canWriteClinical = role === 'admin' || role === 'dentista';

  const [activeTab, setActiveTab] = useState('ficha-clinica');
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(['ficha-clinica']));
  const [fichaInicialId, setFichaInicialId] = useState<string | null>(null);

  // Lê ?tab= da URL para navegar direto à aba correta (ex: vindo do AttentionPanel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setFichaInicialId(params.get('ficha'));
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
  const [editDentistaId, setEditDentistaId] = useState(paciente.dentista_id ?? '');
  // R-41 — fecha a lacuna que o cadastro rápido (nome+telefone só) deixa aberta.
  const [editCpf, setEditCpf] = useState(paciente.cpf ?? '');
  const [editDataNascimento, setEditDataNascimento] = useState(paciente.data_nascimento ?? '');
  const [editResponsavelNome, setEditResponsavelNome] = useState(paciente.responsavel_nome ?? '');
  const [editResponsavelTelefone, setEditResponsavelTelefone] = useState(paciente.responsavel_telefone ?? '');
  const [editResponsavelParentesco, setEditResponsavelParentesco] = useState(paciente.responsavel_parentesco ?? '');
  const [editError, setEditError] = useState<string | null>(null);

  // Encaminhamento (hierarquia §3) — só a secretária reatribui o dentista responsável.
  const [dentistasClinica, setDentistasClinica] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    if (role !== 'secretaria') return;
    const supabase = createClient();
    void supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' entrar aqui.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        setDentistasClinica(data ?? []);
      });
  }, [role, clinicaId]);

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
  const [procedimentosClinica, setProcedimentosClinica] = useState<ProcedimentoClinica[]>([]);
  const [erroCatalogoProcedimentos, setErroCatalogoProcedimentos] = useState<string | null>(null);
  const [pagForm, setPagForm] = useState({
    valor: '',
    formaPagamento: 'dinheiro' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
    dataVencimento: '',
  });
  const [parcelasMode, setParcelasMode] = useState(false);
  const [parcelasForm, setParcelasForm] = useState({ numero: '3', primeiroVencimento: '' });
  const [parcelasSaving, setParcelasSaving] = useState(false);
  const [parcelasError, setParcelasError] = useState<string | null>(null);
  const [pagSaving, setPagSaving] = useState(false);
  const [pagError, setPagError] = useState<string | null>(null);

  // R-28 — fechar uma parcela pendente específica via a aba Registrar pagamento
  // (em vez de abrir um pagamento novo e duplicar o recebimento).
  const [closingPagamentoId, setClosingPagamentoId] = useState<string | null>(null);

  // Edição / exclusão de pagamento já registrado
  const [editingPagId, setEditingPagId] = useState<string | null>(null);
  const [editPagForm, setEditPagForm] = useState({
    valor: '',
    formaPagamento: 'pix' as FormaPagamento,
    data: new Date().toISOString().split('T')[0],
  });
  const [editPagSaving, setEditPagSaving] = useState(false);
  const [editPagError, setEditPagError] = useState<string | null>(null);
  const [confirmDeletePagId, setConfirmDeletePagId] = useState<string | null>(null);
  const [pagDeleteSaving, setPagDeleteSaving] = useState(false);

  // R-130 — valor negociado é uma edição financeira independente dos procedimentos.
  const [editValorAcordadoAberto, setEditValorAcordadoAberto] = useState(false);
  const [valorAcordadoTexto, setValorAcordadoTexto] = useState('');
  const [valorAcordadoSaving, setValorAcordadoSaving] = useState(false);
  const [valorAcordadoError, setValorAcordadoError] = useState<string | null>(null);

  // Edição de orçamento
  const [orcEditMode, setOrcEditMode] = useState(false);
  const [orcEditItens, setOrcEditItens] = useState<OrcEditItem[]>([]);
  const [orcEditSaving, setOrcEditSaving] = useState(false);
  const [orcEditError, setOrcEditError] = useState<string | null>(null);

  // Exclusão de orçamento
  const [confirmDeleteOrcId, setConfirmDeleteOrcId] = useState<string | null>(null);
  const [orcDeleteSaving, setOrcDeleteSaving] = useState(false);
  const [orcDeleteError, setOrcDeleteError] = useState<string | null>(null);

  // Excluir paciente (decisão dele 07/08) — permanente, cascateia sobre tudo do paciente.
  const [excluirPacienteAberto, setExcluirPacienteAberto] = useState(false);
  const [excluindoPaciente, setExcluindoPaciente] = useState(false);
  const [excluirPacienteError, setExcluirPacienteError] = useState<string | null>(null);

  // Contato dropdown (⋯)

  // Marcar retorno
  const [isMarcarRetornoOpen, setIsMarcarRetornoOpen] = useState(false);
  const [isEmitirOpen, setIsEmitirOpen] = useState(false);
  const [isEmitirAceiteOpen, setIsEmitirAceiteOpen] = useState(false);
  const [retornoDentistaAlvoId, setRetornoDentistaAlvoId] = useState<string | null>(
    role === 'secretaria' ? null : dentistaId,
  );
  const retorno = useMarcarRetorno({
    pacienteId: paciente.id,
    onConcluido: ({ data, minutoDoDia, comPedido }) => {
      const quando = `${format(parseISO(data), 'dd/MM/yyyy')} às ${formatHoraRetorno(minutoDoDia)}`;
      setIsMarcarRetornoOpen(false);
      if (role === 'secretaria') setRetornoDentistaAlvoId(null);
      setAgendamentosTabData(null);
      toast.success(comPedido ? `Retorno e pedido enviados para ${quando}` : `Retorno marcado para ${quando}`, {
        action: data !== format(new Date(), 'yyyy-MM-dd')
          ? { label: 'Ver na agenda', onClick: () => router.push(`/dashboard/agendamentos?v=dia&d=${data}`) }
          : undefined,
      });
    },
  });

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
      // dentista:dentistas!dentista_id — agendamentos tem 2 FKs pra dentistas (dentista_id e
      // created_by); sem desambiguar, o embed dá erro (PGRST201) e a aba fica sempre vazia.
      .select('id, data_hora, status, observacoes, duracao_minutos, dentista:dentistas!dentista_id(nome)')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicaId)
      .order('data_hora', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('[paciente] fetch agenda:', error.message);
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

  // R-114 — estado por orçamento, derivado (não lido de `.status`, que fica inerte pra
  // orçamento tocado por esta tela). Mesma fórmula de `lib/orcamentos/estado.ts`.
  const estadoPorOrc = useMemo(
    () => new Map(orcamentosState.map((o) => [o.id, deriveEstadoOrcamento({
      valorAcordado: o.valor_acordado,
      itens: o.itens.map((i) => ({ precoTotal: i.preco_total, aprovado: i.aprovado })),
      pagamentos: o.pagamentos.map((p) => ({ valor: p.valor, status: p.status })),
    })])),
    [orcamentosState]
  );

  const resumoFinanceiro = useMemo(() => {
    const allPagamentos = orcamentosState.flatMap(o => o.pagamentos);
    return {
      // "Aprovado" na visão de resumo = o que o paciente aceitou em orçamentos com algo
      // aceito (aceito ou quitado) — soma o DEVIDO, não o total da proposta inteira.
      totalAprovado: orcamentosState
        .filter(o => estadoPorOrc.get(o.id)?.estado !== 'proposto')
        .reduce((s, o) => s + (estadoPorOrc.get(o.id)?.valorDevido ?? 0), 0),
      totalPago: allPagamentos
        .filter(p => p.status === 'pago')
        .reduce((s, p) => s + p.valor, 0),
      totalPendente: allPagamentos
        .filter(p => p.status === 'pendente')
        .reduce((s, p) => s + p.valor, 0),
      temHistorico: allPagamentos.length > 0,
    };
  }, [orcamentosState, estadoPorOrc]);

  const orcamentosAprovados = useMemo(
    () => orcamentosState.filter(o => estadoPorOrc.get(o.id)?.estado !== 'proposto'),
    [orcamentosState, estadoPorOrc]
  );
  const pendenciasAtivas = useMemo(
    () => pendencias.filter(p => !pendenciasConcluidas.has(p.globalKey)),
    [pendencias, pendenciasConcluidas]
  );

  // Procedimentos clínicos dos orçamentos aprovados — headline da Col 2
  const procedimentosPrincipais = useMemo(() => {
    // R-114 (I2) — só o que o paciente de fato aceitou. Item ainda não aprovado é proposta,
    // não pertence ao "que ele já fechou".
    const itens = orcamentosAprovados.flatMap(o => (o.itens ?? []).filter((i) => i.aprovado));
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
        // R-41 — fecha a lacuna que o cadastro rápido deixa aberta.
        cpf: editCpf || null,
        data_nascimento: editDataNascimento || null,
        responsavel_nome: editResponsavelNome || null,
        responsavel_telefone: editResponsavelTelefone || null,
        responsavel_parentesco: editResponsavelParentesco || null,
        ...(role === 'secretaria' ? { dentista_id: editDentistaId || null } : {}),
      });
      if (result.error) {
        setEditError(result.error);
      } else {
        setDisplayNome(editNome);
        setDisplayTelefone(editTelefone || null);
        setDisplayEmail(editEmail || null);
        setDisplayEndereco(editEndereco || null);
        setIsEditModalOpen(false);
        // CPF/nascimento/responsável não têm display state próprio — busca do servidor
        // de novo pra idade/CPF no card do perfil refletirem o que acabou de ser salvo.
        router.refresh();
      }
    });
  };

  // R-46h — extraído pra use-orcamento-modal.ts (compartilhado com o Meu dia). onOrcamentoCriado
  // é o único acoplamento de volta: só esta tela mantém uma lista local de orçamentos.
  const orcamentoModal = useOrcamentoModal({
    pacienteId: paciente.id,
    clinicaId,
    meuDentistaId: dentistaId,
    procedimentosClinica,
    erroCatalogo: erroCatalogoProcedimentos,
    isSecretaria: role === 'secretaria',
    dentistasClinica,
    onOrcamentoCriado: (novoOrc) => setOrcamentosState((prev) => [novoOrc, ...prev]),
    onContinuarConfiguracao: (orcamentoId) => setDetalheOrcId(orcamentoId),
  });

  // Catálogo de procedimentos é privado por dentista. Pra secretária, o dono relevante
  // é o dentista-alvo selecionado no modal de orçamento, não o perfil dela (ela nunca
  // é dona de procedimentos) — reconsulta quando a seleção muda.
  const procedimentosDonoId = role === 'secretaria' ? orcamentoModal.modalProps.dentistaAlvoId : dentistaId;
  useEffect(() => {
    if (!procedimentosDonoId) return;
    const supabase = createClient();
    void supabase
      .from('procedimentos')
      .select('id, nome, preco_padrao')
      .eq('clinica_id', clinicaId)
      .eq('dentista_id', procedimentosDonoId)
      .eq('ativo', true)
      .order('nome')
      .then(({ data, error }) => {
        if (error) {
          setProcedimentosClinica([]);
          setErroCatalogoProcedimentos('Não foi possível carregar o catálogo de procedimentos. Recarregue a página antes de criar o orçamento.');
          return;
        }
        setProcedimentosClinica(data ?? []);
        setErroCatalogoProcedimentos(null);
      });
  }, [clinicaId, procedimentosDonoId]);

  // Busca fichas recentes e pendências ao montar.
  useEffect(() => {
    const supabase = createClient();
    if (!canViewClinical) return;

    // fichasRecentes já foram carregadas no servidor — evita roundtrip desnecessário
    if (fichasRecentesSSR === undefined) {
      void supabase
        .from('fichas')
        .select('id, created_at, data_atendimento, queixa_principal, anotacoes, dentista:dentistas(nome)')
        .eq('paciente_id', paciente.id)
        .eq('clinica_id', clinicaId)
        .order('data_atendimento', { ascending: false })
        .limit(5)
        .then(({ data }) => setFichasRecentes((data as unknown as FichaRecente[]) ?? []));
    }

    void supabase
      .from('fichas')
      .select('id, dentes_afetados, dentes_observacoes, procedimentos_concluidos')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicaId)
      .order('data_atendimento', { ascending: false })
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
  }, [clinicaId, paciente.id, dentistaId]);

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

  // R-114 — o paciente aceitou (ou desmarcou) UM procedimento. Estado deriva sozinho depois.
  const handleAlternarAprovacaoItem = useCallback(async (itemId: string, aprovado: boolean) => {
    // Otimista: a caixa responde na hora, sem esperar o servidor (mesma UX de um checkbox).
    setOrcamentosState((prev) =>
      prev.map((o) => ({
        ...o,
        itens: o.itens.map((i) => (i.id === itemId ? { ...i, aprovado } : i)),
      }))
    );
    const result = await alternarAprovacaoItem(itemId, aprovado);
    if (result.error) {
      // Desfaz o otimista — a trava da I9 (item já pago) só é conhecida no servidor.
      setOrcamentosState((prev) =>
        prev.map((o) => ({
          ...o,
          itens: o.itens.map((i) => (i.id === itemId ? { ...i, aprovado: !aprovado } : i)),
        }))
      );
      toast.error(result.error);
    } else {
      router.refresh();
    }
  }, [router]);

  // R-114 — atalho de 1 clique (pedido dele, 16/08): aprova todos os itens ainda não
  // aprovados de um orçamento, num UPDATE só.
  const handleAprovarTodosItens = useCallback(async (orcId: string) => {
    setOrcamentosState((prev) =>
      prev.map((o) => (o.id === orcId ? { ...o, itens: o.itens.map((i) => ({ ...i, aprovado: true })) } : o))
    );
    const result = await aprovarTodosItens(orcId);
    if (result.error) {
      toast.error(result.error);
      router.refresh(); // estado local pode ter divergido do servidor — busca de novo
    } else {
      router.refresh();
    }
  }, [router]);

  const handleToggleMostrarValorPorItem = useCallback(async (orcId: string, mostrar: boolean) => {
    try {
      const result = await atualizarMostrarValorPorItem(orcId, mostrar);
      if (!result.error) {
        setOrcamentosState((prev) =>
          prev.map((o) => (o.id === orcId ? { ...o, mostrar_valor_por_item: mostrar } : o))
        );
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error('[paciente] handleToggleMostrarValorPorItem:', err);
      toast.error('Não foi possível atualizar. Tente novamente.');
    }
  }, []);

  const handleRegistrarPagamento = async () => {
    if (!detalheOrcId || !detalheOrc) return;
    const valor = parseValorBR(pagForm.valor);
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
      dentistaId: detalheOrc?.dentista_id ?? undefined,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      setPagForm({
        valor: '',
        formaPagamento: 'dinheiro',
        data: new Date().toISOString().split('T')[0],
        dataVencimento: '',
      });
      router.refresh();
    }
    setPagSaving(false);
  };

  const handleIniciarFechamentoPagamento = (pg: Pagamento) => {
    setClosingPagamentoId(pg.id);
    setParcelasMode(false);
    setPagForm({
      valor: formatValorBR(pg.valor),
      formaPagamento: 'dinheiro',
      data: new Date().toISOString().split('T')[0],
      dataVencimento: '',
    });
    setPagError(null);
  };

  const handleCancelarFechamentoPagamento = () => {
    setClosingPagamentoId(null);
    setPagForm({
      valor: '',
      formaPagamento: 'dinheiro',
      data: new Date().toISOString().split('T')[0],
      dataVencimento: '',
    });
    setPagError(null);
  };

  const handleFecharPagamento = async () => {
    if (!closingPagamentoId) return;
    setPagError(null);
    setPagSaving(true);

    const result = await marcarPagamentoPago(closingPagamentoId, {
      formaPagamento: pagForm.formaPagamento,
      data: pagForm.data,
    });

    if (result.error) {
      setPagError(result.error);
    } else {
      const fechadoId = closingPagamentoId;
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? {
                ...o,
                pagamentos: o.pagamentos.map((p) =>
                  p.id === fechadoId
                    ? { ...p, status: 'pago', forma_pagamento: pagForm.formaPagamento, data_pagamento: pagForm.data }
                    : p
                ),
              }
            : o
        )
      );
      handleCancelarFechamentoPagamento();
      toast.success('Parcela marcada como paga.');
      // marcado_por e autoAprovado do orçamento são derivados no servidor —
      // busca de novo em vez de aproximar no client, mesma disciplina do handleStatusChange.
      router.refresh();
    }
    setPagSaving(false);
  };

  const handleGerarParcelas = async () => {
    if (!detalheOrcId || !detalheOrc) return;
    const numero = parseInt(parcelasForm.numero, 10);
    // Aviso local só de UX — quem soma "já pago" de verdade agora é a RPC (server).
    const derivado = detalheOrc
      ? deriveEstadoOrcamento({
          valorAcordado: detalheOrc.valor_acordado,
          itens: detalheOrc.itens.map((item) => ({ precoTotal: item.preco_total, aprovado: item.aprovado })),
          pagamentos: detalheOrc.pagamentos.map((pagamento) => ({ valor: pagamento.valor, status: pagamento.status })),
        })
      : null;
    const saldoAproximado = Math.max(0, (derivado?.valorDevido ?? 0) - (derivado?.valorPago ?? 0));
    if (!numero || numero < 2 || numero > 24) {
      setParcelasError('Informe entre 2 e 24 parcelas.');
      return;
    }
    if (!parcelasForm.primeiroVencimento) {
      setParcelasError('Informe o primeiro vencimento.');
      return;
    }
    if (!saldoAproximado || saldoAproximado <= 0) {
      setParcelasError('Não há saldo restante para parcelar.');
      return;
    }
    setParcelasError(null);
    setParcelasSaving(true);

    const temPrevisaoAtiva = detalheOrc.pagamentos.some((pagamento) => pagamento.status === 'pendente');
    const temPlanoAtivo = Boolean(detalheOrc.plano_forma) || temPrevisaoAtiva;
    const result = temPlanoAtivo
      ? await reorganizarParcelas({
          orcamentoId: detalheOrcId,
          valorAcordado: detalheOrc.valor_acordado ?? (derivado?.valorDevido ?? 0),
          parcelas: Array.from({ length: numero }, (_, indice) => {
            const saldoCentavos = Math.round(saldoAproximado * 100);
            const baseCentavos = Math.floor(saldoCentavos / numero);
            const valorCentavos = indice === numero - 1
              ? saldoCentavos - baseCentavos * (numero - 1)
              : baseCentavos;
            return {
              valor: valorCentavos / 100,
              dataVencimento: format(addMonths(parseISO(parcelasForm.primeiroVencimento), indice), 'yyyy-MM-dd'),
            };
          }),
        })
      : await gerarParcelas({
          orcamentoId: detalheOrcId,
          numeroParcelas: numero,
          primeiroVencimento: parcelasForm.primeiroVencimento,
        });

    if (result.error || !result.parcelas) {
      setParcelasError(result.error ?? 'Não foi possível gerar as parcelas.');
    } else {
      const novasPag: Pagamento[] = result.parcelas.map((p) => ({
        id:              p.id,
        cobranca_id:     null,
        valor:           p.valor,
        status:          'pendente',
        forma_pagamento: null,
        data_pagamento:  null,
        data_vencimento: p.data_vencimento,
        parcela_numero:  p.parcela_numero,
        total_parcelas:  p.total_parcelas,
        marcado_por:     null,
      }));
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? { ...o, plano_forma: 'parcelado', pagamentos: [...o.pagamentos, ...novasPag] }
            : o
        )
      );
      setParcelasMode(false);
      setParcelasForm({ numero: '3', primeiroVencimento: '' });
      toast.success(temPlanoAtivo ? 'Previsão de cobrança reorganizada.' : `${numero} parcelas geradas.`);
      router.refresh();
    }
    setParcelasSaving(false);
  };

  const handleIniciarEdicaoPagamento = (pg: Pagamento) => {
    setConfirmDeletePagId(null);
    setEditingPagId(pg.id);
    setEditPagForm({
      valor: formatValorBR(pg.valor),
      formaPagamento: (pg.forma_pagamento as FormaPagamento) ?? 'pix',
      data: pg.data_pagamento ?? new Date().toISOString().split('T')[0],
    });
    setEditPagError(null);
  };

  const handleSalvarEdicaoPagamento = async () => {
    if (!editingPagId) return;
    const valor = parseValorBR(editPagForm.valor);
    if (!valor || valor <= 0) {
      setEditPagError('Informe um valor válido.');
      return;
    }
    setEditPagError(null);
    setEditPagSaving(true);

    const result = await editarPagamento(editingPagId, {
      valor,
      formaPagamento: editPagForm.formaPagamento,
      data: editPagForm.data,
    });

    if (result.error) {
      setEditPagError(result.error);
    } else {
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? {
                ...o,
                pagamentos: o.pagamentos.map((p) =>
                  p.id === editingPagId
                    ? { ...p, valor, forma_pagamento: editPagForm.formaPagamento, data_pagamento: editPagForm.data }
                    : p
                ),
              }
            : o
        )
      );
      setEditingPagId(null);
      router.refresh();
    }
    setEditPagSaving(false);
  };

  const handleExcluirPagamento = async (pagamentoId: string, motivoEstorno?: string) => {
    const pagamento = detalheOrc?.pagamentos.find((item) => item.id === pagamentoId);
    if (!pagamento) return;
    if (pagamento.status === 'pago') {
      const motivo = motivoEstorno?.trim();
      if (!motivo) return;
      setPagDeleteSaving(true);
      const result = await estornarPagamento(pagamentoId, motivo);
      if (result.error) toast.error(result.error);
      else {
        setConfirmDeletePagId(null);
        toast.success('Recebimento estornado. O saldo foi reaberto.');
        router.refresh();
      }
      setPagDeleteSaving(false);
      return;
    }
    setPagDeleteSaving(true);
    const result = await excluirPagamento(pagamentoId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setOrcamentosState((prev) =>
        prev.map((o) =>
          o.id === detalheOrcId
            ? { ...o, pagamentos: o.pagamentos.filter((p) => p.id !== pagamentoId) }
            : o
        )
      );
      setConfirmDeletePagId(null);
      toast.success('Previsão removida.');
      router.refresh();
    }
    setPagDeleteSaving(false);
  };

  const handleIniciarEdicaoValorAcordado = () => {
    if (!detalheOrc) return;
    setValorAcordadoTexto(formatValorBR(detalheOrc.valor_acordado ?? detalheOrc.total ?? 0));
    setValorAcordadoError(null);
    setEditValorAcordadoAberto(true);
  };

  const handleCancelarEdicaoValorAcordado = () => {
    setEditValorAcordadoAberto(false);
    setValorAcordadoError(null);
  };

  const handleSalvarValorAcordado = async () => {
    if (!detalheOrc) return;
    const valor = parseValorBR(valorAcordadoTexto);
    if (!valor || valor <= 0) {
      setValorAcordadoError('Informe um valor final válido.');
      return;
    }

    setValorAcordadoError(null);
    setValorAcordadoSaving(true);
    const previsoesAtivas = detalheOrc.pagamentos
      .filter((pagamento) => pagamento.status === 'pendente')
      .sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0));
    const resultadoDerivado = deriveEstadoOrcamento({
      valorAcordado: detalheOrc.valor_acordado,
      itens: detalheOrc.itens.map((item) => ({ precoTotal: item.preco_total, aprovado: item.aprovado })),
      pagamentos: detalheOrc.pagamentos.map((pagamento) => ({ valor: pagamento.valor, status: pagamento.status })),
    });
    const saldoNovoCentavos = Math.round((valor - resultadoDerivado.valorPago) * 100);
    if (saldoNovoCentavos < 0) {
      setValorAcordadoError('O valor final não pode ser menor que o total já recebido.');
      setValorAcordadoSaving(false);
      return;
    }
    const result = await reorganizarParcelas({
          orcamentoId: detalheOrc.id,
          valorAcordado: valor,
          parcelas: saldoNovoCentavos === 0 ? [] : previsoesAtivas.map((previsao, indice) => {
            const baseCentavos = Math.floor(saldoNovoCentavos / previsoesAtivas.length);
            const valorCentavos = indice === previsoesAtivas.length - 1
              ? saldoNovoCentavos - baseCentavos * (previsoesAtivas.length - 1)
              : baseCentavos;
            return {
              valor: valorCentavos / 100,
              dataVencimento: previsao.data_vencimento ?? new Date().toISOString().split('T')[0],
            };
          }),
        });
    if (result.error) {
      setValorAcordadoError(result.error);
    } else {
      setOrcamentosState((prev) => prev.map((orc) =>
        orc.id === detalheOrc.id ? { ...orc, valor_acordado: valor } : orc,
      ));
      setEditValorAcordadoAberto(false);
      toast.success('Valor final atualizado.');
      router.refresh();
    }
    setValorAcordadoSaving(false);
  };

  const handleOpenEditOrc = () => {
    if (!detalheOrc) return;
    setOrcEditItens(
      detalheOrc.itens.map((item) => ({
        id: item.id,
        descricao: item.descricao ?? '',
        quantidade: item.quantidade,
        preco_unitario: formatValorBR(
          item.quantidade > 0 ? (item.preco_total ?? 0) / item.quantidade : (item.preco_total ?? 0)
        ),
      }))
    );
    setOrcEditError(null);
    setOrcEditMode(true);
  };

  const handleSalvarEdicaoOrc = async () => {
    if (!detalheOrc) return;
    const itensValidos = orcEditItens.filter((i) => i.descricao.trim() && parseValorBR(i.preco_unitario) > 0);
    if (itensValidos.length === 0) {
      setOrcEditError('Adicione ao menos um procedimento com descrição e valor.');
      return;
    }
    setOrcEditSaving(true);
    const result = await editarOrcamento(detalheOrc.id, itensValidos.map(i => ({ ...i, preco_unitario: parseValorBR(i.preco_unitario) })), detalheOrc.desconto ?? 0);
    if (result.error) {
      setOrcEditError(result.error);
    } else {
      const novoTotal = itensValidos.reduce((sum, i) => sum + i.quantidade * parseValorBR(i.preco_unitario), 0);
      const novosItens: OrcamentoItem[] = itensValidos.map((i) => ({
        id: i.id ?? crypto.randomUUID(),
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_total: i.quantidade * parseValorBR(i.preco_unitario),
        // R-114 (I5) — o servidor só deixou passar porque nenhum item era aprovado antes;
        // a lista reescrita nasce toda não-aprovada, coerente com o que ele acabou de ver.
        aprovado: false,
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

  const handleRetornoDentistaAlvoChange = (id: string) => {
    setRetornoDentistaAlvoId(id);
    retorno.setForm((form) => ({ ...form, data: null, minutoDoDia: null }));
    retorno.limparErro();
  };

  const handleExcluirPaciente = async () => {
    setExcluirPacienteError(null);
    setExcluindoPaciente(true);
    try {
      const result = await excluirPaciente(paciente.id, displayNome);
      if (!result.ok) {
        setExcluirPacienteError(result.error ?? 'Erro ao excluir paciente.');
        return;
      }
      toast.success(`${displayNome} foi excluído.`);
      router.push('/dashboard/pacientes');
    } finally {
      setExcluindoPaciente(false);
    }
  };

  return (
    <PageContainer variant="wide">

      {/* ── NAV + PATIENT CARD ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 space-y-3"
      >
        {/* Breadcrumb nav */}
        {/* R-111 — quebra linha no celular. São 7 ações à direita (editar, exportar, excluir,
            emitir, Apresentar, Marcar retorno) contra o "Pacientes" à esquerda: 438px numa faixa
            de 343px, 95px cortados. O rótulo do "Marcar retorno" já era `hidden sm:inline`, o que
            ajudava mas não bastava. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => router.push('/dashboard/pacientes')}
            className="min-h-11 flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Pacientes
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="h-11 w-11 rounded-xl border border-border/60 text-text-secondary hover:text-teal hover:border-teal/40 bg-surface transition-colors flex items-center justify-center"
              title="Editar paciente"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.open(`/api/pacientes/${paciente.id}/prontuario`, '_blank')}
              className="h-11 w-11 rounded-xl border border-border/60 text-text-secondary hover:text-text-primary bg-surface transition-colors flex items-center justify-center"
              title="Exportar prontuário"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border/60 mx-0.5" />
            {/* Excluir paciente — sem gate de role de propósito (secretária é quem usa,
                decisão dele 07/08). Confirmação com nome digitado mora no modal. */}
            <button
              onClick={() => setExcluirPacienteAberto(true)}
              className="h-11 w-11 rounded-xl border border-border/60 text-text-secondary hover:text-coral hover:border-coral/40 bg-surface transition-colors flex items-center justify-center"
              title="Excluir paciente"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {canWriteClinical && (
              <button
                onClick={() => setIsEmitirAceiteOpen(true)}
                className="h-11 w-11 rounded-xl border border-border/60 text-text-secondary hover:text-teal hover:border-teal/40 bg-surface transition-colors flex items-center justify-center"
                title="Gerar TCLE do paciente"
              >
                <FileSignature className="w-4 h-4" />
              </button>
            )}
            {canWriteClinical && (
              <button
                onClick={() => setIsEmitirOpen(true)}
                className="h-11 w-11 rounded-xl border border-border/60 text-text-secondary hover:text-teal hover:border-teal/40 bg-surface transition-colors flex items-center justify-center"
                title="Emitir documento (receita, atestado, pedido de exame)"
              >
                <FilePlus className="w-4 h-4" />
              </button>
            )}
            {/* Apresentar — R-98a: não depende mais de ter ficha. Antes exigia
                fichasRecentes.length > 0 (a suposição de que Apresentar só existe em
                cima de UMA ficha específica) — com bloco imagem/odontograma/modelo
                reutilizável isso deixou de ser verdade: dá pra montar a apresentação
                antes de qualquer ficha existir. Com ficha, mantém o picker (contexto
                certo pro orçamento/procedimentos); sem ficha, abre direto. */}
            {canViewClinical && (
              <ApresentarPaciente
                patientId={paciente.id}
                clinicaId={clinicaId}
                patientName={displayNome}
                dentistaId={dentistaId}
                mode={fichasRecentes.length > 0 ? 'picker' : 'direct'}
                fichas={fichasRecentes}
                variant="header"
                glow={paciente.id === 'demo'}
              />
            )}
            <button
              onClick={() => { retorno.limparErro(); setIsMarcarRetornoOpen(true); }}
              className="min-h-11 shrink-0 flex items-center gap-2 px-4 py-2.5 bg-teal text-white rounded-xl text-xs font-bold hover:bg-teal-lt transition-colors shadow-md"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar retorno</span>
            </button>
          </div>
        </div>

        {/* Patient info card */}
        <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-teal flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">
              {iniciais}
            </div>

            {/* Info block */}
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-2xl text-text-primary leading-none">{displayNome}</h1>
              <p className="text-text-secondary text-sm mt-1 flex items-center gap-2 flex-wrap">
                {idade !== null && <span>{idade} anos</span>}
                {dataNascimento && <span className="text-text-secondary/60">· {dataNascimento}</span>}
                <span className="text-text-secondary/60">· Paciente desde {membroDesde}</span>
              </p>

              {/* Contact row */}
              {(displayTelefone || displayEmail || endereco) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                  {displayTelefone && (
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Phone className="w-3.5 h-3.5 text-teal shrink-0" />
                      {displayTelefone}
                    </div>
                  )}
                  {displayEmail && (
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <Mail className="w-3.5 h-3.5 text-teal shrink-0" />
                      <span className="truncate max-w-[220px]">{displayEmail}</span>
                    </div>
                  )}
                  {endereco && (
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 text-teal shrink-0" />
                      <span>{endereco}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Observações / Alertas */}
              {paciente.observacoes && (
                <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-500/6 border border-amber-500/20 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Observações</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{paciente.observacoes}</p>
                  </div>
                </div>
              )}
            </div>
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
            <TabsList className="flex flex-wrap gap-2 mb-6 h-auto bg-transparent p-0">
              {(
                [
                  ...(canViewClinical  ? [['ficha-clinica','Prontuário','tab-fichas',       FileText]] : []),
                  ['orcamentos',    'Orçamentos',   'tab-orcamento',    CreditCard],
                  ['arquivos',      'Arquivos',     'tab-documentos',   Paperclip],
                  ['agenda',        'Agenda',        undefined,          Calendar],
                ] as [string, string, string | undefined, React.ComponentType<{ className?: string }>][]
              ).map(([val, label, tourId, Icon]) => (
                <TabsTrigger
                  key={val}
                  id={tourId}
                  value={val}
                  className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold border transition-all duration-300 border-border/60 bg-surface text-text-secondary hover:text-text-primary hover:border-teal/30 data-[active]:bg-teal data-[active]:text-white data-[active]:border-teal data-[active]:shadow-[0_4px_14px_rgba(47,156,133,0.3)]${tourId && highlightedTab === tourId ? ' ring-2 ring-teal/60' : ''}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
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
                                    {formatarDataFicha(ficha.data_atendimento, ficha.created_at)}
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
                      <ProntuarioTab
                        patientId={paciente.id}
                        dentistaId={dentistaId}
                        patientName={displayNome}
                        canWrite={canWriteClinical}
                        dados={prontuario ?? { atendimentos: [], fichas: [], boca: [], profissionaisClinicos: [], errosParciais: [] }}
                        fichaInicialId={fichaInicialId}
                        onGerarOrcamento={(fichaId) => void orcamentoModal.abrirOrcamentoParaFicha(fichaId)}
                        onAbrirArquivos={() => handleTabChange('arquivos')}
                        // R-107b — catálogo pro match local da busca livre do painel do dente.
                        // `categoria` não vem da query (`ProcedimentoClinica` é o contrato do
                        // fluxo de orçamento e tem outros produtores) e não é usada pelo
                        // matcher, que só lê `nome` — preenchida vazia em vez de alargar um
                        // type compartilhado por um campo que ninguém consome aqui.
                        catalogoProcedimentos={procedimentosClinica.map((p) => ({ ...p, categoria: '' }))}
                      />
                    )}
                  </TabsContent>
                )}

                {/* Orçamentos */}
                <TabsContent value="orcamentos" className="mt-0 space-y-4">
                  {orcamentosAviso && (
                    <div role="status" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-ink">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{orcamentosAviso}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary font-medium">
                      {orcamentosState.length} orçamento{orcamentosState.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setActiveTab('ficha-clinica')}
                      className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Gerar pela ficha
                    </button>
                  </div>

                  {orcamentosState.length === 0 ? (
                    <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 text-center">
                      <CreditCard className="w-12 h-12 text-teal/20 mx-auto mb-4" />
                      <h3 className="font-heading text-2xl text-text-primary mb-2">
                        Nenhum orçamento
                      </h3>
                      <p className="text-text-secondary text-sm max-w-md mx-auto">
                        Nenhum orçamento ainda. Gere a proposta a partir de uma ficha clínica.
                      </p>
                    </div>
                  ) : (
                    orcamentosState.map((orc) => {
                      const derivado = estadoPorOrc.get(orc.id) ?? deriveEstadoOrcamento({
                        valorAcordado: orc.valor_acordado,
                        itens: orc.itens.map((i) => ({ precoTotal: i.preco_total, aprovado: i.aprovado })),
                        pagamentos: orc.pagamentos.map((p) => ({ valor: p.valor, status: p.status })),
                      });
                      const StatusIcon = derivado.estado === 'quitado' ? CheckCircle2 : AlertCircle;
                      const estadoCls = derivado.estado === 'quitado'
                        ? 'bg-teal-ink text-white'
                        : derivado.estado === 'aceito'
                          ? 'bg-warning-pale text-warning-ink'
                          : 'bg-surface-alt text-text-secondary';
                      return (
                        <div
                          key={orc.id}
                          onClick={() => setDetalheOrcId(orc.id)}
                          className={`rounded-2xl border shadow-sm p-6 cursor-pointer transition-colors ${
                            derivado.estado === 'proposto'
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
                                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${estadoCls}`}
                                  >
                                    {rotuloEstado(derivado)}
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
                      onClick={() => { retorno.limparErro(); setIsMarcarRetornoOpen(true); }}
                      className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Marcar retorno
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
                                onClick={() => router.push(`/dashboard/meu-dia?ag=${ag.id}`)}
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
                    <DocumentosTab patientId={paciente.id} clinicaId={clinicaId} dentistaId={dentistaId} />
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
            setEditDentistaId(paciente.dentista_id ?? '');
            setEditCpf(paciente.cpf ?? '');
            setEditDataNascimento(paciente.data_nascimento ?? '');
            setEditResponsavelNome(paciente.responsavel_nome ?? '');
            setEditResponsavelTelefone(paciente.responsavel_telefone ?? '');
            setEditResponsavelParentesco(paciente.responsavel_parentesco ?? '');
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
        editCpf={editCpf}
        setEditCpf={setEditCpf}
        editDataNascimento={editDataNascimento}
        setEditDataNascimento={setEditDataNascimento}
        editResponsavelNome={editResponsavelNome}
        setEditResponsavelNome={setEditResponsavelNome}
        editResponsavelTelefone={editResponsavelTelefone}
        setEditResponsavelTelefone={setEditResponsavelTelefone}
        editResponsavelParentesco={editResponsavelParentesco}
        setEditResponsavelParentesco={setEditResponsavelParentesco}
        editError={editError}
        isPending={isPending}
        onSave={handleSaveEdit}
        editDentistaId={editDentistaId}
        setEditDentistaId={setEditDentistaId}
        dentistasClinica={role === 'secretaria' ? dentistasClinica : null}
      />

      <DetalheOrcamentoModal
        detalheOrc={detalheOrc}
        detalheOrcId={detalheOrcId}
        pacienteTelefone={displayTelefone}
        pacienteNome={displayNome}
        pacienteId={paciente.id}
        onClose={() => {
          setDetalheOrcId(null);
          setPagError(null);
          setOrcEditMode(false);
          setOrcEditError(null);
          setPagForm({ valor: '', formaPagamento: 'dinheiro', data: new Date().toISOString().split('T')[0], dataVencimento: '' });
          setClosingPagamentoId(null);
          setEditingPagId(null);
          setEditPagError(null);
          setConfirmDeletePagId(null);
          setEditValorAcordadoAberto(false);
          setValorAcordadoError(null);
          setParcelasMode(false);
          setParcelasForm({ numero: '3', primeiroVencimento: '' });
          setParcelasError(null);
        }}
        pagForm={pagForm}
        setPagForm={setPagForm}
        pagSaving={pagSaving}
        pagError={pagError}
        parcelasMode={parcelasMode}
        setParcelasMode={setParcelasMode}
        parcelasForm={parcelasForm}
        setParcelasForm={setParcelasForm}
        parcelasSaving={parcelasSaving}
        parcelasError={parcelasError}
        onGerarParcelas={handleGerarParcelas}
        orcEditMode={orcEditMode}
        setOrcEditMode={setOrcEditMode}
        orcEditItens={orcEditItens}
        setOrcEditItens={setOrcEditItens}
        orcEditSaving={orcEditSaving}
        orcEditError={orcEditError}
        setOrcEditError={setOrcEditError}
        onOpenEditOrc={handleOpenEditOrc}
        onSalvarEdicaoOrc={handleSalvarEdicaoOrc}
        onAlternarAprovacaoItem={handleAlternarAprovacaoItem}
        onAprovarTodosItens={handleAprovarTodosItens}
        onToggleMostrarValorPorItem={handleToggleMostrarValorPorItem}
        onRegistrarPagamento={closingPagamentoId ? handleFecharPagamento : handleRegistrarPagamento}
        closingPagamentoId={closingPagamentoId}
        onIniciarFechamentoPagamento={handleIniciarFechamentoPagamento}
        onCancelarFechamentoPagamento={handleCancelarFechamentoPagamento}
        onDeleteClick={setConfirmDeleteOrcId}
        podeExcluir={detalheOrc?.dentista_id === dentistaId}
        editingPagId={editingPagId}
        editPagForm={editPagForm}
        setEditPagForm={setEditPagForm}
        editPagSaving={editPagSaving}
        editPagError={editPagError}
        onIniciarEdicaoPagamento={handleIniciarEdicaoPagamento}
        onCancelarEdicaoPagamento={() => { setEditingPagId(null); setEditPagError(null); }}
        onSalvarEdicaoPagamento={handleSalvarEdicaoPagamento}
        confirmDeletePagId={confirmDeletePagId}
        setConfirmDeletePagId={setConfirmDeletePagId}
        pagDeleteSaving={pagDeleteSaving}
        onExcluirPagamento={handleExcluirPagamento}
        editValorAcordadoAberto={editValorAcordadoAberto}
        valorAcordadoTexto={valorAcordadoTexto}
        setValorAcordadoTexto={setValorAcordadoTexto}
        valorAcordadoSaving={valorAcordadoSaving}
        valorAcordadoError={valorAcordadoError}
        onIniciarEdicaoValorAcordado={handleIniciarEdicaoValorAcordado}
        onCancelarEdicaoValorAcordado={handleCancelarEdicaoValorAcordado}
        onSalvarValorAcordado={handleSalvarValorAcordado}
        onAceiteRegistrado={() => {
          // R-03c-1: o snapshot real (cro_no_ato, termos exatos) é montado no servidor —
          // busca de novo em vez de aproximar no client, mesma disciplina do handleStatusChange.
          toast.success('Aceite do paciente registrado.');
          router.refresh();
        }}
      />

      <ConfirmarDeleteOrcModal
        confirmDeleteOrcId={confirmDeleteOrcId}
        onOpenChange={(open) => { if (!open) { setConfirmDeleteOrcId(null); setOrcDeleteError(null); } }}
        orcDeleteSaving={orcDeleteSaving}
        orcDeleteError={orcDeleteError}
        onExcluir={handleExcluirOrc}
        valorJaRecebido={
          (orcamentosState.find((o) => o.id === confirmDeleteOrcId)?.pagamentos ?? [])
            .filter((p) => p.status === 'pago')
            .reduce((s, p) => s + p.valor, 0)
        }
        temAceiteAssinado={
          !!orcamentosState.find((o) => o.id === confirmDeleteOrcId)?.aceite
        }
      />

      <ExcluirPacienteModal
        open={excluirPacienteAberto}
        onOpenChange={(open) => { setExcluirPacienteAberto(open); if (!open) setExcluirPacienteError(null); }}
        pacienteNome={displayNome}
        saving={excluindoPaciente}
        error={excluirPacienteError}
        onExcluir={handleExcluirPaciente}
      />

      <MarcarRetornoModal
        open={isMarcarRetornoOpen}
        onOpenChange={(open) => {
          setIsMarcarRetornoOpen(open);
          if (!open) {
            retorno.limparErro();
            if (role === 'secretaria') setRetornoDentistaAlvoId(null);
          }
        }}
        pacienteNome={displayNome}
        role={role}
        dentistasClinica={dentistasClinica}
        dentistaAlvoId={retornoDentistaAlvoId}
        onDentistaAlvoChange={handleRetornoDentistaAlvoChange}
        form={retorno.form}
        setForm={retorno.setForm}
        error={retorno.error}
        saving={retorno.saving}
        pedidoPendente={retorno.pedidoPendente}
        onMarcarRetorno={() => void retorno.marcarRetorno(retornoDentistaAlvoId)}
        onTentarEnviarPedido={() => void retorno.tentarEnviarPedido(retornoDentistaAlvoId)}
      />

      <EmitirDocumentoModal
        open={isEmitirOpen}
        onClose={() => setIsEmitirOpen(false)}
        patientId={paciente.id}
        patientName={displayNome}
      />

      <EmitirAceiteModal
        open={isEmitirAceiteOpen}
        onClose={() => setIsEmitirAceiteOpen(false)}
        patientId={paciente.id}
        patientName={displayNome}
      />

      <NovoOrcamentoModal {...orcamentoModal.modalProps} />
    </PageContainer>
  );
}
