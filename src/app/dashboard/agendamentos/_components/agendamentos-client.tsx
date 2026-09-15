'use client';

import {
  Plus,
  Calendar as CalendarIcon,
  User,
  ExternalLink,
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
  X,
  ThumbsUp,
  UserPlus,
  CalendarClock,
  ChevronRight,
  Lock,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const AssinaturaRecepcaoModal = dynamic(
  () => import('@/components/fichas/AssinaturaRecepcaoModal').then(m => m.AssinaturaRecepcaoModal),
  { ssr: false }
);
import {
  buildClinicDatetime,
  diaAnteriorDeAgenda,
  janelaDaVisao,
  proximoDiaDeAgenda,
  type VisaoAgenda,
} from './date-helpers';
import type { DentistaAgenda } from './cor-dentista';
import { useState, useMemo, useCallback, useTransition, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PageContainer } from '@/components/layout/page-container';
import {
  format,
  addMonths,
  subMonths,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
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
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import type { AgendamentoRow, BloqueioRow, ForaDaJanela } from '../page';
import {
  atualizarStatusAgendamento,
  atualizarAgendamento,
  deletarAgendamento,
  criarAgendamento,
  importarEventosGoogle,
  marcarNoShow,
  cancelarComMotivo,
  criarEncaixe,
  criarPedidoProtetico,
  listarProteticosAtivos,
  type StatusAgendamento,
  type ProteticoOption,
} from '../actions';
import type { MotivoForaDoExpediente } from '@/lib/agenda/expediente';
import { criarPacienteRapido } from '@/app/dashboard/pacientes/[id]/actions';
import { createClient } from '@/lib/supabase/client';
import { normalizarNome } from '@/lib/normalizar-nome';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import type { DentistaRole, AgendamentoStatus } from '@/types/database';
import { toast } from 'sonner';
import { WeekView } from './week-view';
import { DayView } from './day-view';
import { MonthView } from './month-view';
import { AtenderAgoraModal } from './atender-agora-modal';
import { CompromissoPessoalDialog } from './compromisso-pessoal-dialog';
import { BotaoMensagemIA } from '@/components/orcamentos/botao-mensagem-ia';
import { StatusBadge } from './status-badge';

type AvisoAgenda = {
  conflitoDentista: boolean;
  foraDoExpediente?: MotivoForaDoExpediente;
};

const MENSAGEM_FORA_DO_EXPEDIENTE: Record<MotivoForaDoExpediente, string> = {
  antes_de_abrir: 'O horário começa antes da abertura configurada para este dentista.',
  depois_de_fechar: 'O atendimento termina depois do fechamento configurado para este dentista.',
  no_almoco: 'O atendimento coincide com o intervalo de almoço configurado para este dentista.',
  dia_sem_grade: 'Este dentista não tem expediente configurado para este dia.',
};

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
  /** R-102 — compromissos pessoais na mesma janela visível. */
  bloqueios: BloqueioRow[];
  clinicaId: string;
  role: DentistaRole;
  dentistaAtualId: string;
  /**
   * Lista de dentistas para filtro/form (apenas preenchida para secretária). Vem do servidor em
   * ordem de `created_at` — é essa ordem que fixa o slot de cor. Exibição em chip/select é
   * alfabética; ver `dentistasOrdenados`.
   */
  dentistas: DentistaAgenda[];
  /** Mapa dentistaId → GCal conectado (secretária) */
  calendarConnectedPerDentista: Record<string, boolean>;
  /** Clínica tem pelo menos uma secretária ativa */
  temSecretaria: boolean;
  /** Visão ativa — vem da URL (`?v=`), não de estado local. */
  visao: VisaoAgenda;
  /** Dia de referência da janela carregada, 'yyyy-MM-dd' — vem da URL (`?d=`). */
  ancora: string;
  /** Pode criar agendamentos: plano SOLO ou secretária */
  canEdit: boolean;
  /** Auto-abre o drawer de novo agendamento (via ?novo=1 na URL) */
  autoOpenNovo?: boolean;
  /** Agendamentos ativos além do mês exibido — null quando não há nenhum. */
  foraDaJanela: ForaDaJanela | null;
  /** Protéticos ativos da clínica — vazio esconde o bloco "Enviar pro protético" (R-94). */
  proteticos: { id: string; nome: string }[];
}

export function AgendamentosClient({
  agendamentos: inicial,
  bloqueios: bloqueiosIniciais,
  clinicaId: _clinicaId,
  role,
  dentistaAtualId,
  dentistas,
  calendarConnectedPerDentista,
  visao: visaoUrl,
  ancora,
  canEdit,
  autoOpenNovo = false,
  foraDaJanela,
  proteticos,
}: Props) {
  const router = useRouter();
  const isSecretaria = role === 'secretaria';
  // A lista inicial vem do Server Component; ao abrir um fluxo de pedido, a PWA a atualiza
  // pelo mesmo Server Action usado em “Marcar retorno”.
  const [proteticosAtivos, setProteticosAtivos] = useState<ProteticoOption[]>(proteticos);
  const recarregarProteticosAtivos = useCallback(async () => {
    try {
      const resultado = await listarProteticosAtivos();
      if (resultado.ok) setProteticosAtivos(resultado.data);
    } catch {
      // Mantém a lista inicial caso a atualização em segundo plano falhe.
    }
  }, []);

  /**
   * A semana é a visão inicial em qualquer dispositivo. A página já aplica
   * `VISAO_PADRAO = 'semana'` quando não há `?v=` na URL; depois que o dentista
   * escolhe Dia/Semana/Mês, `irPara` grava `?v=` e a escolha explícita continua
   * valendo tanto no celular quanto no desktop.
   *
   * Renomeado pra `visao` de propósito: o resto do arquivo (grade, atalhos de teclado,
   * `selectedDate`) continua lendo uma única fonte, sem uma preferência diferente por
   * breakpoint.
   */
  const visao: VisaoAgenda = visaoUrl;

  // A âncora é a fonte da data em toda a tela. `T12:00` de propósito: `parseISO('2026-08-05')`
  // devolve meia-noite local e, num fuso a leste, cai no dia 4.
  const ancoraDate = parseISO(`${ancora}T12:00:00`);
  const currentMonth = startOfMonth(ancoraDate);

  /**
   * TODA navegação de data passa por aqui, e por aqui passa pela URL.
   *
   * Era esse o bug: só as setas de MÊS avisavam o servidor. Semana e Dia mexiam em estado
   * local, então atravessar a virada do mês mostrava uma grade vazia — os dados do mês
   * seguinte nunca tinham sido buscados. Agora a janela carregada e a janela desenhada saem
   * do mesmo lugar, e não têm como divergir.
   */
  const [isPending, startTransition] = useTransition();
  const irPara = useCallback(
    (novaVisao: VisaoAgenda, novaAncora: Date | string) => {
      const d = typeof novaAncora === 'string' ? novaAncora : format(novaAncora, 'yyyy-MM-dd');
      startTransition(() => {
        router.push(`/dashboard/agendamentos?v=${novaVisao}&d=${d}`);
      });
    },
    [router],
  );

  const [agendamentos, setAgendamentos] = useState(inicial);
  const [bloqueios, setBloqueios] = useState(bloqueiosIniciais);

  /**
   * Dia em foco DENTRO da janela carregada — só a visão de Mês usa, pra listar o dia clicado
   * sem ir ao servidor (o mês inteiro já está em memória). Dia e Semana leem a âncora direto.
   */
  const [diaFocado, setDiaFocado] = useState<Date>(ancoraDate);
  useEffect(() => { setDiaFocado(parseISO(`${ancora}T12:00:00`)); }, [ancora]);

  // Na visão de Dia quem manda é a âncora; nas outras, o dia clicado no calendário.
  const selectedDate = visao === 'dia' ? ancoraDate : diaFocado;
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState<AgendamentoRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modo do modal de detalhe: visualização / edição / pedido ao protético / exclusão
  const [detailMode, setDetailMode] = useState<'view' | 'edit' | 'send-protetico' | 'confirm-delete'>('view');
  const [editForm, setEditForm] = useState({ data: '', hora: '', duracao: '30', observacoes: '' });
  const [pedidoProteticoForm, setPedidoProteticoForm] = useState({
    proteticoId: proteticosAtivos[0]?.id ?? '',
    dataEntrega: '',
    observacao: '',
  });

  // Assinatura do paciente na recepção
  const [assinadosLocal, setAssinadosLocal] = useState<Set<string>>(new Set());
  const [assinaturaModal, setAssinaturaModal] = useState<{
    pacienteId: string;
    pacienteNome: string;
    aptId: string;
  } | null>(null);

  // Filtro por dentista (somente secretária)
  const [filtroDentistaId, setFiltroDentistaId] = useState<string>('todos');

  // Dia destacado na grade cheia da Semana — só existe depois de um clique no mapa de
  // carga (spec §3.4). Trocar o chip manualmente limpa (ver os onClick dos chips abaixo).
  const [diaDestacado, setDiaDestacado] = useState<Date | null>(null);

  // Cor por dentista (spec §3.2) — mapa id → slot, na ordem que o servidor mandou
  // (created_at). A ordem do ARRAY não importa aqui; só a associação id→slot importa.
  const slotPorDentista = useMemo(
    () => Object.fromEntries(dentistas.map((d) => [d.id, d.slot])),
    [dentistas],
  );

  // Chip, select e o fallback de "dentista padrão" mostram/usam nome em ordem alfabética —
  // ordem de EXIBIÇÃO e ordem de COR são coisas diferentes (spec §5.2). Precisa vir ANTES
  // dos useState de formulário abaixo, que já usam o primeiro nome como default.
  const dentistasOrdenados = useMemo(
    () => [...dentistas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [dentistas],
  );

  // MANTÉM SINCRONIA: Garante que os dados locais reflitam o banco após F5 ou revalidatePath
  useEffect(() => {
    setAgendamentos(inicial);
  }, [inicial]);
  useEffect(() => {
    setBloqueios(bloqueiosIniciais);
  }, [bloqueiosIniciais]);

  // Multi-user: recarrega os agendamentos do mês.
  //
  // Bug relatado pela recepção (21/07): "conflita com um agendamento que não existe,
  // e o F5 resolve". A causa é esta lista — `conflitoNovo` calcula o aviso de conflito
  // em cima dela, e ela só era recarregada no `focus` da janela. Quem passa o dia na
  // mesma aba nunca via a agenda mudar: o dentista cancelava um horário e a recepção
  // continuava vendo o fantasma.
  const lastRefreshRef = useRef(Date.now());
  const recarregarAgendamentos = useCallback(async (forcar = false) => {
    if (!forcar && Date.now() - lastRefreshRef.current < 30_000) return;
    lastRefreshRef.current = Date.now();
    // MESMA janela que o servidor buscou. Antes isto recarregava o mês inteiro enquanto a
    // tela podia estar mostrando outra coisa — dois cálculos de janela em dois lugares, que
    // é como o defeito nasceu. Agora há um só, e ele mora em `janelaDaVisao`.
    const janela = janelaDaVisao(visao, ancora);
    const supabase = createClient();
    const [{ data, error }, { data: bloqueiosData, error: bloqueiosErr }] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, origem, observacoes, created_at, paciente:pacientes(id, nome, observacoes), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome), criador:dentistas!agendamentos_created_by_fkey(id, nome)')
        .eq('clinica_id', _clinicaId)
        .gte('data_hora', janela.de)
        .lt('data_hora', janela.ate)
        .order('data_hora'),
      // R-102 — mesma janela, RLS já restringe ao próprio dentista (ou aos dois, se secretária).
      supabase
        .from('agenda_bloqueios')
        .select('id, clinica_id, dentista_id, data_hora, duracao_minutos, titulo, criado_por, dentista:dentistas!agenda_bloqueios_dentista_id_fkey(id, nome)')
        .eq('clinica_id', _clinicaId)
        .gte('data_hora', janela.de)
        .lt('data_hora', janela.ate)
        .order('data_hora'),
    ]);
    // Antes o erro era engolido (`if (data)`) e a lista ficava velha em silêncio —
    // e é dela que sai o aviso de conflito. Falhar calado aqui é mentir na tela.
    if (error) {
      console.error('[agenda] recarregar falhou:', error.message);
      toast.error('Não foi possível atualizar a agenda. Recarregue a página.');
      return;
    }
    if (bloqueiosErr) {
      console.error('[agenda] recarregar bloqueios falhou:', bloqueiosErr.message);
      toast.error('O compromisso foi salvo, mas a agenda não pôde ser atualizada. Recarregue a página.');
      return;
    }
    if (data) setAgendamentos(data as unknown as AgendamentoRow[]);
    if (bloqueiosData) setBloqueios(bloqueiosData as unknown as BloqueioRow[]);
  }, [_clinicaId, visao, ancora]);

  useEffect(() => {
    const handler = () => { void recarregarAgendamentos(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [recarregarAgendamentos]);

  // O momento em que dado velho custa caro: abrir o formulário de novo agendamento.
  // Ignora o throttle de propósito — é uma requisição por abertura de modal.
  useEffect(() => {
    if (isNewModalOpen) void recarregarAgendamentos(true);
  }, [isNewModalOpen, recarregarAgendamentos]);

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
    dentistaId: dentistasOrdenados[0]?.id ?? '',
    // R-94 — pedido pro protético, opcional
    enviarProtetico: false,
    proteticoId: proteticosAtivos[0]?.id ?? '',
    dataEntregaProtetico: '',
    observacaoProtetico: '',
  });
  const [pacienteSugestoes, setPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [criandoPacienteNovo, setCriandoPacienteNovo] = useState(false);
  /** R-31a §3.2 — trava síncrona: pointerdown e o click de fallback (teclado) podem
   *  disparar o mesmo handler em sequência antes do re-render desabilitar o botão. */
  const criandoPacienteNovoRef = useRef(false);
  /** Avisos recuperáveis validados no servidor: conflito e/ou fora da grade do dentista. */
  const [avisoNovoAgendamento, setAvisoNovoAgendamento] = useState<AvisoAgenda | null>(null);
  const [avisoEdicao, setAvisoEdicao] = useState<AvisoAgenda | null>(null);

  // `visao` e a semana desenhada vêm da URL. Não existe mais estado local de navegação —
  // era exatamente a duplicação que deixava a grade e os dados discordarem.

  // Cancel dialog
  const [cancelDialog, setCancelDialog] = useState<{ aptId: string; aptNome: string } | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Walk-in "Atender agora" — busca/cria paciente e cai direto na consulta (#2)
  const [isAtenderAgoraOpen, setIsAtenderAgoraOpen] = useState(false);

  // Compromisso pessoal (R-102) — bloqueio sem paciente
  const [isCompromissoOpen, setIsCompromissoOpen] = useState(false);
  const [compromissoEditando, setCompromissoEditando] = useState<BloqueioRow | null>(null);

  // Walk-in / encaixe
  const [isEncaixeOpen, setIsEncaixeOpen] = useState(false);
  const [encaixeForm, setEncaixeForm] = useState({
    pacienteSearch: '',
    pacienteId: '',
    pacienteNome: '',
    hora: '09:00',
    duracao: '30',
    dentistaId: dentistasOrdenados[0]?.id ?? '',
  });
  const [encaixeSugestoes, setEncaixeSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [showEncaixeSugestoes, setShowEncaixeSugestoes] = useState(false);
  const [encaixeSaving, setEncaixeSaving] = useState(false);
  const [encaixeError, setEncaixeError] = useState<string | null>(null);
  const [encaixeConflito, setEncaixeConflito] = useState(false);
  const [criandoPacienteEncaixe, setCriandoPacienteEncaixe] = useState(false);
  /** R-31a §3.2 — mesma trava síncrona do fluxo de novo agendamento. */
  const criandoPacienteEncaixeRef = useRef(false);

  // Agendamentos filtrados pelo dentista selecionado (somente secretária)
  const agendamentosFiltrados = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return agendamentos;
    return agendamentos.filter((a) => a.dentista_id === filtroDentistaId);
  }, [agendamentos, isSecretaria, filtroDentistaId]);

  // True quando a secretária tem um dentista específico selecionado
  const isFiltered = isSecretaria && filtroDentistaId !== 'todos';

  /**
   * Colunas que o Dia deve desenhar (spec §3.3/§5.3). Length <= 1 → coluna única, e o Dia
   * nem sabe que existe filtro — ele só recebe o array pronto. Com "Todos" e >1 dentista
   * ativo, cada um vira uma coluna; senão, é a coluna do único dentista relevante.
   */
  const colunasParaDayView = useMemo(() => {
    if (!isSecretaria) return [];
    if (filtroDentistaId === 'todos') return dentistasOrdenados;
    const alvo = dentistas.find((d) => d.id === filtroDentistaId);
    return alvo ? [alvo] : [];
  }, [isSecretaria, filtroDentistaId, dentistasOrdenados, dentistas]);

  /**
   * Dado que o Dia recebe. Multi-coluna precisa ver TODOS os dentistas pra repartir por
   * coluna; nos outros casos, `agendamentosFiltrados` já está corretamente escopado (a um
   * dentista, ou a tudo quando só há um na clínica).
   */
  const agendamentosParaDayView = useMemo(() => {
    if (isSecretaria && filtroDentistaId === 'todos' && dentistasOrdenados.length > 1) return agendamentos;
    return agendamentosFiltrados;
  }, [isSecretaria, filtroDentistaId, dentistasOrdenados, agendamentos, agendamentosFiltrados]);

  // R-102 — mesmo filtro de dentista que `agendamentosFiltrados`/`agendamentosParaDayView`.
  const bloqueiosFiltrados = useMemo(() => {
    if (!isSecretaria || filtroDentistaId === 'todos') return bloqueios;
    return bloqueios.filter((b) => b.dentista_id === filtroDentistaId);
  }, [bloqueios, isSecretaria, filtroDentistaId]);

  const bloqueiosParaDayView = useMemo(() => {
    if (isSecretaria && filtroDentistaId === 'todos' && dentistasOrdenados.length > 1) return bloqueios;
    return bloqueiosFiltrados;
  }, [isSecretaria, filtroDentistaId, dentistasOrdenados, bloqueios, bloqueiosFiltrados]);

  // Dias do calendário para o mês atual
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = addDays(startOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }), 5);
    return eachDayOfInterval({ start, end })
      .filter((date) => date.getDay() !== 0)
      .map((date) => ({
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

  // R-102 — compromissos pessoais do dia selecionado, mesmo filtro do Mês.
  const bloqueiosDoDiaSelecionado = useMemo(
    () =>
      bloqueiosFiltrados
        .filter((b) => isSameDay(parseISO(b.data_hora), selectedDate))
        .sort((a, b) => a.data_hora.localeCompare(b.data_hora)),
    [bloqueiosFiltrados, selectedDate]
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

  /**
   * Dentista que o formulário assume por padrão.
   *
   * BUG CORRIGIDO 21/07: era sempre `dentistas[0]`, sem olhar o filtro da grade. A
   * secretária filtrava pra ver o Dr. X, via um horário livre, abria "Novo Agendamento"
   * — e o drawer vinha apontando pro PRIMEIRO dentista da lista. O servidor então
   * checava a agenda de OUTRA pessoa e recusava por conflito que ela não conseguia ver
   * na tela ("conflita com outro agendamento" num horário visivelmente vazio).
   *
   * Regra: se há um dentista filtrado, é ele. A tela e o formulário passam a falar
   * do mesmo profissional.
   *
   * `useCallback` e não função solta: o atalho de teclado "N" fecha sobre esta função
   * dentro de um useEffect. Sem memo estável + deps corretas, o atalho capturaria o
   * filtro de quando o listener foi montado — o mesmo bug pela porta dos fundos.
   */
  const dentistaPadraoForm = useCallback(
    () => (isSecretaria && filtroDentistaId !== 'todos' ? filtroDentistaId : dentistasOrdenados[0]?.id) ?? '',
    [isSecretaria, filtroDentistaId, dentistasOrdenados],
  );

  /**
   * Abre o "Novo Agendamento" — sem argumento, aponta pro dentista que está na tela
   * (comportamento de sempre). Com `pre`, chega pré-preenchido com dia/hora/dentista —
   * é o que o clique no espaço vazio da grade usa (spec §3.5/§5.4): a recepção clica
   * na quinta às 14h e o drawer já abre lá, sem digitar nada.
   *
   * Precisa existir separado do `resetForm` porque o reset roda ao FECHAR: sem isto,
   * trocar o filtro e reabrir o drawer traria o dentista da vez anterior.
   */
  const abrirNovoAgendamento = useCallback((pre?: { data?: string; hora?: string; dentistaId?: string }) => {
    void recarregarProteticosAtivos();
    setSaveError(null);
    setAvisoNovoAgendamento(null);
    setNovoForm((f) => ({
      ...f,
      ...(pre?.data ? { data: pre.data } : {}),
      ...(pre?.hora ? { hora: pre.hora } : {}),
      dentistaId: pre?.dentistaId ?? dentistaPadraoForm(),
    }));
    setIsNewModalOpen(true);
  }, [dentistaPadraoForm, recarregarProteticosAtivos]);

  // Clique no espaço vazio da grade (Dia ou Semana) — mesmo handler pras duas, o `dentistaId`
  // só chega preenchido quando a coluna clicada tem dono conhecido (spec §3.5).
  const handleSlotVazioClick = useCallback((data: Date, hora: string, dentistaId?: string) => {
    abrirNovoAgendamento({ data: format(data, 'yyyy-MM-dd'), hora, dentistaId });
  }, [abrirNovoAgendamento]);

  // Clique numa célula do mapa de carga (spec §3.4): troca o filtro pro dentista da
  // célula e destaca o dia — NÃO navega de rota, a Semana continua sendo a Semana.
  const handleCargaClick = useCallback((dentistaId: string, dia: Date) => {
    setFiltroDentistaId(dentistaId);
    setDiaDestacado(dia);
  }, []);

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
          if (!modalOpen && canEdit) { e.preventDefault(); abrirNovoAgendamento(); }
          break;
        case 'e':
        case 'E':
          if (!modalOpen && canEdit && isSecretaria) {
            e.preventDefault();
            setEncaixeForm((f) => ({ ...f, dentistaId: dentistaPadraoForm() }));
            setIsEncaixeOpen(true);
          }
          break;
        case 't':
        case 'T':
          // "Hoje" agora recarrega a janela: se a recepção estava em agosto, voltar pra hoje
          // sem avisar o servidor traria a grade de julho sem dado nenhum.
          if (!modalOpen) { e.preventDefault(); irPara(visao, new Date()); }
          break;
        case 'ArrowLeft':
          if (!modalOpen && visao === 'dia') {
            e.preventDefault();
            irPara('dia', diaAnteriorDeAgenda(ancoraDate));
          }
          break;
        case 'ArrowRight':
          if (!modalOpen && visao === 'dia') {
            e.preventDefault();
            irPara('dia', proximoDiaDeAgenda(ancoraDate));
          }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isNewModalOpen, isDetailModalOpen, isEncaixeOpen, cancelDialog, assinaturaModal, canEdit, visao, ancoraDate, irPara, isSecretaria, abrirNovoAgendamento, dentistaPadraoForm]);

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
        .ilike('nome_busca', `%${normalizarNome(nome)}%`)
        .limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) setPacienteSugestoes(data ?? []);
    }, 300);
  }, []);

  // Cadastro rápido — busca não achou; cria só com o nome e já seleciona pro
  // agendamento. Vincula ao dentista-alvo (não a quem está logado) pra secretária
  // conseguir agendar pra outro profissional e ele achar o paciente depois.
  const handleCriarPacienteRapidoNovo = async (confirmarMesmoAssim = false) => {
    if (criandoPacienteNovoRef.current) return;
    const nome = novoForm.pacienteSearch.trim();
    if (!nome) return;
    criandoPacienteNovoRef.current = true;
    setCriandoPacienteNovo(true);
    const dentistaAlvo = isSecretaria ? novoForm.dentistaId : dentistaAtualId;
    const res = await criarPacienteRapido({ nome, telefone: null, dentistaId: dentistaAlvo || undefined, confirmarMesmoAssim });
    criandoPacienteNovoRef.current = false;
    setCriandoPacienteNovo(false);
    // R-31a §3.1 — avisa, não bloqueia: mesma checagem do cadastro completo (G5).
    if (res.duplicatas?.length) {
      const d = res.duplicatas[0];
      toast(`Já existe um paciente chamado "${d.nome}"`, {
        description: 'É a mesma pessoa? Selecione-o na busca, ou confirme pra cadastrar outro.',
        action: { label: 'Cadastrar mesmo assim', onClick: () => void handleCriarPacienteRapidoNovo(true) },
      });
      return;
    }
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
      dentistaId: dentistaPadraoForm(),
      enviarProtetico: false,
      proteticoId: proteticosAtivos[0]?.id ?? '',
      dataEntregaProtetico: '',
      observacaoProtetico: '',
    });
    setPacienteSugestoes([]);
    setShowSugestoes(false);
    setSaveError(null);
    setAvisoNovoAgendamento(null); // senão o aviso reaparece no próximo agendamento
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
        // Era uma TERCEIRA cópia da mesma busca, com a janela montada sem o offset da clínica
        // (`yyyy-MM-dd'T'00:00:00` cru, que o Postgres lê como UTC) e engolindo erro. Reusa a
        // função que já faz isso certo: uma janela, um lugar.
        if (result.imported > 0) await recarregarAgendamentos(true);
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

  // Cria novo agendamento via server action.
  // O usuário confirma explicitamente cada alerta que o servidor devolveu.
  const handleCriarAgendamento = async (forcar = false) => {
    if (!novoForm.pacienteId) {
      setSaveError('Selecione um paciente.');
      return;
    }
    if (isSecretaria && !novoForm.dentistaId) {
      setSaveError('Selecione um dentista.');
      return;
    }
    if (novoForm.enviarProtetico) {
      if (!novoForm.proteticoId) { setSaveError('Selecione o protético.'); return; }
      if (!novoForm.dataEntregaProtetico) { setSaveError('Escolha a data de entrega do protético.'); return; }
      if (!novoForm.observacaoProtetico.trim()) { setSaveError('Descreva o que o protético precisa saber.'); return; }
    }
    setSaveError(null);
    if (!forcar) setAvisoNovoAgendamento(null);
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
      ...(forcar ? { forcarConflitoDentista: true, forcarForaDoExpediente: true } : {}),
    });

    if (result.error) {
      setSaveError(result.error);
      // Conflito do dentista e fora do expediente são recuperáveis. Conflito do paciente
      // continua sem override e, por isso, não recebe este painel.
      setAvisoNovoAgendamento(
        result.conflitoDentista || result.foraDoExpediente
          ? { conflitoDentista: result.conflitoDentista === true, foraDoExpediente: result.foraDoExpediente }
          : null,
      );
    } else {
      setAvisoNovoAgendamento(null);

      // R-94 — pedido pro protético, best-effort: o agendamento já foi criado com
      // sucesso; se isto falhar, avisa mas não desfaz nem trava o fluxo principal.
      if (novoForm.enviarProtetico && result.id) {
        const pedidoResult = await criarPedidoProtetico({
          pacienteId:    novoForm.pacienteId,
          proteticoId:   novoForm.proteticoId,
          observacao:    novoForm.observacaoProtetico.trim(),
          dataEntrega:   novoForm.dataEntregaProtetico,
          agendamentoId: result.id,
          ...(isSecretaria && novoForm.dentistaId ? { dentistaId: novoForm.dentistaId } : {}),
        });
        if (pedidoResult.error) {
          toast.error(`Agendamento criado, mas o pedido pro protético falhou: ${pedidoResult.error}`);
        } else {
          toast.success('Enviado pro protético!');
        }
      }

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
      // Vai pro dia do agendamento criado — pela URL, não só mudando o foco local.
      // A recepção marca em agosto olhando a semana de julho o tempo todo: sem recarregar a
      // janela, ela acabou de criar algo que a tela não tem como mostrar.
      irPara(visao, new Date(ano, mes - 1, dia));
    }
    setIsSaving(false);
  };

  const handleOpenDetail = useCallback((apt: AgendamentoRow) => {
    void recarregarProteticosAtivos();
    setSelectedApt(apt);
    setDetailMode('view');
    setSaveError(null);
    setIsDetailModalOpen(true);
  }, [recarregarProteticosAtivos]);

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
    setAvisoEdicao(null);
    setDetailMode('edit');
  };

  const enterEnviarProteticoMode = () => {
    setPedidoProteticoForm({
      proteticoId: proteticosAtivos[0]?.id ?? '',
      dataEntrega: '',
      observacao: '',
    });
    setSaveError(null);
    setDetailMode('send-protetico');
  };

  const handleEnviarProtetico = async () => {
    if (!selectedApt?.paciente) return;
    if (!pedidoProteticoForm.proteticoId) {
      setSaveError('Selecione o protético.');
      return;
    }
    if (!pedidoProteticoForm.dataEntrega) {
      setSaveError('Escolha a data de entrega do protético.');
      return;
    }
    if (!pedidoProteticoForm.observacao.trim()) {
      setSaveError('Descreva o que o protético precisa saber.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    const result = await criarPedidoProtetico({
      pacienteId: selectedApt.paciente.id,
      proteticoId: pedidoProteticoForm.proteticoId,
      observacao: pedidoProteticoForm.observacao.trim(),
      dataEntrega: pedidoProteticoForm.dataEntrega,
      agendamentoId: selectedApt.id,
      ...(isSecretaria ? { dentistaId: selectedApt.dentista_id } : {}),
    });
    setIsSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    toast.success('Enviado pro protético!');
    setDetailMode('view');
  };

  const handleSalvarEdicao = async (forcar = false) => {
    if (!selectedApt) return;
    setSaveError(null);
    if (!forcar) setAvisoEdicao(null);
    setIsSaving(true);

    // Timestamp explicitamente em BRT (UTC-3) — independente do timezone do browser
    const dataHora = buildClinicDatetime(editForm.data, editForm.hora);

    const result = await atualizarAgendamento(selectedApt.id, {
      dataHora,
      duracaoMinutos: parseInt(editForm.duracao, 10) || 30,
      observacoes: editForm.observacoes.trim() || null,
      ...(forcar ? { forcarConflitoDentista: true, forcarForaDoExpediente: true } : {}),
    });

    if (result.error) {
      setSaveError(result.error);
      setAvisoEdicao(
        result.conflitoDentista || result.foraDoExpediente
          ? { conflitoDentista: result.conflitoDentista === true, foraDoExpediente: result.foraDoExpediente }
          : null,
      );
    } else {
      setAvisoEdicao(null);
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
        .from('pacientes').select('id, nome').ilike('nome_busca', `%${normalizarNome(nome)}%`).limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) setEncaixeSugestoes(data ?? []);
    }, 300);
  }, []);

  const handleCriarPacienteRapidoEncaixe = async (confirmarMesmoAssim = false) => {
    if (criandoPacienteEncaixeRef.current) return;
    const nome = encaixeForm.pacienteSearch.trim();
    if (!nome) return;
    criandoPacienteEncaixeRef.current = true;
    setCriandoPacienteEncaixe(true);
    const dentistaAlvo = isSecretaria ? encaixeForm.dentistaId : dentistaAtualId;
    const res = await criarPacienteRapido({ nome, telefone: null, dentistaId: dentistaAlvo || undefined, confirmarMesmoAssim });
    criandoPacienteEncaixeRef.current = false;
    setCriandoPacienteEncaixe(false);
    // R-31a §3.1 — mesma checagem do cadastro completo (G5).
    if (res.duplicatas?.length) {
      const d = res.duplicatas[0];
      toast(`Já existe um paciente chamado "${d.nome}"`, {
        description: 'É a mesma pessoa? Selecione-o na busca, ou confirme pra cadastrar outro.',
        action: { label: 'Cadastrar mesmo assim', onClick: () => void handleCriarPacienteRapidoEncaixe(true) },
      });
      return;
    }
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
    setEncaixeForm({ pacienteSearch: '', pacienteId: '', pacienteNome: '', hora: '09:00', duracao: '30', dentistaId: dentistaPadraoForm() });
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

        <div className="flex items-center gap-3 flex-wrap xl:flex-nowrap">
          {/* Filtro por dentista — tabs para secretária */}
          {isSecretaria && dentistas.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => { setFiltroDentistaId('todos'); setDiaDestacado(null); }}
                className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filtroDentistaId === 'todos'
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                Todos
              </button>
              {dentistasOrdenados.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setFiltroDentistaId(d.id); setDiaDestacado(null); }}
                  className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
            {/* Trocar de visão troca a JANELA, então vai pela URL como o resto da navegação.
                A âncora é preservada: quem está em 5 de agosto e clica em "Mês" vê agosto,
                não o mês de hoje. */}
            <button
              onClick={() => irPara('dia', selectedDate)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                visao === 'dia' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              Dia
            </button>
            <button
              onClick={() => irPara('semana', selectedDate)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                visao === 'semana' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              onClick={() => irPara('mes', selectedDate)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                visao === 'mes' ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Mês
            </button>
          </div>

          {/* Ir para uma data — pra distância grande (mês que vem, ano que vem) sem repetir
              clique de seta. O seletor nativo já resolve mês/ano; não construímos stepper. */}
          <div className="relative">
            <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary/50 pointer-events-none" />
            <Input
              type="date"
              aria-label="Ir para uma data"
              value={ancora}
              onChange={(e) => e.target.value && irPara(visao, e.target.value)}
              className="h-11 w-[9.5rem] pl-8 text-xs font-semibold rounded-xl bg-surface-alt border-border text-text-primary cursor-pointer"
            />
          </div>

          {/* Atender agora — walk-in do dentista: cai direto na consulta (#2) */}
          {!isSecretaria && (
            <button
              onClick={() => setIsAtenderAgoraOpen(true)}
              className="min-h-11 bg-teal text-white hover:bg-teal-lt active:scale-[0.98] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-md"
            >
              <Stethoscope className="w-4 h-4" />
              Atender agora
            </button>
          )}

          {/* Encaixe — secretária */}
          {canEdit && isSecretaria && (
            <button
              onClick={() => {
                setEncaixeForm((f) => ({ ...f, dentistaId: dentistaPadraoForm() }));
                setIsEncaixeOpen(true);
              }}
              className="min-h-11 border border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary active:scale-[0.98] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all group"
            >
              <Stethoscope className="w-4 h-4" />
              Encaixe
              <kbd className="hidden sm:flex font-mono text-[10px] bg-surface-alt rounded px-1 py-0.5 leading-none group-hover:bg-surface transition-colors border border-border/60">E</kbd>
            </button>
          )}

          {/* Compromisso pessoal (R-102) — bloqueia a própria agenda, sem paciente.
              Dentista solo também precisa (não é só ferramenta de secretária). */}
          {canEdit && (
            <button
              onClick={() => { setCompromissoEditando(null); setIsCompromissoOpen(true); }}
              className="min-h-11 border border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary active:scale-[0.98] px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all"
            >
              <Lock className="w-4 h-4" />
              Compromisso pessoal
            </button>
          )}

          {/* Novo Agendamento — plano SOLO ou secretária */}
          {canEdit && (
            <button
              onClick={() => abrirNovoAgendamento()}
              className="min-h-11 bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_8px_32px_rgba(47,156,133,0.38)] hover:-translate-y-0.5 active:scale-[0.98] w-full sm:w-auto group"
            >
              <Plus className="w-4 h-4" />
              Novo Agendamento
              <kbd className="hidden sm:flex font-mono text-[10px] bg-white/15 rounded px-1 py-0.5 leading-none group-hover:bg-white/20 transition-colors">N</kbd>
            </button>
          )}
        </div>
      </motion.header>

      {/* ── Fora da janela ────────────────────────────────────────────────
          A agenda mostra um mês por vez: o que cai fora fica invisível. Foi assim que um
          retorno marcado em 28/04 pra 14/05 passou 3 meses sem ninguém ver. O toast de
          "Marcar retorno" avisa e some — isto é o que dá descoberta depois.
          Fica acima das views porque vale nos 3 modos, e some sozinho quando não há nada
          fora do mês (numa clínica que só agenda pra semana que vem, ninguém vê isso). */}
      {foraDaJanela && (
        <motion.button
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => irPara('mes', foraDaJanela.proximaAncora)}
          className="min-h-11 w-full flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-xl border border-border bg-surface-alt/60 hover:bg-surface-alt hover:border-teal/40 transition-colors group text-left"
        >
          <span className="flex items-center gap-2 text-xs text-text-secondary">
            <CalendarClock className="w-3.5 h-3.5 text-teal flex-shrink-0" />
            <span>
              <span className="font-bold text-text-primary">
                {foraDaJanela.total} {foraDaJanela.total === 1 ? 'agendamento' : 'agendamentos'}
              </span>
              {' '}depois deste mês — o próximo em{' '}
              <span className="font-bold text-text-primary">
                {format(parseISO(foraDaJanela.proximaData), "d 'de' MMMM", { locale: ptBR })}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-teal flex-shrink-0 group-hover:gap-1.5 transition-all">
            Ver
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </motion.button>
      )}

      {/* ── Views ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
      {visao === 'dia' && (
        <motion.div
          key="day"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="h-auto overflow-visible rounded-3xl border border-border bg-surface shadow-sm md:h-[560px] md:overflow-hidden lg:h-[680px]"
        >
          <DayView
            agendamentos={agendamentosParaDayView}
            bloqueios={bloqueiosParaDayView}
            selectedDate={selectedDate}
            onDateChange={(d) => irPara('dia', d)}
            onAppointmentClick={handleOpenDetail}
            onBloqueioClick={(bl) => { setCompromissoEditando(bl); setIsCompromissoOpen(true); }}
            isSecretaria={isSecretaria}
            isFiltered={isFiltered}
            onConfirm={(id) => void handleStatusChange(id, 'confirmed')}
            onCheckIn={(id) => void handleStatusChange(id, 'checked_in')}
            onNoShow={(id) => void handleNoShow(id)}
            onCancel={(apt) => { setCancelDialog({ aptId: apt.id, aptNome: apt.paciente?.nome ?? '' }); setCancelMotivo(''); }}
            onVerFicha={(pacienteId) => router.push(`/dashboard/pacientes/${pacienteId}`)}
            slotPorDentista={slotPorDentista}
            colunas={colunasParaDayView}
            onSlotVazioClick={handleSlotVazioClick}
          />
        </motion.div>
      )}

      {visao === 'semana' && (
        <motion.div
          key="week"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden"
        >
          <WeekView
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            selectedWeek={ancoraDate}
            onWeekChange={(d) => irPara('semana', d)}
            onAppointmentClick={handleOpenDetail}
            onBloqueioClick={(bl) => { setCompromissoEditando(bl); setIsCompromissoOpen(true); }}
            onDayClick={(d) => irPara('dia', d)}
            isSecretaria={isSecretaria}
            slotPorDentista={slotPorDentista}
            filtroDentistaId={filtroDentistaId}
            dentistas={dentistas}
            diaDestacado={diaDestacado}
            onSlotVazioClick={handleSlotVazioClick}
            onCargaClick={handleCargaClick}
          />
        </motion.div>
      )}

      {visao === 'mes' && (
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
          // Clicar num dia do calendário não recarrega: o mês inteiro já está em memória.
          onDaySelect={setDiaFocado}
          isPending={isPending}
          onPrevMonth={() => irPara('mes', subMonths(currentMonth, 1))}
          onNextMonth={() => irPara('mes', addMonths(currentMonth, 1))}
          todayCount={agendamentosFiltrados.filter((a) => isDateToday(parseISO(a.data_hora))).length}
          selectedDayCount={filteredAppointments.length}
          appointments={filteredAppointments}
          bloqueios={bloqueiosDoDiaSelecionado}
          onBloqueioClick={(bl) => { setCompromissoEditando(bl); setIsCompromissoOpen(true); }}
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
          onNewAppointment={abrirNovoAgendamento}
          onVerFicha={(pacienteId) => router.push(`/dashboard/pacientes/${pacienteId}`)}
          onStartConsulta={(aptId) => router.push(`/dashboard/meu-dia?ag=${aptId}`)}
          onRequestAssinatura={(pacienteId, nome, aptId) =>
            setAssinaturaModal({ pacienteId, pacienteNome: nome, aptId })
          }
          assinadosIds={assinadosLocal}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Modal: Novo Agendamento (R-27b) — era Sheet lateral de 560px, coluna única.
          Achado do Mateus 29/07: preenche nome e data, e "tem que rolar pra baixo pra
          clicar" em Salvar — o atrito era o formulário empilhado, não o botão (o rodapé
          já era fixo). Vira Dialog largo, mesma anatomia do orçamento/agendamento:
          cabeçalho com canto reservado, faixa ao vivo, coluna de ação fixa. */}
      <Dialog open={isNewModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsNewModalOpen(open); }}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border bg-surface p-0 md:max-h-[calc(100dvh-2rem)] md:w-auto md:max-w-[880px]"
        >
          <DialogDescription className="sr-only">Preencha os dados para marcar uma nova consulta.</DialogDescription>

          {/* ── Cabeçalho ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 md:px-6">
            <DialogTitle className="font-heading font-semibold text-xl text-text-primary leading-tight">
              Novo agendamento
            </DialogTitle>
            <button
              onClick={() => { setIsNewModalOpen(false); resetForm(); }}
              aria-label="Fechar"
              className="h-11 w-11 shrink-0 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Faixa ao vivo ─────────────────────────────────────────────
              Substitui o card "Pronto para agendar" que ficava no FIM do formulário —
              agora preenche em tempo real no topo, sem exigir rolar até o fim pra
              conferir o que está sendo criado. */}
          <div className="grid grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-4">
            <div className="bg-surface px-4 py-3 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Paciente</p>
              <p className="text-sm font-medium text-text-primary mt-0.5 truncate">{novoForm.pacienteNome || '—'}</p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Data</p>
              <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                {novoForm.data ? novoForm.data.split('-').reverse().join('/') : '—'}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Hora</p>
              <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">{novoForm.hora || '—'}</p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Duração</p>
              <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                {(() => {
                  const m = parseInt(novoForm.duracao, 10);
                  if (!m) return '—';
                  if (m < 60) return `${m}min`;
                  const h = Math.floor(m / 60); const rem = m % 60;
                  return rem ? `${h}h${rem}m` : `${h}h`;
                })()}
              </p>
            </div>
          </div>

          {/* ── Corpo: 2 colunas ──────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            <div className="contents md:block md:min-w-0 md:flex-1 md:max-h-[58vh] md:space-y-5 md:overflow-y-auto md:p-6">

              {/* Dentista — apenas secretária */}
              {isSecretaria && dentistas.length > 0 && (
                <div className="order-1 space-y-2 p-4 md:p-0">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                    Dentista <span className="text-coral-ink">*</span>
                  </Label>
                  <Select
                    value={novoForm.dentistaId}
                    onValueChange={(v) => v && setNovoForm((f) => ({ ...f, dentistaId: v }))}
                  >
                    <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                      <SelectValue>
                        {(v: string | null) =>
                          v
                            ? (dentistas.find((d) => d.id === v)?.nome ?? 'Dentista indisponível')
                            : 'Selecione o dentista...'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {dentistasOrdenados.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Busca de paciente com autocomplete */}
              <div className="relative order-1 space-y-2 p-4 pt-0 md:p-0">
                <Label htmlFor="patient-drawer" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                  Paciente <span className="text-coral-ink">*</span>
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
                      setNovoForm((f) => (
                        // R-31a §3.2 — digitar só invalida a seleção se o texto mudar de
                        // fato em relação ao nome confirmado; não zera a cada tecla.
                        f.pacienteId && v === f.pacienteNome
                          ? { ...f, pacienteSearch: v }
                          : { ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }
                      ));
                      setShowSugestoes(true);
                      void buscarPacientes(v);
                    }}
                    onBlur={() => setShowSugestoes(false)}
                    className="rounded-xl bg-surface-alt border-border text-text-primary pl-10 focus:border-teal/40 transition-all"
                  />
                </div>
                {showSugestoes && novoForm.pacienteSearch.trim().length >= 2 && (pacienteSugestoes.length > 0 || !novoForm.pacienteId) && (
                  <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                    {pacienteSugestoes.map((p) => {
                      const selecionar = () => {
                        setNovoForm((f) => ({
                          ...f,
                          pacienteSearch: p.nome,
                          pacienteId: p.id,
                          pacienteNome: p.nome,
                        }));
                        setShowSugestoes(false);
                        setPacienteSugestoes([]);
                      };
                      return (
                        <button
                          key={p.id}
                          type="button"
                          // R-31a §3.2 — confirma no pointerdown (antes do blur fechar a
                          // lista), não no click; onClick fica só de fallback pro teclado.
                          onPointerDown={(e) => { e.preventDefault(); selecionar(); }}
                          onClick={selecionar}
                          className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
                        >
                          {p.nome}
                        </button>
                      );
                    })}
                    {!novoForm.pacienteId && (
                      <button
                        type="button"
                        onPointerDown={(e) => { e.preventDefault(); void handleCriarPacienteRapidoNovo(); }}
                        onClick={() => void handleCriarPacienteRapidoNovo()}
                        disabled={criandoPacienteNovo}
                        className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-2 font-semibold text-teal-ink hover:bg-teal/5 transition-colors disabled:opacity-60 ${pacienteSugestoes.length > 0 ? 'border-t border-border' : ''}`}
                      >
                        {criandoPacienteNovo
                          ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                          : <UserPlus className="w-4 h-4 shrink-0" />}
                        Cadastrar &ldquo;{novoForm.pacienteSearch.trim()}&rdquo; como novo paciente
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="order-3 space-y-2 p-4 pt-0 md:p-0">
                <Label htmlFor="apt-notes-drawer" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                  Observações
                </Label>
                <textarea
                  id="apt-notes-drawer"
                  value={novoForm.observacoes}
                  onChange={(e) => setNovoForm((f) => ({ ...f, observacoes: e.target.value }))}
                  className="w-full bg-surface-alt border border-border rounded-xl p-3.5 text-sm min-h-[88px] focus:ring-2 focus:ring-teal/15 focus:border-teal/30 transition-all resize-none text-text-primary placeholder:text-text-secondary/40"
                  placeholder="Procedimento, observações clínicas..."
                />
              </div>

              {/* R-94 — pedido pro protético, opcional. Some se a clínica não tem
                  protético cadastrado: sem isso o dentista veria caixa morta (spec §5). */}
              {proteticosAtivos.length > 0 && (
                <div className="order-4 mx-4 mb-4 overflow-hidden rounded-2xl border border-teal/30 md:mx-0 md:mb-0">
                  <div className="flex items-center justify-between gap-3.5 p-3.5 bg-teal/5">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Enviar pro protético</p>
                      <p className="text-xs text-text-secondary mt-0.5">Cria um pedido na agenda do laboratório</p>
                    </div>
                    <ToggleSwitch
                      checked={novoForm.enviarProtetico}
                      onCheckedChange={(v) => setNovoForm((f) => ({ ...f, enviarProtetico: v }))}
                    />
                  </div>
                  {novoForm.enviarProtetico && (
                    <div className="flex flex-col gap-3.5 p-4 border-t border-teal/20">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                          Protético <span className="text-coral-ink">*</span>
                        </Label>
                        <Select
                          value={novoForm.proteticoId}
                          onValueChange={(v) => v && setNovoForm((f) => ({ ...f, proteticoId: v }))}
                        >
                          <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                            <SelectValue>
                              {(v: string | null) =>
                                v
                                  ? (proteticosAtivos.find((p) => p.id === v)?.nome ?? 'Protético indisponível')
                                  : 'Selecione o protético...'
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-surface border-border">
                            {proteticosAtivos.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="apt-protetico-data" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                          Data de entrega <span className="text-coral-ink">*</span>
                        </Label>
                        <Input
                          id="apt-protetico-data"
                          type="date"
                          value={novoForm.dataEntregaProtetico}
                          onChange={(e) => setNovoForm((f) => ({ ...f, dataEntregaProtetico: e.target.value }))}
                          className="rounded-xl bg-surface-alt border-border text-text-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="apt-protetico-obs" className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">
                          O que o protético precisa saber <span className="text-coral-ink">*</span>
                        </Label>
                        <textarea
                          id="apt-protetico-obs"
                          value={novoForm.observacaoProtetico}
                          onChange={(e) => setNovoForm((f) => ({ ...f, observacaoProtetico: e.target.value }))}
                          className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[70px] focus:ring-2 focus:ring-teal/15 focus:border-teal/30 transition-all resize-none text-text-primary placeholder:text-text-secondary/40"
                          placeholder="Ex: Coroa e.max no 26, cor A2, contato proximal leve"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aviso de conflito */}
              {conflitoNovo && (
                <div className="order-5 mx-4 mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-pale p-3 text-xs text-warning-ink md:mx-0 md:mb-0">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Conflito de horário — já existe um agendamento nesse intervalo.</span>
                </div>
              )}
            </div>

            {/* ── Coluna fixa: Quando + ações — nunca rola ─────────────── */}
            <div className="contents md:flex md:w-72 md:shrink-0 md:flex-col md:border-l md:border-t-0">
              <div className="order-2 flex-1 space-y-4 border-t border-border p-4 md:border-t-0 md:p-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Quando</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1.5">
                      <Label htmlFor="apt-date-drawer" className="text-[10px] text-text-secondary">Data</Label>
                      <Input
                        id="apt-date-drawer"
                        type="date"
                        value={novoForm.data}
                        onChange={(e) => setNovoForm((f) => ({ ...f, data: e.target.value }))}
                        className="rounded-xl bg-surface-alt border-border text-text-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="apt-time-drawer" className="text-[10px] text-text-secondary">Hora</Label>
                      <Input
                        id="apt-time-drawer"
                        type="time"
                        value={novoForm.hora}
                        onChange={(e) => setNovoForm((f) => ({ ...f, hora: e.target.value }))}
                        className="rounded-xl bg-surface-alt border-border text-text-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Duração — os chips são atalho, não limite (pedido 21/07); o campo
                    livre abaixo cobre qualquer valor, os dois leem o mesmo estado. */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-teal-ink">Duração</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { value: '30',  label: '30min' },
                      { value: '45',  label: '45min' },
                      { value: '60',  label: '1h' },
                      { value: '90',  label: '1h30' },
                      { value: '120', label: '2h' },
                      { value: '180', label: '3h' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNovoForm((f) => ({ ...f, duracao: opt.value }))}
                        className={`min-h-11 py-2 rounded-lg border text-xs font-bold transition-all ${
                          novoForm.duracao === opt.value
                            ? 'bg-teal/10 border-teal text-teal-ink'
                            : 'border-border text-text-secondary hover:border-teal/40 hover:text-teal-ink bg-surface-alt'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="apt-duracao-livre" className="text-xs text-text-secondary shrink-0">Ou:</Label>
                    <Input
                      id="apt-duracao-livre"
                      type="number"
                      min={5}
                      max={600}
                      step={5}
                      inputMode="numeric"
                      value={novoForm.duracao}
                      onChange={(e) => setNovoForm((f) => ({ ...f, duracao: e.target.value }))}
                      className="rounded-lg bg-surface-alt border-border text-text-primary text-sm h-11"
                      aria-label="Duração personalizada em minutos"
                    />
                    <span className="text-xs text-text-secondary shrink-0">min</span>
                  </div>
                </div>
              </div>

              {/* ── Rodapé da coluna de ação ────────────────────────────── */}
              <div className="sticky bottom-0 z-10 order-6 space-y-2.5 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:p-5">
                {saveError && !avisoNovoAgendamento && (
                  <p className="text-xs text-coral-ink bg-coral-pale rounded-lg p-2">{saveError}</p>
                )}

                {/* R-110: conflito da agenda e expediente são confirmações independentes.
                    O conflito do paciente nunca chega aqui, pois continua sem override. */}
                {avisoNovoAgendamento && (
                  <div className="rounded-xl border border-warning/30 bg-warning-pale p-3">
                    <div className="flex items-start gap-2 mb-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning-ink" />
                      <div className="space-y-1 text-xs text-warning-ink">
                        {avisoNovoAgendamento.conflitoDentista && (
                          <p>{saveError} Marcar mesmo assim vai <b>sobrepor</b> horários na agenda.</p>
                        )}
                        {avisoNovoAgendamento.foraDoExpediente && (
                          <p>{MENSAGEM_FORA_DO_EXPEDIENTE[avisoNovoAgendamento.foraDoExpediente]}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => void handleCriarAgendamento(true)}
                      disabled={isSaving}
                      size="sm"
                      /* `text-white` sobre `bg-warning` reprova no escuro: warning vira
                         #fbbf24 (âmbar claro) lá, e branco em cima piora, não melhora.
                         Par warning-pale/warning-ink é o que garante contraste nos 2 temas. */
                      className="w-full rounded-lg text-xs bg-warning-pale border border-warning text-warning-ink hover:bg-warning/20 disabled:opacity-50"
                    >
                      {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Salvando...</> : 'Marcar mesmo assim'}
                    </Button>
                  </div>
                )}

                <Button
                  onClick={() => void handleCriarAgendamento()}
                  disabled={isSaving}
                  className="min-h-11 w-full bg-teal text-white hover:bg-teal-lt rounded-xl font-bold disabled:opacity-50"
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : 'Salvar agendamento'}
                </Button>
                <button
                  onClick={() => { setIsNewModalOpen(false); resetForm(); }}
                  className="min-h-11 w-full py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
      <AtenderAgoraModal
        clinicaId={_clinicaId}
        open={isAtenderAgoraOpen}
        onOpenChange={setIsAtenderAgoraOpen}
      />

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
                    {dentistasOrdenados.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
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
                  setEncaixeForm(f => (
                    // R-31a §3.2 — mesma regra do fluxo de novo agendamento: só invalida
                    // a seleção se o texto realmente mudou.
                    f.pacienteId && v === f.pacienteNome
                      ? { ...f, pacienteSearch: v }
                      : { ...f, pacienteSearch: v, pacienteId: '', pacienteNome: '' }
                  ));
                  setShowEncaixeSugestoes(true);
                  void buscarEncaixePacientes(v);
                }}
                onBlur={() => setShowEncaixeSugestoes(false)}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
              {showEncaixeSugestoes && encaixeForm.pacienteSearch.trim().length >= 2 && (encaixeSugestoes.length > 0 || !encaixeForm.pacienteId) && (
                <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                  {encaixeSugestoes.map(p => {
                    const selecionar = () => {
                      setEncaixeForm(f => ({ ...f, pacienteSearch: p.nome, pacienteId: p.id, pacienteNome: p.nome }));
                      setShowEncaixeSugestoes(false);
                    };
                    return (
                      <button key={p.id} type="button"
                        onPointerDown={e => { e.preventDefault(); selecionar(); }}
                        onClick={selecionar}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
                      >{p.nome}</button>
                    );
                  })}
                  {!encaixeForm.pacienteId && (
                    <button
                      type="button"
                      onPointerDown={e => { e.preventDefault(); void handleCriarPacienteRapidoEncaixe(); }}
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

      {/* Compromisso pessoal (R-102) — criar/editar/excluir bloqueio sem paciente */}
      <CompromissoPessoalDialog
        open={isCompromissoOpen}
        onOpenChange={(o) => { setIsCompromissoOpen(o); if (!o) setCompromissoEditando(null); }}
        dentistas={dentistasOrdenados}
        isSecretaria={isSecretaria}
        // dentistaPadraoForm() nunca resolve pra secretária (mesmo helper do Encaixe/Novo
        // Agendamento) — sem isso, o Select nascia pré-selecionado NELA mesma, e se ela não
        // trocasse manualmente o bloqueio nascia com dentista_id = secretária.
        dentistaAtualId={dentistaPadraoForm()}
        editando={compromissoEditando}
        onSalvo={() => void recarregarAgendamentos(true)}
      />

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
        {/*
          R-27a/b: 512px (max-w-lg) não cabia o conteúdo real — transbordava mesmo no caso
          típico (medido no artefato: +28px só com o campo de observação). O X do Dialog
          por padrão fica `absolute top-2 right-2` sem reservar espaço, e "Ver Ficha" também
          se ancorava no canto direito — colidiam por construção. showCloseButton={false}
          tira o X flutuante; o header abaixo desenha o seu próprio, com espaço reservado.
        */}
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-border bg-surface p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-auto sm:max-w-[720px]"
        >
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
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                >
                  {/* ── Cabeçalho (R-27b) ─────────────────────────────────
                      Canto direito reservado: Ver Ficha + ✕ nunca colidem — X próprio no
                      layout, não o absolute do DialogContent (showCloseButton={false}
                      acima). Antes, os dois disputavam o mesmo canto por construção. */}
                  <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <DialogTitle className="truncate font-heading text-lg font-semibold leading-tight text-text-primary sm:text-xl">
                        {selectedApt.paciente?.nome ?? '—'}
                      </DialogTitle>
                      <StatusBadge status={selectedApt.status as AgendamentoStatus} />
                      <DialogDescription className="sr-only">Detalhes do agendamento clínico.</DialogDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                      {selectedApt.paciente && (
                        <button
                          onClick={() => router.push(`/dashboard/pacientes/${selectedApt.paciente?.id}`)}
                          className="hidden items-center gap-1 text-xs font-semibold text-teal-ink transition-opacity hover:opacity-80 sm:flex"
                        >
                          Ver Ficha <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => setIsDetailModalOpen(false)}
                        aria-label="Fechar"
                        className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* ── Faixa de números ──────────────────────────────────
                      Substitui os cards "Data e Hora" / "Dentista" empilhados — mesma
                      informação, uma linha só, no lugar comum às 3 superfícies do R-27. */}
                  <div className={`grid gap-px border-b border-border bg-border ${
                    isSecretaria && selectedApt.dentista ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                  }`}>
                    <div className="bg-surface px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Data</p>
                      <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                        {format(parseISO(selectedApt.data_hora), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="bg-surface px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Hora</p>
                      <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                        {format(parseISO(selectedApt.data_hora), 'HH:mm')}
                      </p>
                    </div>
                    <div className="bg-surface px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Duração</p>
                      <p className="font-mono text-sm font-semibold text-text-primary mt-0.5">{selectedApt.duracao_minutos} min</p>
                    </div>
                    {isSecretaria && selectedApt.dentista && (
                      <div className="bg-surface px-3 py-3 sm:px-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Dentista</p>
                        <p className="text-sm font-medium text-text-primary mt-0.5 truncate">{selectedApt.dentista.nome}</p>
                      </div>
                    )}
                  </div>

                  {/* ── Corpo: 2 colunas ──────────────────────────────────── */}
                  <div className="flex flex-col sm:flex-row">
                    <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-6">
                      {selectedApt.observacoes && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-teal-ink mb-1.5">Observações</p>
                          <p className="text-sm text-text-primary">{selectedApt.observacoes}</p>
                        </div>
                      )}

                      {/* Alterar Status — botões rotulados pras transições comuns; o
                          dropdown abaixo cobre os casos raros (reverter, forçar manualmente). */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-teal-ink">Alterar status</Label>
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
                              cls: 'bg-coral-pale text-coral-ink border border-coral/30 hover:bg-coral/20',
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

                      {/* Criado por — apenas se diferente do dentista */}
                      {selectedApt.criador && selectedApt.criador.id !== selectedApt.dentista_id && (
                        <div className="flex items-center gap-2 text-text-secondary">
                          <UserCheck className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <span className="text-xs">
                            Criado por <span className="font-semibold text-text-primary">{selectedApt.criador.nome}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Coluna de ação — Assinatura, IA, Consulta ────────── */}
                    <div className="w-full space-y-2.5 border-t border-border p-4 sm:w-64 sm:shrink-0 sm:border-t-0 sm:border-l sm:p-5">
                      {isSecretaria && (selectedApt.status === 'checked_in' || selectedApt.status === 'in_progress' || selectedApt.status === 'completed') && selectedApt.paciente && (
                        assinadosLocal.has(selectedApt.id) ? (
                          <div className="flex items-center gap-2 text-sm font-semibold text-teal-ink bg-teal/10 rounded-xl px-4 py-3 border border-teal/20">
                            <CheckCircle2 className="w-4 h-4" /> Assinatura registrada
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssinaturaModal({ pacienteId: selectedApt.paciente!.id, pacienteNome: selectedApt.paciente!.nome, aptId: selectedApt.id })}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-teal/5 hover:text-teal-ink hover:border-teal/30 transition-all"
                          >
                            <PenLine className="w-4 h-4" />
                            Solicitar assinatura
                          </button>
                        )
                      )}

                      {proteticosAtivos.length > 0 && selectedApt.paciente && !['cancelled', 'no_show'].includes(selectedApt.status) && (
                        <Button
                          variant="outline"
                          onClick={enterEnviarProteticoMode}
                          className="w-full rounded-xl border-teal/30 text-teal-ink hover:bg-teal/5 hover:text-teal-ink"
                        >
                          <Stethoscope className="mr-2 h-4 w-4" />
                          Enviar ao protético
                        </Button>
                      )}

                      {!['cancelled', 'no_show'].includes(selectedApt.status) && selectedApt.paciente && (
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
                      )}

                      {!isSecretaria && selectedApt.paciente && !['cancelled', 'no_show', 'completed'].includes(selectedApt.status) && (
                        <Button
                          onClick={() => router.push(`/dashboard/meu-dia?ag=${selectedApt.id}`)}
                          className="w-full rounded-xl flex items-center justify-center gap-1.5 bg-gradient-to-r from-teal to-teal-lt text-white shadow-[0_4px_16px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
                        >
                          <Stethoscope className="w-4 h-4" />
                          {selectedApt.status === 'in_progress' ? 'Continuar atendimento' : 'Iniciar consulta'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Rodapé único ──────────────────────────────────────── */}
                  <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
                    <button
                      onClick={() => setDetailMode('confirm-delete')}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-coral-ink hover:bg-coral-pale rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsDetailModalOpen(false)}
                        className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                      >
                        Fechar
                      </Button>
                      <Button
                        onClick={enterEditMode}
                        className="bg-teal/10 text-teal-ink hover:bg-teal/20 border border-teal/30 rounded-xl flex items-center gap-1.5"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── MODO: ENVIAR AO PROTÉTICO ─────────────────────── */}
              {detailMode === 'send-protetico' && (
                <motion.div
                  key="send-protetico"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="px-6 pt-6 pb-4">
                    <button
                      onClick={() => setDetailMode('view')}
                      className="mb-3 flex w-fit items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Voltar
                    </button>
                    <DialogTitle className="font-heading text-xl font-semibold text-text-primary">
                      Enviar ao protético
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-text-secondary">
                      Pedido para {selectedApt.paciente?.nome ?? 'o paciente'}
                    </DialogDescription>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="pedido-protetico" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Protético
                      </Label>
                      <Select
                        value={pedidoProteticoForm.proteticoId}
                        onValueChange={(proteticoId) => proteticoId && setPedidoProteticoForm((form) => ({ ...form, proteticoId }))}
                      >
                        <SelectTrigger id="pedido-protetico" className="rounded-xl border-border bg-surface-alt text-text-primary">
                          <SelectValue placeholder="Selecione o protético" />
                        </SelectTrigger>
                        <SelectContent className="border-border bg-surface">
                          {proteticosAtivos.map((protetico) => (
                            <SelectItem key={protetico.id} value={protetico.id}>{protetico.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pedido-protetico-data" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Data de entrega
                      </Label>
                      <Input
                        id="pedido-protetico-data"
                        type="date"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        value={pedidoProteticoForm.dataEntrega}
                        onChange={(event) => setPedidoProteticoForm((form) => ({ ...form, dataEntrega: event.target.value }))}
                        className="rounded-xl border-border bg-surface-alt text-text-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pedido-protetico-observacao" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        O que o protético precisa saber
                      </Label>
                      <textarea
                        id="pedido-protetico-observacao"
                        value={pedidoProteticoForm.observacao}
                        onChange={(event) => setPedidoProteticoForm((form) => ({ ...form, observacao: event.target.value }))}
                        className="min-h-[112px] w-full resize-none rounded-xl border border-border bg-surface-alt p-3 text-sm text-text-primary placeholder:text-text-secondary/50 transition-all focus:ring-2 focus:ring-teal/20"
                        placeholder="Ex.: cor, material, dentes envolvidos e observações do caso."
                      />
                    </div>

                    {saveError && (
                      <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{saveError}</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                    <Button
                      variant="outline"
                      onClick={() => setDetailMode('view')}
                      disabled={isSaving}
                      className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => void handleEnviarProtetico()}
                      disabled={isSaving}
                      className="rounded-xl bg-teal text-white hover:bg-teal-lt disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}
                      Enviar pedido
                    </Button>
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

                    {saveError && !avisoEdicao && (
                      <p className="text-sm text-red-500 bg-red-500/10 rounded-lg p-3">{saveError}</p>
                    )}
                    {avisoEdicao && (
                      <div className="rounded-xl border border-warning/30 bg-warning-pale p-3 space-y-2.5">
                        <div className="flex items-start gap-2 text-xs text-warning-ink">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            {avisoEdicao.conflitoDentista && <p>{saveError}</p>}
                            {avisoEdicao.foraDoExpediente && <p>{MENSAGEM_FORA_DO_EXPEDIENTE[avisoEdicao.foraDoExpediente]}</p>}
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => void handleSalvarEdicao(true)}
                          disabled={isSaving}
                          size="sm"
                          className="w-full rounded-lg text-xs bg-warning-pale border border-warning text-warning-ink hover:bg-warning/20"
                        >
                          Salvar mesmo assim
                        </Button>
                      </div>
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
