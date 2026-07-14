'use client';

import {
  Plus,
  Calendar as CalendarIcon,
  User,
  ExternalLink,
  UserCog,
  Pencil,
  Trash2,
  ArrowLeft,
  CalendarDays,
  LayoutGrid,
  Loader2,
  CheckCircle2,
  PenLine,
  Stethoscope,
  AlertTriangle,
  UserCheck,
  CalendarCheck,
  Clock,
  X,
  ThumbsUp,
  UserPlus,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const AssinaturaRecepcaoModal = dynamic(
  () => import('@/components/fichas/AssinaturaRecepcaoModal').then(m => m.AssinaturaRecepcaoModal),
  { ssr: false }
);
import { buildClinicDatetime } from './date-helpers';
import { useState, useMemo, useCallback, useTransition, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageContainer } from '@/components/layout/page-container';
import {
  format,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday as isDateToday,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetClose,
  SheetDescription,
} from '@/components/ui/sheet';
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
import type { AgendamentoRow } from '../page';
import {
  atualizarStatusAgendamento,
  atualizarAgendamento,
  deletarAgendamento,
  criarAgendamento,
  importarEventosGoogle,
  fazerCheckIn,
  marcarNoShow,
  cancelarComMotivo,
  criarEncaixe,
  type StatusAgendamento,
} from '../actions';
import { criarPacienteRapido } from '@/app/dashboard/pacientes/[id]/actions';
import { createClient } from '@/lib/supabase/client';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import type { DentistaRole, AgendamentoStatus } from '@/types/database';
import { toast } from 'sonner';
import { WeekView } from './week-view';
import { DayView } from './day-view';
import { MonthView } from './month-view';
import { AtenderAgoraModal } from './atender-agora-modal';
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';
import { StatusBadge } from './status-badge';

const STATUSES_ATIVOS = new Set(['scheduled', 'confirmed', 'checked_in', 'in_progress']);

const STATUS_PT: Record<string, string> = {
  scheduled:   'Agendado',
  confirmed:   'Confirmado',
  checked_in:  'Na Recepção',
  in_progress: 'Em Atendimento',
  completed:   'Realizado',
  cancelled:   'Cancelado',
  no_show:     'Faltou',
};

interface Props {
  agendamentos: AgendamentoRow[];
  clinicaId: string;
  role: DentistaRole;
  dentistaAtualId: string;
  /** Lista de dentistas para filtro/form (apenas preenchida para secretária) */
  dentistas: { id: string; nome: string }[];
  /** Mapa dentistaId → GCal conectado (secretária) */
  calendarConnectedPerDentista: Record<string, boolean>;
  /** Clínica tem pelo menos uma secretária ativa */
  temSecretaria: boolean;
  /** Mês atual no formato 'YYYY-MM' — controlado via URL search param */
  mesAtual: string;
  /** Pode criar agendamentos: plano SOLO ou secretária */
  canEdit: boolean;
  /** Auto-abre o drawer de novo agendamento (via ?novo=1 na URL) */
  autoOpenNovo?: boolean;
}

export function AgendamentosClient({
  agendamentos: inicial,
  clinicaId: _clinicaId,
  role,
  dentistaAtualId,
  dentistas,
  calendarConnectedPerDentista,
  temSecretaria,
  mesAtual,
  canEdit,
  autoOpenNovo = false,
}: Props) {
  const router = useRouter();
  const isSecretaria = role === 'secretaria';

  // currentMonth é derivado do prop (controlado pelo servidor via URL)
  const currentMonth = parseISO(`${mesAtual}-01`);

  // Navegação de mês via URL para que o servidor re-faça a query filtrada
  const [isPending, startTransition] = useTransition();
  const goToMonth = (date: Date) => {
    const mes = format(date, 'yyyy-MM');
    startTransition(() => {
      router.push(`/dashboard/agendamentos?mes=${mes}`);
    });
  };

  const [agendamentos, setAgendamentos] = useState(inicial);
  // selectedDate: hoje se estiver no mês atual, senão o 1º dia do mês
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return isSameMonth(today, currentMonth) ? today : currentMonth;
  });
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AgendamentoRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modo do modal de detalhe: visualização / edição / confirmação de exclusão
  const [detailMode, setDetailMode] = useState<'view' | 'edit' | 'confirm-delete'>('view');
  const [editForm, setEditForm] = useState({ data: '', hora: '', duracao: '30', observacoes: '' });

  // Assinatura do paciente na recepção
  const [assinadosLocal, setAssinadosLocal] = useState<Set<string>>(new Set());
  const [assinaturaModal, setAssinaturaModal] = useState<{
    pacienteId: string;
    pacienteNome: string;
    aptId: string;
  } | null>(null);

  // Filtro por dentista (somente secretária)
  const [filtroDentistaId, setFiltroDentistaId] = useState<string>('todos');

  // MANTÉM SINCRONIA: Garante que os dados locais reflitam o banco após F5 ou revalidatePath
  useEffect(() => {
    setAgendamentos(inicial);
  }, [inicial]);

  // Multi-user: atualiza dados do mês quando a janela recupera foco (throttle 30s)
  useEffect(() => {
    let lastRefresh = Date.now();
    const handler = async () => {
      const now = Date.now();
      if (now - lastRefresh > 30_000) {
        lastRefresh = now;
        const mes = parseISO(`${mesAtual}-01`);
        const mesInicio = format(startOfMonth(mes), "yyyy-MM-dd'T'00:00:00");
        const mesFim = format(endOfMonth(mes), "yyyy-MM-dd'T'23:59:59");
        const supabase = createClient();
        const { data } = await supabase
          .from('agendamentos')
          .select('id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, origem, observacoes, created_at, paciente:pacientes(id, nome, observacoes), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome), criador:dentistas!agendamentos_created_by_fkey(id, nome)')
          .eq('clinica_id', _clinicaId)
          .gte('data_hora', mesInicio)
          .lte('data_hora', mesFim)
          .order('data_hora');
        if (data) setAgendamentos(data as unknown as AgendamentoRow[]);
      }
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [_clinicaId, mesAtual]);

  // Auto-abre o drawer e limpa ?novo=1 da URL sem reload nem flicker
  useEffect(() => {
    if (autoOpenNovo && canEdit) {
      setIsNewModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('novo');
      const clean = url.pathname + (url.searchParams.size > 0 ? `?${url.searchParams.toString()}` : '');
      router.replace(clean, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Importação do Google Calendar
  const [isImporting, setIsImporting]           = useState(false);
  const [importProgress, setImportProgress]     = useState(0);
  const [importDone, setImportDone]             = useState(false);
  const progressIntervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null);
  const buscarDebounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscarAbortRef                          = useRef<AbortController | null>(null);
  const encaixeDebounceRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encaixeAbortRef                         = useRef<AbortController | null>(null);

  // Limpa timers ao desmontar
  useEffect(() => () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (buscarDebounceRef.current) clearTimeout(buscarDebounceRef.current);
    if (encaixeDebounceRef.current) clearTimeout(encaixeDebounceRef.current);
    buscarAbortRef.current?.abort();
    encaixeAbortRef.current?.abort();
  }, []);

  // Estado do formulário de novo agendamento
  const [novoForm, setNovoForm] = useState({
    pacienteSearch: '',
    pacienteId: '',
    pacienteNome: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    hora: '09:00',
    duracao: '30',
    observacoes: '',
    dentistaId: dentistas[0]?.id ?? '',
  });
  const [pacienteSugestoes, setPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [criandoPacienteNovo, setCriandoPacienteNovo] = useState(false);

  type ViewMode = 'day' | 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedWeek, setSelectedWeek] = useState(() => new Date());

  // Cancel dialog
  const [cancelDialog, setCancelDialog] = useState<{ aptId: string; aptNome: string } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Walk-in "Atender agora" — busca/cria paciente e cai direto na consulta (#2)
  const [isAtenderAgoraOpen, setIsAtenderAgoraOpen] = useState(false);

  // Walk-in / encaixe
  const [isEncaixeOpen, setIsEncaixeOpen] = useState(false);
  const [encaixeForm, setEncaixeForm] = useState({
    pacienteSearch: '',
    pacienteId: '',
    pacienteNome: '',
    hora: '09:00',
    duracao: '30',
    dentistaId: dentistas[0]?.id ?? '',
  });
  const [encaixeSugestoes, setEncaixeSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showEncaixeSugestoes, setShowEncaixeSugestoes] = useState(false);
  const [encaixeSaving, setEncaixeSaving] = useState(false);
  const [encaixeError, setEncaixeError] = useState<string | null>(null);
  const [encaixeConflito, setEncaixeConflito] = useState(false);
  const [criandoPacienteEncaixe, setCriandoPacienteEncaixe] = useState(false);

  // Agendamentos filtrados pelo dentista selecionado (somente secretária)
  const agendamentosFiltrados = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return agendamentos;
    return agendamentos.filter((a) => a.dentista_id === filtroDentistaId);
  }, [agendamentos, isSecretaria, filtroDentistaId]);

  // True quando a secretária tem um dentista específico selecionado
  const isFiltered = isSecretaria && filtroDentistaId !== 'todos';

  // Dias do calendário para o mês atual
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end }).map((date) => ({
      date,
      isCurrentMonth: isSameMonth(date, currentMonth),
      isToday: isDateToday(date),
      hasAppointments: agendamentosFiltrados.some((apt) =>
        isSameDay(parseISO(apt.data_hora), date)
      ),
    }));
  }, [currentMonth, agendamentosFiltrados]);

  // Agendamentos do dia selecionado (com filtro de dentista aplicado)
  const filteredAppointments = useMemo(
    () =>
      agendamentosFiltrados
        .filter((apt) => isSameDay(parseISO(apt.data_hora), selectedDate))
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora)),
    [agendamentosFiltrados, selectedDate]
  );

  // Detecta conflito de horário para o formulário de novo agendamento
  const conflitoNovo = useMemo(() => {
    if (!novoForm.data || !novoForm.hora) return false;
    const novoStart = new Date(buildClinicDatetime(novoForm.data, novoForm.hora)).getTime();
    const novoEnd = novoStart + parseInt(novoForm.duracao, 10) * 60_000;
    const dentId = isSecretaria ? novoForm.dentistaId : dentistaAtualId;
    return agendamentos.some((a) => {
      if (!STATUSES_ATIVOS.has(a.status)) return false;
      if (a.dentista_id !== dentId) return false;
      const aStart = new Date(a.data_hora).getTime();
      const aEnd = aStart + a.duracao_minutos * 60_000;
      return novoStart < aEnd && novoEnd > aStart;
    });
  }, [agendamentos, novoForm.data, novoForm.hora, novoForm.duracao, novoForm.dentistaId, isSecretaria, dentistaAtualId]);

  // Detecta conflito de horário no modo de edição (exclui o próprio agendamento)
  const conflitoEdicao = useMemo(() => {
    if (!selectedApt || !editForm.data || !editForm.hora) return false;
    const novoStart = new Date(buildClinicDatetime(editForm.data, editForm.hora)).getTime();
    const novoEnd = novoStart + parseInt(editForm.duracao, 10) * 60_000;
    return agendamentos.some((a) => {
      if (a.id === selectedApt.id) return false;
      if (!STATUSES_ATIVOS.has(a.status)) return false;
      if (a.dentista_id !== selectedApt.dentista_id) return false;
      const aStart = new Date(a.data_hora).getTime();
      const aEnd = aStart + a.duracao_minutos * 60_000;
      return novoStart < aEnd && novoEnd > aStart;
    });
  }, [agendamentos, editForm.data, editForm.hora, editForm.duracao, selectedApt]);

  // Keyboard shortcuts — apenas quando nenhum input/drawer está focado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      if (inInput) return;
      const modalOpen = isNewModalOpen || isDetailModalOpen || isEncaixeOpen || !!cancelDialog || !!assinaturaModal;
      if (modalOpen && e.key !== 'Escape') return;

      switch (e.key) {
        case 'n':
        case 'N':
          if (!modalOpen && canEdit) { e.preventDefault(); setIsNewModalOpen(true); }
          break;
        case 'e':
        case 'E':
          if (!modalOpen && canEdit && isSecretaria) { e.preventDefault(); setIsEncaixeOpen(true); }
          break;
        case 't':
        case 'T':
          if (!modalOpen) { e.preventDefault(); setSelectedDate(new Date()); }
          break;
        case 'ArrowLeft':
          if (!modalOpen && viewMode === 'day') {
            e.preventDefault();
            setSelectedDate(d => subDays(d, 1));
          }
          break;
        case 'ArrowRight':
          if (!modalOpen && viewMode === 'day') {
            e.preventDefault();
            setSelectedDate(d => addDays(d, 1));
          }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isNewModalOpen, isDetailModalOpen, isEncaixeOpen, cancelDialog, assinaturaModal, canEdit, viewMode, isSecretaria]);

  // Busca pacientes por nome (autocomplete) — debounced 300ms + AbortController
  const buscarPacientes = useCallback((nome: string) => {
    if (buscarDebounceRef.current) clearTimeout(buscarDebounceRef.current);
    buscarAbortRef.current?.abort();
    if (nome.length < 2) { setPacienteSugestoes([]); return; }
    buscarDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      buscarAbortRef.current = controller;
      const supabase = createClient();
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome')
        .ilike('nome', `%${nome}%`)
        .limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) setPacienteSugestoes(data ?? []);
    }, 300);
  }, []);

  // Cadastro rápido — busca não achou; cria só com o nome e já seleciona pro
  // agendamento. Vincula ao dentista-alvo (não a quem está logado) pra secretária
  // conseguir agendar pra outro profissional e ele achar o paciente depois.
  const handleCriarPacienteRapidoNovo = async () => {
    const nome = novoForm.pacienteSearch.trim();
    if (!nome) return;
    setCriandoPacienteNovo(true);
    const dentistaAlvo = isSecretaria ? novoForm.dentistaId : dentistaAtualId;
    const res = await criarPacienteRapido({ nome, telefone: null, dentistaId: dentistaAlvo || undefined });
    setCriandoPacienteNovo(false);
    if (res.error || !res.id) {
      toast.error(res.error ?? 'Não foi possível cadastrar o paciente.');
      return;
    }
    setNovoForm((f) => ({ ...f, pacienteSearch: nome, pacienteId: res.id!, pacienteNome: nome }));
    setShowSugestoes(false);
    setPacienteSugestoes([]);
    toast.success(`Paciente "${nome}" cadastrado. Complete os dados dele quando quiser.`);
  };

  // Atualiza status do agendamento via server action
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    const dbStatus = status as StatusAgendamento;
    const result = await atualizarStatusAgendamento(id, dbStatus);
    if (!result.error) {
      setAgendamentos((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
      );
      setSelectedApt((prev) => (prev?.id === id ? { ...prev, status } : prev));
    }
  }, []);

  const resetForm = () => {
    setNovoForm({
      pacienteSearch: '',
      pacienteId: '',
      pacienteNome: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      hora: '09:00',
      duracao: '30',
      observacoes: '',
      dentistaId: dentistas[0]?.id ?? '',
    });
    setPacienteSugestoes([]);
    setShowSugestoes(false);
  };

  // ── Importação do Google Calendar ──────────────────────────────────────────
  const handleImportCalendar = async () => {
    const targetId = isSecretaria
      ? filtroDentistaId !== 'todos' ? filtroDentistaId : null
      : dentistaAtualId;

    if (!targetId) {
      toast.error('Selecione um dentista antes de importar.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportDone(false);

    // Barra de progresso animada até 85%
    let prog = 0;
    progressIntervalRef.current = setInterval(() => {
      prog = Math.min(prog + 12, 85);
      setImportProgress(prog);
      if (prog >= 85 && progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, 350);

    try {
      const result = await importarEventosGoogle(targetId);

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setImportProgress(100);
      setImportDone(true);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          result.imported > 0
            ? `${result.imported} evento${result.imported !== 1 ? 's' : ''} importado${result.imported !== 1 ? 's' : ''}! (${result.skipped} já existiam)`
            : `Nenhum evento novo. ${result.skipped} já importado${result.skipped !== 1 ? 's' : ''}.`,
        );
        if (result.imported > 0) {
          const mes = parseISO(`${mesAtual}-01`);
          const mesInicio = format(startOfMonth(mes), "yyyy-MM-dd'T'00:00:00");
          const mesFim = format(endOfMonth(mes), "yyyy-MM-dd'T'23:59:59");
          const supabase = createClient();
          const { data } = await supabase
            .from('agendamentos')
            .select('id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, origem, observacoes, created_at, paciente:pacientes(id, nome, observacoes), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome), criador:dentistas!agendamentos_created_by_fkey(id, nome)')
            .eq('clinica_id', _clinicaId)
            .gte('data_hora', mesInicio)
            .lte('data_hora', mesFim)
            .order('data_hora');
          if (data) setAgendamentos(data as unknown as AgendamentoRow[]);
        }
      }
    } catch {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      toast.error('Erro ao conectar com o Google Calendar.');
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportDone(false);
      }, 2000);
    }
  };

  // Cria novo agendamento via server action
  const handleCriarAgendamento = async () => {
    if (!novoForm.pacienteId) {
      setSaveError('Selecione um paciente.');
      return;
    }
    if (isSecretaria && !novoForm.dentistaId) {
      setSaveError('Selecione um dentista.');
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    // Timestamp explicitamente em BRT (UTC-3) — independente do timezone do browser
    const dataHora = buildClinicDatetime(novoForm.data, novoForm.hora);
    const [ano, mes, dia] = novoForm.data.split('-').map(Number);
    const observacoesCombinadas = novoForm.observacoes.trim() || null;

    const result = await criarAgendamento({
      pacienteId: novoForm.pacienteId,
      dataHora,
      duracaoMinutos: parseInt(novoForm.duracao, 10) || 30,
      observacoes: observacoesCombinadas,
      ...(isSecretaria && novoForm.dentistaId ? { dentistaId: novoForm.dentistaId } : {}),
    });

    if (result.error) {
      setSaveError(result.error);
    } else {
      const dentistaDoAgt = isSecretaria
        ? dentistas.find((d) => d.id === novoForm.dentistaId) ?? null
        : null;

      const novoAgt: AgendamentoRow = {
        id: result.id ?? crypto.randomUUID(),
        clinica_id: _clinicaId,
        paciente_id: novoForm.pacienteId,
        dentista_id: isSecretaria ? novoForm.dentistaId : dentistaAtualId,
        data_hora: dataHora,
        duracao_minutos: parseInt(novoForm.duracao, 10) || 30,
        status: isSecretaria ? 'scheduled' : 'confirmed',
        origem: 'manual',
        observacoes: observacoesCombinadas,
        created_at: new Date().toISOString(),
        paciente: { id: novoForm.pacienteId, nome: novoForm.pacienteNome, observacoes: null },
        dentista: dentistaDoAgt ? { id: dentistaDoAgt.id, nome: dentistaDoAgt.nome } : null,
        criador: null,
      };
      setAgendamentos((prev) => [...prev, novoAgt]);
      setIsNewModalOpen(false);
      resetForm();
      // Navega o calendário para o dia do agendamento criado
      setSelectedDate(new Date(ano, mes - 1, dia));
    }
    setIsSaving(false);
  };

  const handleOpenDetail = useCallback((apt: AgendamentoRow) => {
    setSelectedApt(apt);
    setDetailMode('view');
    setSaveError(null);
    setIsDetailModalOpen(true);
  }, []);

  const enterEditMode = () => {
    if (!selectedApt) return;
    const dt = parseISO(selectedApt.data_hora);
    setEditForm({
      data: format(dt, 'yyyy-MM-dd'),
      hora: format(dt, 'HH:mm'),
      duracao: String(selectedApt.duracao_minutos),
      observacoes: selectedApt.observacoes ?? '',
    });
    setSaveError(null);
    setDetailMode('edit');
  };

  const handleSalvarEdicao = async () => {
    if (!selectedApt) return;
    setSaveError(null);
    setIsSaving(true);

    // Timestamp explicitamente em BRT (UTC-3) — independente do timezone do browser
    const dataHora = buildClinicDatetime(editForm.data, editForm.hora);

    const result = await atualizarAgendamento(selectedApt.id, {
      dataHora,
      duracaoMinutos: parseInt(editForm.duracao, 10) || 30,
      observacoes: editForm.observacoes.trim() || null,
    });

    if (result.error) {
      setSaveError(result.error);
    } else {
      const updated: AgendamentoRow = {
        ...selectedApt,
        data_hora: dataHora,
        duracao_minutos: parseInt(editForm.duracao, 10) || 30,
        observacoes: editForm.observacoes.trim() || null,
      };
      setAgendamentos((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelectedApt(updated);
      setDetailMode('view');
    }
    setIsSaving(false);
  };

  const handleDeletar = async () => {
    if (!selectedApt) return;
    setIsSaving(true);

    const result = await deletarAgendamento(selectedApt.id);

    if (result.error) {
      setSaveError(result.error);
      setDetailMode('view');
    } else {
      setAgendamentos((prev) => prev.filter((a) => a.id !== selectedApt.id));
      setIsDetailModalOpen(false);
      setDetailMode('view');
    }
    setIsSaving(false);
  };

  const handleNoShow = useCallback(async (id: string) => {
    const result = await marcarNoShow(id);
    if (!result.error) {
      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: 'no_show' } : a));
      toast.success('Marcado como faltou.');
    } else {
      toast.error(result.error);
    }
  }, []);

  const handleCancelar = async () => {
    if (!cancelDialog) return;
    setIsCancelling(true);
    const result = await cancelarComMotivo(cancelDialog.aptId, cancelMotivo.trim() || null);
    if (!result.error) {
      setAgendamentos(prev => prev.map(a => a.id === cancelDialog.aptId ? { ...a, status: 'cancelled' } : a));
      if (selectedApt?.id === cancelDialog.aptId) {
        setSelectedApt(prev => prev ? { ...prev, status: 'cancelled' } : prev);
        setIsDetailModalOpen(false);
      }
      setCancelDialog(null);
      setCancelMotivo('');
      toast.success('Agendamento cancelado.');
    } else {
      toast.error(result.error);
    }
    setIsCancelling(false);
  };

  const buscarEncaixePacientes = useCallback((nome: string) => {
    if (encaixeDebounceRef.current) clearTimeout(encaixeDebounceRef.current);
    encaixeAbortRef.current?.abort();
    if (nome.length < 2) { setEncaixeSugestoes([]); return; }
    encaixeDebounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      encaixeAbortRef.current = controller;
      const supabase = createClient();
      const { data } = await supabase
        .from('pacientes').select('id, nome').ilike('nome', `%${nome}%`).limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) setEncaixeSugestoes(data ?? []);
    }, 300);
  }, []);

  const handleCriarPacienteRapidoEncaixe = async () => {
    const nome = encaixeForm.pacienteSearch.trim();
    if (!nome) return;
    setCriandoPacienteEncaixe(true);
    const dentistaAlvo = isSecretaria ? encaixeForm.dentistaId : dentistaAtualId;
    const res = await criarPacienteRapido({ nome, telefone: null, dentistaId: dentistaAlvo || undefined });
    setCriandoPacienteEncaixe(false);
    if (res.error || !res.id) {
      toast.error(res.error ?? 'Não foi possível cadastrar o paciente.');
      return;
    }
    setEncaixeForm((f) => ({ ...f, pacienteSearch: nome, pacienteId: res.id!, pacienteNome: nome }));
    setShowEncaixeSugestoes(false);
    setEncaixeSugestoes([]);
    toast.success(`Paciente "${nome}" cadastrado. Complete os dados dele quando quiser.`);
  };

  const handleCriarEncaixe = async (forcar = false) => {
    if (!encaixeForm.pacienteId) { setEncaixeError('Selecione um paciente.'); return; }
    if (isSecretaria && !encaixeForm.dentistaId) { setEncaixeError('Selecione um dentista.'); return; }
    setEncaixeError(null);
    setEncaixeSaving(true);
    setEncaixeConflito(false);

    // Timestamp explicitamente em BRT (UTC-3) — independente do timezone do browser
    const dataHora = buildClinicDatetime(format(selectedDate, 'yyyy-MM-dd'), encaixeForm.hora);

    const result = await criarEncaixe({
      pacienteId: encaixeForm.pacienteId,
      dataHora,
      duracaoMinutos: parseInt(encaixeForm.duracao, 10) || 30,
      observacoes: null,
      ...(isSecretaria && encaixeForm.dentistaId ? { dentistaId: encaixeForm.dentistaId } : {}),
      forcarEncaixe: forcar,
    });

    if (result.conflito) {
      setEncaixeConflito(true);
      setEncaixeSaving(false);
      return;
    }

    if (result.error) {
      setEncaixeError(result.error);
      setEncaixeSaving(false);
      return;
    }

    const dentistaDoEnc = isSecretaria ? dentistas.find(d => d.id === encaixeForm.dentistaId) ?? null : null;
    const novoAgt: AgendamentoRow = {
      id: result.id ?? crypto.randomUUID(),
      clinica_id: _clinicaId,
      paciente_id: encaixeForm.pacienteId,
      dentista_id: isSecretaria ? encaixeForm.dentistaId : dentistaAtualId,
      data_hora: dataHora,
      duracao_minutos: parseInt(encaixeForm.duracao, 10) || 30,
      status: 'scheduled',
      origem: 'manual',
      observacoes: '[Encaixe]',
      created_at: new Date().toISOString(),
      paciente: { id: encaixeForm.pacienteId, nome: encaixeForm.pacienteNome, observacoes: null },
      dentista: dentistaDoEnc,
      criador: null,
    };
    setAgendamentos(prev => [...prev, novoAgt]);
    setIsEncaixeOpen(false);
    setEncaixeConflito(false);
    setEncaixeForm({ pacienteSearch: '', pacienteId: '', pacienteNome: '', hora: '09:00', duracao: '30', dentistaId: dentistas[0]?.id ?? '' });
    toast.success('Encaixe criado!');
    setEncaixeSaving(false);
  };

  return (
    <PageContainer variant="wide">
      {/* Cabeçalho */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
      >
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] font-mono text-text-secondary mb-1">
            {format(new Date(), "EEE',' d 'de' MMM", { locale: ptBR })}
          </span>
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary mb-1 flex items-center">
            Agendamentos
            <HelpTooltip content="Gerencie sua agenda com visualização mensal/semanal." />
          </h1>
          <p className="text-text-secondary text-sm font-medium">
            {isSecretaria
              ? 'Gerencie a agenda de todos os dentistas da clínica.'
              : 'Gerencie sua agenda e compromissos.'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Filtro por dentista — tabs para secretária */}
          {isSecretaria && dentistas.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFiltroDentistaId('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filtroDentistaId === 'todos'
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                Todos
              </button>
              {dentistas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setFiltroDentistaId(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filtroDentistaId === d.id
                      ? 'bg-teal text-white shadow-sm'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {d.nome.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          {/* Botão importar Google Calendar — secretária (dentista selecionado com GCal) */}
          {isSecretaria &&
            filtroDentistaId !== 'todos' &&
            calendarConnectedPerDentista[filtroDentistaId] && (
              <ImportCalendarButton
                isImporting={isImporting}
                progress={importProgress}
                done={importDone}
                onClick={() => void handleImportCalendar()}
              />
            )}

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-surface-alt border border-border rounded-xl p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'day' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Dia
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'week' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'month' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Mês
            </button>
          </div>

          {/* Atender agora — walk-in do dentista: cai direto na consulta (#2) */}
          {!isSecretaria && (
            <button
              onClick={() => setIsAtenderAgoraOpen(true)}
              className="bg-teal text-white hover:bg-teal-lt active:scale-[0.98] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-md"
            >
              <Stethoscope className="w-4 h-4" />
              Atender agora
            </button>
          )}

          {/* Encaixe — secretária */}
          {canEdit && isSecretaria && (
            <button
              onClick={() => setIsEncaixeOpen(true)}
              className="border border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary active:scale-[0.98] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all group"
            >
              <Stethoscope className="w-4 h-4" />
              Encaixe
              <kbd className="hidden sm:flex font-mono text-[10px] bg-surface-alt rounded px-1 py-0.5 leading-none group-hover:bg-surface transition-colors border border-border/60">E</kbd>
            </button>
          )}

          {/* Novo Agendamento — plano SOLO ou secretária */}
          {canEdit && (
            <button
              onClick={() => { setSaveError(null); setIsNewModalOpen(true); }}
              className="bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_32px_rgba(47,156,133,0.38)] hover:-translate-y-0.5 active:scale-[0.98] w-full sm:w-auto group"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
              <kbd className="hidden sm:flex font-mono text-[10px] bg-white/15 rounded px-1 py-0.5 leading-none group-hover:bg-white/20 transition-colors">N</kbd>
            </button>
          )}
        </div>
      </motion.header>

      {/* ── Views ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
      {viewMode === 'day' && (
        <motion.div
          key="day"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden h-[440px] sm:h-[560px] lg:h-[680px]"
        >
          <DayView
            agendamentos={agendamentosFiltrados}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onAppointmentClick={handleOpenDetail}
            isSecretaria={isSecretaria}
            isFiltered={isFiltered}
            onConfirm={(id) => void handleStatusChange(id, 'confirmed')}
            onCheckIn={(id) => void handleStatusChange(id, 'checked_in')}
            onNoShow={(id) => void handleNoShow(id)}
            onCancel={(apt) => { setCancelDialog({ aptId: apt.id, aptNome: apt.paciente?.nome ?? '' }); setCancelMotivo(''); }}
            onVerFicha={(pacienteId) => router.push(`/dashboard/pacientes/${pacienteId}`)}
          />
        </motion.div>
      )}

      {viewMode === 'week' && (
        <motion.div
          key="week"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden h-[440px] sm:h-[560px] lg:h-[680px]"
        >
          <WeekView
            agendamentos={agendamentosFiltrados}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            onAppointmentClick={handleOpenDetail}
            onDayClick={(d) => { setSelectedDate(d); setViewMode('day'); }}
            isSecretaria={isSecretaria}
          />
        </motion.div>
      )}

      {viewMode === 'month' && (
        <motion.div
          key="month"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
        <MonthView
          currentMonth={currentMonth}
          calendarDays={calendarDays}
          selectedDate={selectedDate}
          onDaySelect={setSelectedDate}
          isPending={isPending}
          onPrevMonth={() => goToMonth(subMonths(currentMonth, 1))}
          onNextMonth={() => goToMonth(addMonths(currentMonth, 1))}
          todayCount={agendamentosFiltrados.filter((a) => isDateToday(parseISO(a.data_hora))).length}
          selectedDayCount={filteredAppointments.length}
          appointments={filteredAppointments}
          isSecretaria={isSecretaria}
          filtroDentistaId={filtroDentistaId}
          dentistas={dentistas}
          canEdit={canEdit}
          isFiltered={isFiltered}
          onAppointmentClick={handleOpenDetail}
          onStatusChange={handleStatusChange}
          onNoShow={handleNoShow}
          onCancel={(apt) => {
            setCancelDialog({ aptId: apt.id, aptNome: apt.paciente?.nome ?? '' });
            setCancelMotivo('');
          }}
          onNewAppointment={() => setIsNewModalOpen(true)}
          onVerFicha={(pacienteId) => router.push(`/dashboard/pacientes/${pacienteId}`)}
          onStartConsulta={(aptId) => router.push(`/consulta/${aptId}`)}
          onRequestAssinatura={(pacienteId, nome, aptId) =>
            setAssinaturaModal({ pacienteId, pacienteNome: nome, aptId })
          }
          assinadosIds={assinadosLocal}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Drawer: Novo Agendamento */}
      <Sheet open={isNewModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsNewModalOpen(open); }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="!w-full sm:!w-[560px] p-0 gap-0 flex flex-col bg-surface border-l border-border"
        >
          <SheetDescription className="sr-only">Preencha os dados para marcar uma nova consulta.</SheetDescription>

          {/* Header teal */}
          <div className="relative px-6 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <SheetTitle className="font-heading font-semibold text-xl text-white leading-tight">Novo Agendamento</SheetTitle>
                  <p className="text-white/70 text-xs mt-0.5">Preencha os dados para marcar uma nova consulta.</p>
                </div>
              </div>
              <SheetClose
                render={<button className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors" />}
              >
                <X className="w-4 h-4 text-white" />
              </SheetClose>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Dentista — apenas secretária */}
            {isSecretaria && dentistas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-teal">
                  Dentista <span className="text-coral">*</span>
                </Label>
                <Select
                  value={novoForm.dentistaId}
                  onValueChange={(v) => v && setNovoForm((f) => ({ ...f, dentistaId: v }))}
                >
                  <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                    <SelectValue>
                      {(v: string | null) =>
                        v
                          ? (dentistas.find((d) => d.id === v)?.nome ?? v)
                          : 'Selecione o dentista...'
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {dentistas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Busca de paciente com autocomplete */}
            <div className="space-y-2 relative">
              <Label htmlFor="patient-drawer" className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                Paciente <span className="text-coral">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/40 pointer-events-none" />
                <Input
                  id="patient-drawer"
                  placeholder="Buscar paciente pelo nome..."
                  value={novoForm.pacienteSearch}
                  autoComplete="off"
                  onChange={(e) => {
                    const v = e.target.value;
                    setNovoForm((f) => ({ ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }));
                    setShowSugestoes(true);
                    void buscarPacientes(v);
                  }}
                  onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                  className="rounded-xl bg-surface-alt border-border text-text-primary pl-10 focus:border-teal/40 transition-all"
                />
              </div>
              {showSugestoes && novoForm.pacienteSearch.trim().length >= 2 && (pacienteSugestoes.length > 0 || !novoForm.pacienteId) && (
                <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                  {pacienteSugestoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNovoForm((f) => ({
                          ...f,
                          pacienteSearch: p.nome,
                          pacienteId: p.id,
                          pacienteNome: p.nome,
                        }));
                        setShowSugestoes(false);
                        setPacienteSugestoes([]);
                      }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
                    >
                      {p.nome}
                    </button>
                  ))}
                  {!novoForm.pacienteId && (
                    <button
                      type="button"
                      onClick={() => void handleCriarPacienteRapidoNovo()}
                      disabled={criandoPacienteNovo}
                      className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 font-semibold text-teal hover:bg-teal/5 transition-colors disabled:opacity-60 ${pacienteSugestoes.length > 0 ? 'border-t border-border' : ''}`}
                    >
                      {criandoPacienteNovo
                        ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                        : <UserPlus className="w-4 h-4 shrink-0" />}
                      Cadastrar &ldquo;{novoForm.pacienteSearch.trim()}&rdquo; como novo paciente
                    </button>
                  )}
                </div>
              )}
              {novoForm.pacienteId && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 px-3 py-2.5 border border-teal/25 rounded-xl text-sm text-teal font-semibold"
                  style={{ background: 'color-mix(in srgb, var(--color-teal) 8%, var(--color-surface-alt))' }}
                >
                  <div className="w-6 h-6 rounded-lg bg-teal/20 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-teal" />
                  </div>
                  <span className="truncate">{novoForm.pacienteNome}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0 opacity-60" />
                </motion.div>
              )}
            </div>

            {/* ── Quando ──────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary/50 flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3" />
                Quando
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Data + Hora */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apt-date-drawer" className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                  Data
                </Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary/40 pointer-events-none" />
                  <Input
                    id="apt-date-drawer"
                    type="date"
                    value={novoForm.data}
                    onChange={(e) => setNovoForm((f) => ({ ...f, data: e.target.value }))}
                    className="rounded-xl bg-surface-alt border-border text-text-primary pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-time-drawer" className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                  Hora
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary/40 pointer-events-none" />
                  <Input
                    id="apt-time-drawer"
                    type="time"
                    value={novoForm.hora}
                    onChange={(e) => setNovoForm((f) => ({ ...f, hora: e.target.value }))}
                    className="rounded-xl bg-surface-alt border-border text-text-primary pl-9"
                  />
                </div>
              </div>
            </div>

            {/* ── Duração ─────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary/50 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Duração
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { value: '30',  label: '30',  sub: 'min' },
                { value: '45',  label: '45',  sub: 'min' },
                { value: '60',  label: '1h',  sub: '' },
                { value: '90',  label: '1h',  sub: '30m' },
                { value: '120', label: '2h',  sub: '' },
                { value: '180', label: '3h',  sub: '' },
                { value: '240', label: '4h',  sub: '' },
                { value: '300', label: '5h',  sub: '' },
                { value: '360', label: '6h',  sub: '' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNovoForm((f) => ({ ...f, duracao: opt.value }))}
                  className={`flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all ${
                    novoForm.duracao === opt.value
                      ? 'bg-teal/10 border-teal text-teal shadow-[0_0_0_3px_rgba(47,156,133,0.12)]'
                      : 'border-border text-text-secondary hover:border-teal/40 hover:text-teal bg-surface-alt'
                  }`}
                >
                  <span className="text-sm font-extrabold leading-tight">{opt.label}</span>
                  {opt.sub && <span className="text-[10px] font-semibold mt-0.5 opacity-60">{opt.sub}</span>}
                </button>
              ))}
            </div>

            {/* ── Notas ───────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary/50 flex items-center gap-1.5">
                <PenLine className="w-3 h-3" />
                Notas
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <textarea
              id="apt-notes-drawer"
              value={novoForm.observacoes}
              onChange={(e) => setNovoForm((f) => ({ ...f, observacoes: e.target.value }))}
              className="w-full bg-surface-alt border border-border rounded-2xl p-4 text-sm min-h-[88px] focus:ring-2 focus:ring-teal/15 focus:border-teal/30 transition-all resize-none text-text-primary placeholder:text-text-secondary/40"
              placeholder="Procedimento, observações clínicas..."
            />

            {/* Aviso de conflito */}
            {conflitoNovo && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Conflito de horário — já existe um agendamento nesse intervalo.</span>
              </div>
            )}

            {/* Resumo visual */}
            {novoForm.pacienteId && novoForm.data && novoForm.hora && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-teal/30 p-4 space-y-3"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 7%, var(--color-surface-alt))' }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal">Pronto para agendar</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal/15 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-teal" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{novoForm.pacienteNome}</p>
                    <p className="text-xs text-text-secondary font-mono mt-0.5">
                      {novoForm.data.split('-').reverse().join('/')} · {novoForm.hora} ·{' '}
                      {(() => { const m = parseInt(novoForm.duracao, 10); if (!m) return '–'; if (m < 60) return `${m}min`; const h = Math.floor(m / 60); const rem = m % 60; return rem ? `${h}h${rem}m` : `${h}h`; })()}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 px-6 py-5 border-t border-border space-y-3 bg-surface">
            {saveError && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2">{saveError}</p>
            )}
            <Button
              onClick={() => void handleCriarAgendamento()}
              disabled={isSaving}
              className="w-full bg-gradient-to-r from-teal to-teal-lt text-white rounded-2xl py-3 font-bold shadow-[0_8px_32px_rgba(47,156,133,0.40)] hover:shadow-[0_12px_40px_rgba(47,156,133,0.50)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Agendamento'
              )}
            </Button>
            <button
              onClick={() => { setIsNewModalOpen(false); resetForm(); }}
              className="w-full py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Cancel with motivo dialog ──────────────────────────────── */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => { if (!open) setCancelDialog(null); }}>
        <DialogContent className="rounded-2xl bg-surface border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-text-primary font-heading">Cancelar agendamento</DialogTitle>
            <DialogDescription>
              {cancelDialog?.aptNome && <span className="text-text-secondary text-sm">Paciente: <strong>{cancelDialog.aptNome}</strong></span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Motivo (opcional)</Label>
            <textarea
              value={cancelMotivo}
              onChange={e => setCancelMotivo(e.target.value)}
              placeholder="Ex: Paciente remarcou, emergência, etc."
              className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-text-primary placeholder:text-text-secondary/50"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => setCancelDialog(null)}>
              Voltar
            </Button>
            <Button
              className="rounded-xl flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={isCancelling}
              onClick={() => void handleCancelar()}
            >
              {isCancelling && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Atender agora (walk-in do dentista) ───────────────────── */}
      <AtenderAgoraModal open={isAtenderAgoraOpen} onOpenChange={setIsAtenderAgoraOpen} />

      {/* ── Encaixe / Walk-in drawer ──────────────────────────────── */}
      <Sheet open={isEncaixeOpen} onOpenChange={(open) => { if (!open) { setIsEncaixeOpen(false); setEncaixeConflito(false); setEncaixeError(null); }}}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="!w-full sm:!w-[480px] p-0 gap-0 flex flex-col bg-surface border-l border-border"
        >
          <SheetDescription className="sr-only">Criar encaixe para paciente sem agendamento prévio.</SheetDescription>

          {/* Header teal */}
          <div className="relative px-6 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <SheetTitle className="font-heading font-semibold text-xl text-white leading-tight">Encaixe</SheetTitle>
                  <p className="text-white/70 text-xs mt-0.5">Atendimento sem slot prévio — conflitos são sinalizados.</p>
                </div>
              </div>
              <SheetClose
                render={<button className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors" />}
              >
                <X className="w-4 h-4 text-white" />
              </SheetClose>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Erro geral — sempre no topo */}
            {encaixeError && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{encaixeError}</p>
            )}

            {/* Banner de conflito com ação forçar — preservar lógica exata */}
            {encaixeConflito && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Conflito de horário detectado</p>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">
                  Já existe um agendamento neste horário. Deseja forçar o encaixe mesmo assim?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg text-xs border-amber-300/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    onClick={() => setEncaixeConflito(false)}
                  >
                    Escolher outro horário
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg text-xs bg-amber-500 text-white hover:bg-amber-600"
                    onClick={() => void handleCriarEncaixe(true)}
                  >
                    Forçar encaixe
                  </Button>
                </div>
              </div>
            )}

            {/* Dentista — apenas secretária */}
            {isSecretaria && dentistas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Dentista</Label>
                <Select value={encaixeForm.dentistaId} onValueChange={v => v && setEncaixeForm(f => ({ ...f, dentistaId: v }))}>
                  <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {dentistas.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Busca de paciente com autocomplete */}
            <div className="space-y-2 relative">
              <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Paciente</Label>
              <Input
                placeholder="Digite o nome do paciente..."
                value={encaixeForm.pacienteSearch}
                autoComplete="off"
                onChange={e => {
                  const v = e.target.value;
                  setEncaixeForm(f => ({ ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }));
                  setShowEncaixeSugestoes(true);
                  void buscarEncaixePacientes(v);
                }}
                onBlur={() => setTimeout(() => setShowEncaixeSugestoes(false), 150)}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
              {showEncaixeSugestoes && encaixeForm.pacienteSearch.trim().length >= 2 && (encaixeSugestoes.length > 0 || !encaixeForm.pacienteId) && (
                <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                  {encaixeSugestoes.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setEncaixeForm(f => ({ ...f, pacienteSearch: p.nome, pacienteId: p.id, pacienteNome: p.nome })); setShowEncaixeSugestoes(false); }}
                      className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
                    >{p.nome}</button>
                  ))}
                  {!encaixeForm.pacienteId && (
                    <button
                      type="button"
                      onClick={() => void handleCriarPacienteRapidoEncaixe()}
                      disabled={criandoPacienteEncaixe}
                      className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 font-semibold text-teal hover:bg-teal/5 transition-colors disabled:opacity-60 ${encaixeSugestoes.length > 0 ? 'border-t border-border' : ''}`}
                    >
                      {criandoPacienteEncaixe
                        ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                        : <UserPlus className="w-4 h-4 shrink-0" />}
                      Cadastrar &ldquo;{encaixeForm.pacienteSearch.trim()}&rdquo; como novo paciente
                    </button>
                  )}
                </div>
              )}
              {encaixeForm.pacienteId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal/5 border border-teal/20 rounded-lg text-sm text-teal font-medium">
                  <User className="w-4 h-4 shrink-0" />{encaixeForm.pacienteNome}
                </div>
              )}
            </div>

            {/* Hora + Duração — SEM date picker (data é implícita do selectedDate) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Hora</Label>
                <Input
                  type="time"
                  value={encaixeForm.hora}
                  onChange={e => setEncaixeForm(f => ({ ...f, hora: e.target.value }))}
                  className="rounded-xl bg-surface-alt border-border text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Duração</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { value: '30',  label: '30m' },
                    { value: '45',  label: '45m' },
                    { value: '60',  label: '1h' },
                    { value: '90',  label: '1h30' },
                    { value: '120', label: '2h' },
                    { value: '180', label: '3h' },
                    { value: '240', label: '4h' },
                    { value: '300', label: '5h' },
                    { value: '360', label: '6h' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEncaixeForm((f) => ({ ...f, duracao: opt.value }))}
                      className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                        encaixeForm.duracao === opt.value
                          ? 'bg-teal/10 border-teal text-teal'
                          : 'border-border text-text-secondary hover:border-teal/40 hover:text-teal bg-surface-alt'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Data informativa — imutável, derivada do selectedDate */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-alt rounded-xl border border-border">
              <CalendarIcon className="w-4 h-4 text-teal shrink-0" />
              <span className="text-xs text-text-secondary">
                Data: <span className="font-semibold text-text-primary font-mono">{format(selectedDate, "dd/MM/yyyy")}</span>
                <span className="ml-1 text-text-secondary/70">(dia selecionado na agenda)</span>
              </span>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 p-4 border-t border-border space-y-2 bg-surface">
            <Button
              onClick={() => void handleCriarEncaixe(false)}
              disabled={encaixeSaving}
              className="w-full bg-gradient-to-r from-teal to-teal-lt text-white rounded-xl shadow-[0_4px_16px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
            >
              {encaixeSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar Encaixe
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIsEncaixeOpen(false); setEncaixeConflito(false); }}
              className="w-full rounded-xl border-border text-text-primary hover:bg-surface-alt"
            >
              Cancelar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal: Assinatura do paciente */}
      {assinaturaModal && (
        <AssinaturaRecepcaoModal
          open={!!assinaturaModal}
          onOpenChange={(open) => { if (!open) setAssinaturaModal(null); }}
          pacienteId={assinaturaModal.pacienteId}
          pacienteNome={assinaturaModal.pacienteNome}
          onSigned={() => {
            setAssinadosLocal(prev => new Set([...prev, assinaturaModal.aptId]));
          }}
        />
      )}

      {/* Modal: Detalhe do agendamento */}
      <Dialog
        open={isDetailModalOpen}
        onOpenChange={(open) => {
          if (!open) setDetailMode('view');
          setIsDetailModalOpen(open);
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl bg-surface border-border p-0 gap-0 overflow-hidden">
          {selectedApt && (
            <AnimatePresence mode="wait">

              {/* ── MODO: VISUALIZAÇÃO ─────────────────────────────── */}
              {detailMode === 'view' && (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <StatusBadge status={selectedApt.status as AgendamentoStatus} />
                      {selectedApt.paciente && (
                        <button
                          onClick={() => router.push(`/dashboard/pacientes/${selectedApt.paciente?.id}`)}
                          className="text-teal text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity shrink-0"
                        >
                          Ver Ficha <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <DialogTitle className="font-heading font-semibold text-xl text-text-primary leading-tight">
                      {selectedApt.paciente?.nome ?? '—'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Detalhes do agendamento clínico.</DialogDescription>
                  </div>

                  <div className="px-6 pb-4 space-y-3">
                    {/* Data e Hora */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-surface-alt rounded-xl border border-border">
                      <CalendarIcon className="w-4 h-4 text-teal shrink-0" />
                      <div>
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mb-0.5">Data e Hora</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {format(parseISO(selectedApt.data_hora), "dd/MM/yyyy 'às' HH:mm")}
                          <span className="text-text-secondary font-normal ml-2">· {selectedApt.duracao_minutos} min</span>
                        </p>
                      </div>
                    </div>

                    {/* Dentista — secretária */}
                    {isSecretaria && selectedApt.dentista && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-surface-alt rounded-xl border border-border">
                        <UserCog className="w-4 h-4 text-teal shrink-0" />
                        <div>
                          <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mb-0.5">Dentista</p>
                          <p className="text-sm font-semibold text-text-primary">{selectedApt.dentista.nome}</p>
                        </div>
                      </div>
                    )}

                    {/* Criado por — apenas se diferente do dentista */}
                    {selectedApt.criador && selectedApt.criador.id !== selectedApt.dentista_id && (
                      <div className="flex items-center gap-2 px-1 text-text-secondary">
                        <UserCheck className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="text-xs">
                          Criado por <span className="font-semibold text-text-primary">{selectedApt.criador.nome}</span>
                        </span>
                      </div>
                    )}

                    {/* Observações */}
                    {selectedApt.observacoes && (
                      <div className="px-4 py-3 bg-surface-alt rounded-xl border border-border">
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mb-1">Observações</p>
                        <p className="text-sm text-text-primary">{selectedApt.observacoes}</p>
                      </div>
                    )}

                    {/* Alterar Status — botões rotulados pras transições comuns; o
                        dropdown abaixo cobre os casos raros (reverter, forçar manualmente). */}
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Alterar Status</Label>
                      {(() => {
                        const st = selectedApt.status;
                        const isTerminal = ['cancelled', 'no_show', 'completed'].includes(st);
                        const quickActions = [
                          {
                            key: 'confirm', show: st === 'scheduled', label: 'Confirmar', Icon: ThumbsUp,
                            onClick: () => void handleStatusChange(selectedApt.id, 'confirmed'),
                            cls: 'bg-teal/15 text-teal border border-teal/30 hover:bg-teal/25',
                          },
                          {
                            key: 'checkin', show: st === 'scheduled' || st === 'confirmed', label: 'Chegou', Icon: CheckCircle2,
                            onClick: () => void handleStatusChange(selectedApt.id, 'checked_in'),
                            cls: 'bg-teal text-white border border-teal hover:bg-teal-lt',
                          },
                          {
                            key: 'noshow', show: st === 'scheduled' || st === 'confirmed', label: 'Faltou', Icon: AlertTriangle,
                            onClick: () => void handleNoShow(selectedApt.id),
                            cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20',
                          },
                          {
                            key: 'cancel', show: !isTerminal, label: 'Cancelar', Icon: X,
                            onClick: () => { setCancelDialog({ aptId: selectedApt.id, aptNome: selectedApt.paciente?.nome ?? '' }); setCancelMotivo(''); setIsDetailModalOpen(false); },
                            cls: 'bg-surface-alt text-text-secondary border border-border hover:text-text-primary',
                          },
                        ].filter(a => a.show);

                        return quickActions.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {quickActions.map(a => (
                              <button
                                key={a.key}
                                onClick={a.onClick}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${a.cls}`}
                              >
                                <a.Icon className="w-4 h-4 shrink-0" />
                                {a.label}
                              </button>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      <Select
                        value={selectedApt.status}
                        onValueChange={(val) => val && void handleStatusChange(selectedApt.id, val)}
                      >
                        <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-secondary text-xs h-9">
                          <SelectValue>Outro status: {STATUS_PT[selectedApt.status] ?? selectedApt.status}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          <SelectItem value="scheduled">Agendado</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="checked_in">Na Recepção</SelectItem>
                          <SelectItem value="in_progress">Em Atendimento</SelectItem>
                          <SelectItem value="completed">Realizado</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                          <SelectItem value="no_show">Faltou</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assinatura do paciente — secretária */}
                    {isSecretaria && (selectedApt.status === 'checked_in' || selectedApt.status === 'in_progress' || selectedApt.status === 'completed') && selectedApt.paciente && (
                      assinadosLocal.has(selectedApt.id) ? (
                        <div className="flex items-center gap-2 text-sm font-semibold text-teal bg-teal/10 rounded-xl px-4 py-3 border border-teal/20">
                          <CheckCircle2 className="w-4 h-4" /> Assinatura registrada
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssinaturaModal({ pacienteId: selectedApt.paciente!.id, pacienteNome: selectedApt.paciente!.nome, aptId: selectedApt.id })}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-teal/5 hover:text-teal hover:border-teal/30 transition-all"
                        >
                          <PenLine className="w-4 h-4" />
                          Solicitar Assinatura do Paciente
                        </button>
                      )
                    )}

                    {/* Mensagem via IA */}
                    {!['cancelled', 'no_show'].includes(selectedApt.status) && selectedApt.paciente && (
                      <div className="space-y-2.5">
                        <BotaoMensagemIA
                          variant="full"
                          pacienteNome={selectedApt.paciente.nome}
                          dentistaNome={selectedApt.dentista?.nome ?? ''}
                          dataHora={format(parseISO(selectedApt.data_hora), "dd/MM 'às' HH:mm")}
                          defaultTipo={
                            selectedApt.status === 'completed' ? 'follow_up'
                            : selectedApt.status === 'confirmed' ? 'lembrete'
                            : 'confirmacao'
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => setDetailMode('confirm-delete')}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors sm:mr-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                    <Button
                      variant="outline"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      Fechar
                    </Button>
                    <Button
                      onClick={enterEditMode}
                      className="bg-teal/10 text-teal hover:bg-teal/20 border border-teal/30 rounded-xl flex items-center gap-1.5"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                    {!isSecretaria && selectedApt.paciente && !['cancelled', 'no_show', 'completed'].includes(selectedApt.status) && (
                      <Button
                        onClick={() => router.push(`/consulta/${selectedApt.id}`)}
                        className="rounded-xl flex items-center gap-1.5 bg-gradient-to-r from-teal to-teal-lt text-white shadow-[0_4px_16px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
                      >
                        <Stethoscope className="w-4 h-4" />
                        {selectedApt.status === 'in_progress' ? 'Continuar atendimento' : 'Iniciar consulta'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── MODO: EDIÇÃO ────────────────────────────────────── */}
              {detailMode === 'edit' && (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-6 pt-6 pb-4">
                    <button
                      onClick={() => setDetailMode('view')}
                      className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-3 w-fit transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <DialogTitle className="font-heading font-semibold text-xl text-text-primary">
                      Editar Agendamento
                    </DialogTitle>
                    <DialogDescription className="text-text-secondary text-sm mt-0.5">
                      {selectedApt.paciente?.nome ?? '—'}
                    </DialogDescription>
                  </div>

                  <div className="px-6 pb-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Data</Label>
                        <Input
                          type="date"
                          value={editForm.data}
                          onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
                          className="rounded-xl bg-surface-alt border-border text-text-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Hora</Label>
                        <Input
                          type="time"
                          value={editForm.hora}
                          onChange={(e) => setEditForm((f) => ({ ...f, hora: e.target.value }))}
                          className="rounded-xl bg-surface-alt border-border text-text-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Duração</Label>
                      <Select
                        value={editForm.duracao}
                        onValueChange={(v) => v && setEditForm((f) => ({ ...f, duracao: v }))}
                      >
                        <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          <SelectItem value="15">15 min</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                          <SelectItem value="90">90 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {conflitoEdicao && (
                      <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Conflito de horário — já existe um agendamento nesse intervalo.</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Observações</Label>
                      <textarea
                        value={editForm.observacoes}
                        onChange={(e) => setEditForm((f) => ({ ...f, observacoes: e.target.value }))}
                        className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-teal/20 transition-all resize-none text-text-primary placeholder:text-text-secondary/50"
                        placeholder="Notas adicionais..."
                      />
                    </div>

                    {saveError && (
                      <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{saveError}</p>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDetailMode('view')}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => void handleSalvarEdicao()}
                      disabled={isSaving}
                      className="bg-gradient-to-r from-teal to-teal-lt text-white rounded-xl shadow-[0_4px_16px_rgba(47,156,133,0.3)] disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ── MODO: CONFIRMAR EXCLUSÃO ─────────────────────────── */}
              {detailMode === 'confirm-delete' && (
                <motion.div
                  key="confirm-delete"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-6 pt-6 pb-4">
                    <DialogTitle className="font-heading font-semibold text-xl text-text-primary">
                      Excluir Agendamento
                    </DialogTitle>
                    <DialogDescription className="text-text-secondary text-sm mt-0.5">
                      Esta ação não pode ser desfeita.
                    </DialogDescription>
                  </div>

                  <div className="px-6 pb-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-text-primary">
                      Deseja excluir o agendamento de{' '}
                      <strong>{selectedApt.paciente?.nome ?? 'este paciente'}</strong> em{' '}
                      <strong>
                        {format(parseISO(selectedApt.data_hora), "dd/MM/yyyy 'às' HH:mm")}
                      </strong>
                      ?
                    </div>
                    {saveError && (
                      <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3 mt-3">{saveError}</p>
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setDetailMode('view')}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      Não, manter
                    </Button>
                    <Button
                      onClick={() => void handleDeletar()}
                      disabled={isSaving}
                      className="bg-red-500 text-white hover:bg-red-600 rounded-xl disabled:opacity-50"
                    >
                      {isSaving ? 'Excluindo...' : 'Sim, excluir'}
                    </Button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// ─── ImportCalendarButton ─────────────────────────────────────────────────────

interface ImportCalendarButtonProps {
  isImporting: boolean;
  progress:    number;
  done:        boolean;
  onClick:     () => void;
}

function ImportCalendarButton({ isImporting, progress, done, onClick }: ImportCalendarButtonProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={isImporting}
        className={`
          relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-xl
          border text-sm font-semibold transition-all
          hover:-translate-y-0.5 active:scale-[0.98]
          ${done
            ? 'bg-teal/10 border-teal/30 text-teal'
            : 'bg-surface border-border text-text-secondary hover:border-teal/40 hover:text-teal'
          }
          disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100
        `}
        style={isImporting ? { boxShadow: '0 0 20px -5px rgba(47,156,133,0.3)' } : {}}
      >
        {/* Ícone */}
        {done ? (
          <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
        ) : isImporting ? (
          <Loader2 className="w-4 h-4 animate-spin text-teal shrink-0" />
        ) : (
          <CalendarDays className="w-4 h-4 shrink-0" />
        )}

        {/* Label */}
        <span className="whitespace-nowrap">
          {done
            ? 'Importado!'
            : isImporting
              ? 'Sincronizando...'
              : 'Importar do Google'}
        </span>

        {/* Barra de progresso embutida no botão */}
        {isImporting && (
          <span
            className="absolute bottom-0 left-0 h-[2px] bg-teal rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        )}
      </button>
    </div>
  );
}
