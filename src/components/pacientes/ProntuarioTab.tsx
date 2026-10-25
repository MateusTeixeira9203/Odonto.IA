'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowLeft, CalendarPlus, Check, ChevronDown, ChevronRight, ClipboardCheck, Download, Ellipsis, FileText, FolderOpen, Forward, Loader2, PenLine, Plus, Star, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { ConfirmarExclusaoFicha } from '@/components/pacientes/confirmar-exclusao-ficha';
import type { ConfirmacaoExclusaoFicha } from '@/lib/prontuario/exclusao-ficha';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToothDetailPanel } from '@/components/odontograma/ToothDetailPanel';
import { Odontograma } from '@/components/odontograma/Odontograma';
import { outrasFichasDaSessao } from '@/lib/ficha/outras-fichas-da-sessao';
import { OrcamentoDaFicha } from '@/components/pacientes/orcamento-da-ficha';
import type { ResumoOrcamentoDaFicha } from '@/server/orcamentos/ficha-orcamento-actions';
import { ProcedimentoDetalheFicha } from '@/components/pacientes/procedimento-detalhe-ficha';
import { AdicionarProcedimentosFicha } from '@/components/pacientes/adicionar-procedimentos-ficha';
import { EvolucaoClinicaFicha, GrupoEditoresEvolucao } from '@/components/pacientes/evolucao-clinica-ficha';
import { NestaSessaoBloco } from '@/app/dashboard/meu-dia/_components/nesta-sessao-bloco';
import {
  useRegistrarPainel,
  type SalvarRegistroClinico,
} from '@/app/dashboard/meu-dia/_components/registrar-painel';
import { salvarAtendimentoDoProntuario } from '@/app/dashboard/pacientes/[id]/prontuario-actions';
import { MarcarRetornoModal } from '@/components/pacientes/marcar-retorno-modal';
import { ColarDoWordDialog } from '@/components/pacientes/colar-do-word-dialog';
import { useMarcarRetorno } from '@/hooks/use-marcar-retorno';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';
import type { ProntuarioAtendimento, ProntuarioEvento, ProntuarioLongitudinalData } from '@/server/patients/get-prontuario-longitudinal';
import type { OdontogramaEventoDraft } from '@/types/odontograma';
import { rotuloProcedimento as nomeClinicoProcedimento } from '@/types/odontograma';
import { travadoPelaAssinaturaDaFicha } from '@/lib/prontuario/travado-pela-ficha';
import {
  alternarMomentoRegistro,
  alternarStatusRegistro,
  assinarProcedimentos,
  atualizarStatusEncaminhado,
  encaminharProcedimento,
} from '@/server/patients/registro-actions';
import {
  CONTEXTO_TIMELINE_INICIAL,
  contextoDaSuperficie,
  podeEditarProcedimentosDaSuperficie,
  voltarParaTimeline,
  type ContextoTimeline,
  type SuperficieProntuario,
} from '@/lib/prontuario/superficie';
import {
  proximoStatusEncaminhadoLocal,
  refletirStatusEncaminhadoLocal,
  type StatusEncaminhadoLocal,
} from '@/lib/prontuario/status-encaminhado-local';
import {
  deletarFicha,
  prepararExclusaoFicha,
  type ResumoExclusaoFicha,
} from '@/server/patients/salvar-ficha';

const SignaturePad = dynamic(
  () => import('@/components/fichas/SignaturePad').then((module) => module.SignaturePad),
  { ssr: false },
);

interface ProntuarioTabProps {
  patientId: string;
  patientName: string;
  clinicaId: string;
  dentistaId: string;
  canWrite: boolean;
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  dados: ProntuarioLongitudinalData;
  onGerarOrcamento?: (fichaId: string, resumo?: ResumoOrcamentoDaFicha) => Promise<void> | void;
  orcamentoRevisao?: string;
  eventosOrcamentoConfirmados?: string[];
  onAbrirArquivos: () => void;
}

function formatarData(data: string): string {
  return format(new Date(`${data}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function textoDaVisita(atendimento: ProntuarioAtendimento): string | null {
  const relato = atendimento.evolucoes.find((evolucao) => !evolucao.automatica && evolucao.texto?.trim());
  return relato?.texto ?? null;
}

function rotuloOrigem(atendimento: ProntuarioAtendimento): string {
  if (atendimento.fonte === 'ficha_legada') return 'Registro legado';
  if (atendimento.fonte === 'evolucao_legada') return 'Evolução legada';
  if (atendimento.origem === 'ficha') return 'Atendimento pelo prontuário';
  return 'Atendimento pelo Meu Dia';
}

function rotuloLocalEvento(evento: ProntuarioAtendimento['eventos'][number]): string {
  if (evento.ancora.dente != null) return `dente ${evento.ancora.dente}`;
  if (evento.ancora.nivel === 'arcada') return `arcada ${evento.ancora.arcada ?? ''}`.trim();
  if (evento.ancora.nivel === 'quadrante') return `quadrante ${evento.ancora.quadrante ?? ''}`.trim();
  if (evento.ancora.nivel === 'boca') return 'boca toda';
  return 'sem localização';
}

function rotuloUltimaAlteracao(acao: NonNullable<ProntuarioAtendimento['eventos'][number]['ultimaAlteracao']>['acao']): string {
  const rotulos = {
    encaminhado: 'Encaminhado',
    encaminhamento_removido: 'Encaminhamento removido',
    detalhe_alterado: 'Detalhe clínico atualizado',
    marcado_realizado: 'Marcado como realizado',
    reaberto: 'Reaberto',
  } as const;
  return rotulos[acao];
}

function formatarDataHora(data: string): string {
  return format(new Date(data), "d 'de' MMMM 'às' HH:mm", { locale: ptBR });
}

function rotuloStatusAgenda(status: string): string {
  const rotulos: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    checked_in: 'Aguardando atendimento',
    in_progress: 'Em atendimento',
    completed: 'Realizado',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
  };
  return rotulos[status] ?? status;
}

type ResumoAberto = 'atendimentos' | 'pendencias';

type GrupoProcedimento = {
  chave: string;
  eventos: ProntuarioAtendimento['eventos'];
  eventoPrincipal: ProntuarioAtendimento['eventos'][number];
};

function agruparProcedimentos(eventos: ProntuarioAtendimento['eventos']): GrupoProcedimento[] {
  // R-152 — agrupamento anatômico não pode virar ação em lote invisível. Cada card é um
  // procedimento/evento, e ações de status, sessão e encaminhamento recebem só o seu id.
  return eventos.map((evento) => ({
    chave: evento.id,
    eventos: [evento],
    eventoPrincipal: evento,
  }));
}

function agruparProcedimentosPorDente(procedimentos: GrupoProcedimento[]) {
  const dentes = new Map<number | null, GrupoProcedimento[]>();
  for (const procedimento of procedimentos) {
    const dente = procedimento.eventoPrincipal.ancora.dente ?? null;
    const linhas = dentes.get(dente) ?? [];
    linhas.push(procedimento);
    dentes.set(dente, linhas);
  }
  return Array.from(dentes, ([dente, linhas]) => ({ dente, linhas }))
    .sort((a, b) => (a.dente ?? Infinity) - (b.dente ?? Infinity));
}

const ODONTOGRAMA_RESPONSIVO = 'origin-top-left [zoom:0.46] min-[480px]:[zoom:0.62] sm:[zoom:0.78] md:[zoom:0.9] xl:[zoom:1]';

export function ProntuarioTab({
  patientId,
  patientName,
  clinicaId,
  dentistaId,
  canWrite,
  catalogoProcedimentos,
  dados,
  onGerarOrcamento,
  orcamentoRevisao,
  eventosOrcamentoConfirmados,
  onAbrirArquivos,
}: ProntuarioTabProps) {
  const router = useRouter();
  const [statusLocalEncaminhado, setStatusLocalEncaminhado] = useState<StatusEncaminhadoLocal | null>(null);
  const [superficie, setSuperficie] = useState<SuperficieProntuario>({
    tipo: 'resumo',
    contexto: CONTEXTO_TIMELINE_INICIAL,
  });
  const [retornoAberto, setRetornoAberto] = useState(false);
  const [retornoAtendimentoId, setRetornoAtendimentoId] = useState<string | null>(null);
  const [odontogramaCompletoAberto, setOdontogramaCompletoAberto] = useState(false);
  const [filtroClinico, setFiltroClinico] = useState<'tudo' | 'indicado' | 'realizado'>('tudo');
  const [eventosDraft, setEventosDraft] = useState<OdontogramaEventoDraft[]>([]);
  const [textoVisita, setTextoVisita] = useState('');
  const [visitaKey, setVisitaKey] = useState(() => crypto.randomUUID());
  const [denteAberto, setDenteAberto] = useState<number | null>(null);
  const [detalheEspecialidadeAberto, setDetalheEspecialidadeAberto] = useState(false);
  const [resumoAberto, setResumoAberto] = useState<ResumoAberto | null>(null);
  const [destinoNovoRegistroId, setDestinoNovoRegistroId] = useState<string | null>(null);
  const [atendimentoDeOrigemId, setAtendimentoDeOrigemId] = useState<string | null>(null);
  const [complementoPendente, setComplementoPendente] = useState<{
    atendimento: ProntuarioAtendimento;
    dente: number | null;
  } | null>(null);
  const [linhasProcedimentoAbertas, setLinhasProcedimentoAbertas] = useState<Set<string>>(new Set());
  const [eventoDetalheAbertoId, setEventoDetalheAbertoId] = useState<string | null>(null);
  const [fichaComAdicaoAbertaId, setFichaComAdicaoAbertaId] = useState<string | null>(null);
  const [fichasComHistoricoCompleto, setFichasComHistoricoCompleto] = useState<Set<string>>(new Set());
  const ultimaSessaoRolada = useRef<string | null>(null);
  const painelAdicionarId = useId();
  const [acaoProcedimento, setAcaoProcedimento] = useState<string | null>(null);
  const [encaminhamentoEventoIds, setEncaminhamentoEventoIds] = useState<string[]>([]);
  const [destinoEncaminhamentoId, setDestinoEncaminhamentoId] = useState('');
  const [assinaturaAberta, setAssinaturaAberta] = useState(false);
  const [assinaturaEtapa, setAssinaturaEtapa] = useState<'selecao' | 'coleta'>('selecao');
  const [assinaturaSelecionados, setAssinaturaSelecionados] = useState<string[]>([]);
  const [assinadoPor, setAssinadoPor] = useState(patientName);
  const [orientacoesAssinatura, setOrientacoesAssinatura] = useState('Orientações clínicas fornecidas e compreendidas pelo paciente.');
  const [salvandoAssinatura, setSalvandoAssinatura] = useState(false);
  const [importacaoHistoricoAberta, setImportacaoHistoricoAberta] = useState(false);
  const [exclusaoFichaId, setExclusaoFichaId] = useState<string | null>(null);
  const [resumoExclusao, setResumoExclusao] = useState<ResumoExclusaoFicha | null>(null);
  const [carregandoExclusao, setCarregandoExclusao] = useState(false);
  const [apagandoFicha, setApagandoFicha] = useState(false);
  const assinaturaPadRef = useRef<SignaturePadLib | null>(null);

  const dadosLocais = useMemo(
    () => refletirStatusEncaminhadoLocal(dados, statusLocalEncaminhado),
    [dados, statusLocalEncaminhado],
  );

  const novoRegistroAberto = superficie.tipo === 'editor';

  function contextoAtual(): ContextoTimeline {
    return {
      filtro: filtroClinico,
      dente: null,
      concluidos: false,
      scrollY: window.scrollY,
    };
  }

  function contextoParaDestino(): ContextoTimeline {
    return superficie.tipo === 'resumo' ? contextoAtual() : contextoDaSuperficie(superficie);
  }

  function abrirFicha(fichaId: string, atendimentoId: string | null = null): void {
    setSuperficie({ tipo: 'ficha', fichaId, atendimentoId, retorno: contextoParaDestino() });
  }

  function abrirLegado(atendimentoId: string): void {
    setSuperficie({ tipo: 'legado', atendimentoId, retorno: contextoParaDestino() });
  }

  function voltarAoContextoAnterior(): void {
    const contexto = contextoDaSuperficie(superficie);
    setFiltroClinico(contexto.filtro);
    setSuperficie(voltarParaTimeline(superficie));
    requestAnimationFrame(() => window.scrollTo({ top: contexto.scrollY }));
  }

  const salvarRegistro: SalvarRegistroClinico = async (input) => salvarAtendimentoDoProntuario(input);

  const painel = useRegistrarPainel({
    visitaKey,
    contextoId: visitaKey,
    pacienteId: patientId,
    pacienteNome: patientName,
    dentistaId,
    catalogoProcedimentos,
    eventosDraft,
    onEventosDraftChange: setEventosDraft,
    denteAberto,
    onDenteAbertoChange: setDenteAberto,
    textoVisita,
    onTextoVisitaChange: setTextoVisita,
    temFichaHoje: false,
    fichaRascunhoId: null,
    destinoNovos: destinoNovoRegistroId,
    boca: dadosLocais.boca,
    detalheEspecialidadeAberto,
    onAbrirPickerOrcamento: () => {
      toast.info('Salve o atendimento antes de gerar o orçamento. Assim o orçamento fica ligado à ficha correta.');
    },
    onAbrirDetalheDental: (dente) => setDenteAberto(dente),
    onIniciarPonte: (dente) => setDenteAberto(dente),
    onAbrirDetalheEndo: (dente) => setDenteAberto(dente),
    onSalvarVisita: salvarRegistro,
    onSalvo: (resultado) => {
      setEventosDraft([]);
      setTextoVisita('');
      setDenteAberto(null);
      setDetalheEspecialidadeAberto(false);
      setDestinoNovoRegistroId(null);
      setAtendimentoDeOrigemId(null);
      setVisitaKey(crypto.randomUUID());
      if ('atendimentoId' in resultado && destinoNovoRegistroId) {
        abrirFicha(destinoNovoRegistroId, resultado.atendimentoId);
      }
      else voltarAoContextoAnterior();
      router.refresh();
    },
  });

  const retorno = useMarcarRetorno({
    pacienteId: patientId,
    atendimentoOrigemId: retornoAtendimentoId ?? undefined,
    onConcluido: () => {
      const retornoVinculado = retornoAtendimentoId != null;
      setRetornoAberto(false);
      setRetornoAtendimentoId(null);
      toast.success(retornoVinculado ? 'Retorno marcado e ligado a este atendimento.' : 'Próximo agendamento marcado.');
      router.refresh();
    },
  });

  const atendimentos = useMemo(() => dadosLocais.atendimentos, [dadosLocais.atendimentos]);
  const fichaAberta = superficie.tipo === 'ficha'
    ? dadosLocais.fichas.find((ficha) => ficha.id === superficie.fichaId) ?? null
    : null;
  const atendimentoAberto = superficie.tipo === 'ficha'
    ? fichaAberta?.atendimentos.find((atendimento) => atendimento.id === superficie.atendimentoId)
      ?? fichaAberta?.atendimentos[0]
      ?? null
    : superficie.tipo === 'legado'
      ? atendimentos.find((atendimento) => atendimento.id === superficie.atendimentoId) ?? null
      : null;
  useEffect(() => {
    const visitaId = superficie.tipo === 'ficha' || superficie.tipo === 'legado'
      ? superficie.atendimentoId : null;
    if (!visitaId) {
      ultimaSessaoRolada.current = null;
      return;
    }
    const fichaId = superficie.tipo === 'ficha' ? superficie.fichaId : 'legado';
    const alvoId = `sessao-ficha-${fichaId}-${visitaId}`;
    if (ultimaSessaoRolada.current === alvoId) return;
    const alvo = document.getElementById(alvoId);
    if (!alvo) return;
    ultimaSessaoRolada.current = alvoId;
    alvo.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [superficie, dadosLocais]);

  const atendimentosVisiveis = atendimentos.filter((atendimento) => (
    filtroClinico === 'tudo' || atendimento.eventos.some((evento) => evento.status === filtroClinico)
  ));
  const todasFichas = dadosLocais.fichas;
  const eventosClinicosUnicos = Array.from(new Map(
    dadosLocais.fichas.flatMap((ficha) => ficha.eventos).map((evento) => [evento.id, evento] as const),
  ).values());
  const fichasPorId = new Map(dadosLocais.fichas.map((ficha) => [ficha.id, ficha]));
  const eventosPendentes = eventosClinicosUnicos.filter((evento) => evento.status === 'indicado');
  const pendencias = eventosPendentes.length;

  function abrirNovoRegistro(params?: {
    fichaId?: string | null;
    dente?: number | null;
    atendimentoOrigemId?: string | null;
  }): void {
    setDestinoNovoRegistroId(params?.fichaId ?? null);
    setAtendimentoDeOrigemId(params?.atendimentoOrigemId ?? null);
    setDenteAberto(params?.dente ?? null);
    setDetalheEspecialidadeAberto(false);
    setSuperficie({
      tipo: 'editor',
      modo: params?.atendimentoOrigemId ? 'complementar' : 'novo',
      fichaId: params?.fichaId ?? null,
      atendimentoOrigemId: params?.atendimentoOrigemId ?? null,
      retorno: contextoParaDestino(),
    });
  }

  function complementarAtendimento(atendimento: ProntuarioAtendimento, dente: number | null = null): void {
    if (atendimento.fichas.length > 1) {
      setComplementoPendente({ atendimento, dente });
      return;
    }
    abrirNovoRegistro({
      fichaId: atendimento.fichas[0]?.id ?? null,
      dente,
      atendimentoOrigemId: atendimento.id,
    });
  }

  function abrirDetalhesDoEvento(evento: ProntuarioEvento): void {
    setEventoDetalheAbertoId((idAtual) => idAtual === evento.id ? null : evento.id);
  }

  function abrirProcedimentoDoDente(eventos: ProntuarioEvento[], dente: number): void {
    const evento = eventos.find((item) => item.ancora.dente === dente);
    // Um toque no odontograma é navegação, nunca abertura implícita de um novo atendimento.
    if (!evento) return;
    requestAnimationFrame(() => {
      document.getElementById(`procedimento-${evento.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  async function atualizarStatusGrupo(grupo: GrupoProcedimento, novoStatus: 'indicado' | 'realizado'): Promise<void> {
    const eventoIds = grupo.eventos.map((evento) => evento.id);
    const encaminhadoAoAtual = grupo.eventos.every((evento) => evento.encaminhadoParaId === dentistaId);
    const concluindoEncaminhado = encaminhadoAoAtual && !grupo.eventos.every((evento) => evento.dentistaId === dentistaId);
    setAcaoProcedimento(`${grupo.chave}:status`);
    const resultado = concluindoEncaminhado
      ? await atualizarStatusEncaminhado({ eventoIds, novoStatus })
      : await alternarStatusRegistro({ eventoIds, novoStatus });
    setAcaoProcedimento(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    if (concluindoEncaminhado) {
      setStatusLocalEncaminhado((statusAtual) => proximoStatusEncaminhadoLocal(
        dados,
        statusAtual,
        eventoIds,
        novoStatus,
      ));
    }
    toast.success(novoStatus === 'realizado' ? 'Procedimento marcado como realizado.' : 'Procedimento voltou para A fazer.');
    router.refresh();
  }

  async function atualizarProximaSessao(grupo: GrupoProcedimento): Promise<void> {
    const vaiParaProxima = !grupo.eventos.every((evento) => evento.momento_planejado === 'proxima_sessao');
    setAcaoProcedimento(`${grupo.chave}:momento`);
    const resultado = await alternarMomentoRegistro({
      eventoIds: grupo.eventos.map((evento) => evento.id),
      novoMomento: vaiParaProxima ? 'proxima_sessao' : 'sessao_atual',
    });
    setAcaoProcedimento(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(vaiParaProxima ? 'Separado para a próxima sessão.' : 'Retirado da próxima sessão.');
    router.refresh();
  }

  async function salvarEncaminhamento(): Promise<void> {
    if (encaminhamentoEventoIds.length === 0) return;
    if (!destinoEncaminhamentoId) {
      toast.error('Escolha o profissional que assumirá o procedimento.');
      return;
    }
    setAcaoProcedimento('encaminhamento');
    const resultado = await encaminharProcedimento({
      eventoIds: encaminhamentoEventoIds,
      dentistaDestinoId: destinoEncaminhamentoId,
    });
    setAcaoProcedimento(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setEncaminhamentoEventoIds([]);
    toast.success('Procedimento encaminhado.');
    router.refresh();
  }

  async function abrirExclusaoFicha(fichaId: string): Promise<void> {
    setCarregandoExclusao(true);
    const resultado = await prepararExclusaoFicha(fichaId);
    setCarregandoExclusao(false);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setResumoExclusao(resultado.resumo);
    setExclusaoFichaId(fichaId);
  }

  async function confirmarExclusaoFicha(confirmacao: ConfirmacaoExclusaoFicha): Promise<void> {
    if (!exclusaoFichaId) return;
    setApagandoFicha(true);
    const resultado = await deletarFicha(exclusaoFichaId, confirmacao);
    setApagandoFicha(false);
    if (!resultado.ok) {
      toast.error(resultado.error ?? 'Não foi possível apagar a ficha.');
      return;
    }
    setExclusaoFichaId(null);
    setResumoExclusao(null);
    voltarAoContextoAnterior();
    toast.success('Ficha apagada.');
    router.refresh();
  }

  async function salvarAssinaturas(eventos: ProntuarioEvento[]): Promise<void> {
    if (assinaturaSelecionados.length === 0) {
      toast.error('Selecione pelo menos um procedimento realizado.');
      return;
    }
    if (assinadoPor.trim().length < 2 || orientacoesAssinatura.trim().length < 3) {
      toast.error('Informe o nome de quem assina e as orientações fornecidas.');
      return;
    }
    if (!assinaturaPadRef.current || assinaturaPadRef.current.isEmpty()) {
      toast.error('Colete a assinatura antes de concluir.');
      return;
    }

    const assinaturaDataUrl = assinaturaPadRef.current.toDataURL('image/png');
    const selecionados = eventos.filter((evento) => assinaturaSelecionados.includes(evento.id));
    const porFicha = new Map<string, string[]>();
    for (const evento of selecionados) {
      if (!evento.fichaId) continue;
      porFicha.set(evento.fichaId, [...(porFicha.get(evento.fichaId) ?? []), evento.id]);
    }
    if (porFicha.size === 0) {
      toast.error('Os procedimentos selecionados não estão vinculados a uma ficha.');
      return;
    }

    setSalvandoAssinatura(true);
    const avisos: string[] = [];
    for (const eventoIds of porFicha.values()) {
      const resultado = await assinarProcedimentos({
        eventoIds,
        assinadoPor: assinadoPor.trim(),
        assinaturaDataUrl,
        conclusao: { orientacoes: orientacoesAssinatura.trim() },
      });
      if (!resultado.ok) {
        setSalvandoAssinatura(false);
        toast.error(resultado.error);
        return;
      }
      if (resultado.documentWarning) avisos.push(resultado.documentWarning);
    }
    setSalvandoAssinatura(false);
    setAssinaturaAberta(false);
    setAssinaturaEtapa('selecao');
    setAssinaturaSelecionados([]);
    toast.success('Assinatura coletada. O documento foi salvo no prontuário do paciente.');
    if (avisos.length > 0) toast.warning(avisos.join(' '));
    router.refresh();
  }

  function voltarDaBancada(): void {
    setEventosDraft([]);
    setTextoVisita('');
    setDenteAberto(null);
    setDetalheEspecialidadeAberto(false);
    setDestinoNovoRegistroId(null);
    if (atendimentoDeOrigemId && destinoNovoRegistroId) {
      setSuperficie({
        tipo: 'ficha',
        fichaId: destinoNovoRegistroId,
        atendimentoId: atendimentoDeOrigemId,
        retorno: contextoDaSuperficie(superficie),
      });
    } else {
      voltarAoContextoAnterior();
    }
    setAtendimentoDeOrigemId(null);
  }

  if (novoRegistroAberto) {
    const tratamentoDestino = todasFichas.find((ficha) => ficha.id === destinoNovoRegistroId) ?? null;
    return (
      <section className="space-y-3" aria-label="Novo atendimento no prontuário">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-ink" aria-hidden />
            <div>
                <p className="text-sm font-bold text-text-primary">
                  {tratamentoDestino ? `Novo atendimento em ${tratamentoDestino.nome}` : 'Novo atendimento'}
                </p>
                <p className="text-xs text-text-secondary">
                  Nova entrada com autoria e data próprias — o registro anterior não é reescrito.
                </p>
              </div>
            </div>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={voltarDaBancada}>
            <ArrowLeft className="h-4 w-4" /> {atendimentoDeOrigemId ? 'Voltar à Ficha' : 'Voltar ao prontuário'}
          </Button>
        </div>

        <div className="rounded-2xl border border-teal/30 bg-surface p-3">
          {painel.campoMagico}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(720px,0.95fr)]">
          <section className="flex min-h-[720px] flex-col rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-heading text-lg text-text-primary">Revisão do atendimento</p>
                <p className="text-xs text-text-secondary">Corrija, complete ou remova antes de salvar.</p>
              </div>
              {painel.acoesSecundarias}
            </div>
            <div className="min-h-0 flex-1 pr-1">
              <NestaSessaoBloco
                vazio="Ainda não há registros nesta consulta. Use o Dex ou selecione uma região da boca."
                eventosDraft={eventosDraft}
                onEventosDraftChange={setEventosDraft}
                textoVisita={textoVisita}
                onTextoVisitaChange={setTextoVisita}
                ortoManutencao={painel.ortoManutencao}
                onEditarOrto={painel.abrirManutencao}
                onAbrirDenteGrande={(dente) => setDenteAberto(dente)}
                idsDeAntes={new Set()}
                destinosEncaminhar={[]}
                nomeTratamentoPorEvento={{}}
              />
            </div>
          </section>

          <section className="min-h-[720px] rounded-2xl border border-border bg-surface p-4">
            {denteAberto != null ? (
              <ToothDetailPanel
                dente={denteAberto}
                eventos={eventosDraft}
                onChange={setEventosDraft}
                onClose={() => { setDenteAberto(null); setDetalheEspecialidadeAberto(false); }}
                dataPadrao={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}
                onDetalheAbertoChange={setDetalheEspecialidadeAberto}
                catalogoProcedimentos={catalogoProcedimentos}
              />
            ) : (
              <div className="flex h-full flex-col gap-3">{painel.slotCentral}<div className="border-t border-border pt-3">{painel.controlesOdontograma}</div></div>
            )}
          </section>
        </div>

        <footer className="rounded-2xl border border-border bg-surface p-3 sm:p-4">{painel.rodape}</footer>
      </section>
    );
  }

  if (atendimentoAberto) {
    const fichaAtual = fichaAberta ?? atendimentoAberto.fichas[0] ?? null;
    const eventosDaFicha = fichaAberta?.eventos ?? atendimentoAberto.eventos;
    const gruposProcedimento = agruparProcedimentos(eventosDaFicha);
    const historicoDaFicha = fichaAberta?.atendimentos ?? [atendimentoAberto];
    const chaveDoHistorico = superficie.tipo === 'ficha' ? superficie.fichaId : `legado:${atendimentoAberto.id}`;
    const idFichaDoHistorico = superficie.tipo === 'ficha' ? superficie.fichaId : 'legado';
    const visitaSolicitadaId = superficie.tipo === 'ficha' || superficie.tipo === 'legado' ? superficie.atendimentoId : null;
    const mostrarHistoricoCompleto = fichasComHistoricoCompleto.has(chaveDoHistorico)
      || historicoDaFicha.findIndex((visita) => visita.id === visitaSolicitadaId) >= 10;
    const sessoesVisiveis = mostrarHistoricoCompleto ? historicoDaFicha : historicoDaFicha.slice(0, 10);
    const progressoDaFicha = fichaAberta && fichaAberta.totalProcedimentos > 0
      ? Math.round((fichaAberta.procedimentosRealizados / fichaAberta.totalProcedimentos) * 100)
      : 0;
    const travadoPelaFicha = (evento: ProntuarioEvento): boolean => {
      const ficha = evento.fichaId === fichaAtual?.id
        ? fichaAtual
        : atendimentoAberto.fichas.find((item) => item.id === evento.fichaId);
      return travadoPelaAssinaturaDaFicha(ficha?.assinadoEm ?? null, evento.criadoEm ?? evento.created_at ?? null);
    };
    const elegiveisParaAssinatura = eventosDaFicha.filter((evento) => (
      evento.status === 'realizado'
      && evento.assinaturaId == null
      && evento.retiradoEm == null
      && evento.fichaId != null
      && !travadoPelaFicha(evento)
      && (evento.encaminhadoParaId ?? evento.dentistaId) === dentistaId
    ));
    const podeEscreverFicha = podeEditarProcedimentosDaSuperficie(superficie, canWrite);
    const podeAdicionarNaFicha = podeEscreverFicha && fichaAtual != null && (
      fichaAtual.responsavel.id === dentistaId
      || eventosDaFicha.some((evento) => evento.encaminhadoParaId === dentistaId && evento.retiradoEm == null)
    );
    const podeComplementar = podeEscreverFicha;
    const sessaoMaisRecenteDaFicha = historicoDaFicha[0] ?? atendimentoAberto;
    const podeMarcarRetornoDaVisita = podeEscreverFicha
      && sessaoMaisRecenteDaFicha.atendimentoId != null
      && sessaoMaisRecenteDaFicha.profissional.id === dentistaId;

    const atalhoFicha = 'h-10 max-w-full rounded-[8px] px-[13px] text-[15px] font-normal';
    const temDocumentoAssinadoDaFicha = Boolean(fichaAtual?.assinaturaUrl)
      || historicoDaFicha.some((visita) => visita.documentos.length > 0)
      || eventosDaFicha.some((evento) => evento.assinaturaId != null);
    const dataInicialDaFicha = historicoDaFicha.reduce((data, visita) => visita.dataAtendimento < data ? visita.dataAtendimento : data, atendimentoAberto.dataAtendimento);

    return (
      <section className="space-y-4" aria-label="Ficha aberta no prontuário">
        <button type="button" onClick={voltarAoContextoAnterior} className="inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-teal-ink hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao prontuário
        </button>
        <article data-ficha-cartao className="w-full max-w-[1335px] overflow-hidden rounded-[12px] border border-border bg-surface">
        <header data-ficha-cabecalho className="border-b border-border px-[25px] py-[22px]">
          <div className="flex flex-col gap-4 min-[801px]:flex-row min-[801px]:items-start min-[801px]:justify-between">
            <div className="min-w-0">
              <p className="text-[12.5px] uppercase leading-[18.75px] text-text-secondary">{fichaAtual ? 'Ficha de tratamento' : 'Registro clínico'}{fichaAtual && ` · ${fichaAtual.status === 'aberta' ? 'Em curso' : fichaAtual.status}`}</p>
              <h2 className="mt-1 w-fit max-w-full break-words border-b border-border font-heading text-[27px] font-normal leading-[40px] text-text-primary">{fichaAtual?.nome ?? `Registro de ${formatarData(atendimentoAberto.dataAtendimento)}`}</h2>
              <p className="mt-1 text-[15px] leading-[22.5px] text-text-secondary">Responsável: {fichaAtual?.responsavel.nome ?? atendimentoAberto.profissional.nome} · {fichaAtual ? 'Iniciada em' : 'Consulta de'} {formatarData(dataInicialDaFicha)}</p>
              {fichaAberta && <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-text-secondary">
                <span>{fichaAberta.procedimentosRealizados} de {fichaAberta.totalProcedimentos} procedimentos</span>
                <span role="progressbar" aria-label="Progresso da Ficha" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressoDaFicha} className="h-[2px] w-[120px] overflow-hidden rounded-full bg-border"><span className="block h-full bg-teal-ink" style={{ width: `${progressoDaFicha}%` }} /></span>
              </div>}
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-secondary">
                <span>Próximo retorno: {sessaoMaisRecenteDaFicha.retorno ? (
                  <>{format(new Date(sessaoMaisRecenteDaFicha.retorno.dataHora), 'dd/MM HH:mm')} · {sessaoMaisRecenteDaFicha.retorno.dentistaNome ?? 'Dentista não identificado'} · {rotuloStatusAgenda(sessaoMaisRecenteDaFicha.retorno.status)}</>
                ) : 'não marcado'}</span>
                {sessaoMaisRecenteDaFicha.retorno && (
                  <button type="button" className="min-h-8 text-teal-ink hover:underline" onClick={() => router.push(`/dashboard/agendamentos?v=dia&d=${sessaoMaisRecenteDaFicha.retorno!.dataHora.slice(0, 10)}`)}>
                    Abrir na Agenda
                  </button>
                )}
              </div>
            </div>
            <div className="w-full min-w-0 min-[801px]:w-[380px] min-[801px]:shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {fichaAtual && <Button variant="outline" className={atalhoFicha} aria-label="Baixar PDF da Ficha" onClick={() => window.open(`/api/fichas/${fichaAtual.id}/pdf`, '_blank', 'noopener,noreferrer')}><Download className="h-4 w-4" /><span className="hidden min-[480px]:inline">Baixar PDF</span></Button>}
                {podeEscreverFicha && fichaAtual && <Button variant="outline" className={`${atalhoFicha} border-teal-ink bg-teal-pale font-semibold text-teal-ink hover:bg-teal-pale hover:text-teal-ink`} onClick={() => abrirNovoRegistro({ fichaId: fichaAtual.id })}><Plus className="h-4 w-4" /> Novo atendimento</Button>}
                {podeEscreverFicha && fichaAtual && <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 rounded-[8px]" aria-label="Mais ações da Ficha"><Ellipsis className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" disabled={carregandoExclusao} onSelect={() => void abrirExclusaoFicha(fichaAtual.id)}>{carregandoExclusao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Apagar Ficha</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>}
              </div>
              <div className="mx-auto mt-4 w-full max-w-[260px] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-sans text-[17px] font-bold text-text-primary">Odontograma</h2>
                  <button type="button" onClick={() => setOdontogramaCompletoAberto(true)} className="min-h-10 text-[13px] font-semibold text-teal-ink">Ampliar ↗</button>
                </div>
                <p className="text-[12.5px] text-text-secondary">Procedimentos da ficha · dentes permanentes</p>
                <div className="mx-auto w-fit max-w-full overflow-hidden" data-ficha-odontograma>
                  <div className={`w-max origin-top-left [zoom:0.35] [&_button>span[style*='font-size']]:text-[26px]! [&>div>div:last-child]:hidden ${podeComplementar ? '[&>div>div:first-child]:hidden' : ''}`}>
                    <Odontograma selectedTeeth={[]} eventos={eventosDaFicha} onToothToggle={(dente) => abrirProcedimentoDoDente(eventosDaFicha, dente)} presentationMode={!podeComplementar} hideFilters />
                  </div>
                </div>
                <p className="border-l-2 border-teal-ink py-2 pl-3 text-[12px] leading-[18px] text-text-secondary">Clique em um dente destacado para localizar seus procedimentos.</p>
              </div>
            </div>
          </div>
          <div data-ficha-atalhos className="mt-5 flex flex-wrap items-center gap-2">
            {superficie.tipo === 'ficha' && fichaAtual && onGerarOrcamento && (
                <OrcamentoDaFicha
                  key={`${clinicaId}:${dentistaId}:${fichaAtual.id}`}
                  clinicaId={clinicaId}
                  dentistaId={dentistaId}
                  fichaId={fichaAtual.id}
                  revisao={`${orcamentoRevisao ?? ''}:${eventosDaFicha.map((item) => `${item.id}:${item.procedimentoNome}:${item.retiradoEm ?? ''}`).join('|')}`}
                  eventosConfirmados={eventosOrcamentoConfirmados}
                  onAbrir={(resumo) => Promise.resolve(onGerarOrcamento(fichaAtual.id, resumo))}
                />
            )}
            {podeEscreverFicha && fichaAtual && (!fichaAtual.assinadoEm || elegiveisParaAssinatura.length > 0) && (
                    <Button
                      variant="outline"
                      className={atalhoFicha}
                      disabled={elegiveisParaAssinatura.length === 0}
                      onClick={() => {
                        setAssinaturaSelecionados(elegiveisParaAssinatura.map((evento) => evento.id));
                        setAssinaturaEtapa('selecao');
                        setAssinaturaAberta(true);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4" /> Coletar assinatura
                    </Button>
            )}
            {podeMarcarRetornoDaVisita && !sessaoMaisRecenteDaFicha.retorno && (
              <Button variant="outline" className={atalhoFicha} onClick={() => {
                setRetornoAtendimentoId(sessaoMaisRecenteDaFicha.atendimentoId);
                setRetornoAberto(true);
              }}>
                <CalendarPlus className="h-4 w-4" /> Marcar retorno
              </Button>
            )}
            <Button variant="outline" className={atalhoFicha} onClick={onAbrirArquivos}><FolderOpen className="h-4 w-4" />Arquivos do paciente</Button>
            {temDocumentoAssinadoDaFicha && <Button variant="outline" className={atalhoFicha} onClick={onAbrirArquivos}><FileText className="h-4 w-4" />Ver documento assinado</Button>}
          </div>
        </header>
        <div data-ficha-grid className="grid min-w-0 grid-cols-1 gap-[30px] p-2.5 min-[601px]:p-6">
          <div className="min-w-0 space-y-4">
            <article data-ficha-procedimentos className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-sans text-[17px] font-bold text-text-primary">Procedimentos</h2>
                {podeEscreverFicha && fichaAtual && (
                  <div className="flex flex-wrap gap-2">
                    {podeAdicionarNaFicha && <Button
                      variant="ghost"
                      className="h-auto min-h-8 px-[9px] py-1.5 text-teal-ink"
                      aria-controls={painelAdicionarId}
                      aria-expanded={fichaComAdicaoAbertaId === fichaAtual.id}
                      onClick={() => setFichaComAdicaoAbertaId((idAberto) => idAberto === fichaAtual.id ? null : fichaAtual.id)}
                    >
                      <Plus className="h-4 w-4" /> {fichaComAdicaoAbertaId === fichaAtual.id ? 'Fechar adição' : 'Adicionar procedimentos'}
                    </Button>}

                  </div>
                )}

                <span className="ml-auto text-[15px] text-text-secondary">por dente</span>
              </div>
              {fichaComAdicaoAbertaId === fichaAtual?.id && fichaAtual && podeAdicionarNaFicha && (
                <div id={painelAdicionarId}>
                  <AdicionarProcedimentosFicha
                    key={`${clinicaId}:${dentistaId}:${patientId}:${fichaAtual.id}`}
                    clinicaId={clinicaId}
                    dentistaId={dentistaId}
                    fichaId={fichaAtual.id}
                    pacienteId={patientId}
                    pacienteNome={patientName}
                    catalogoProcedimentos={catalogoProcedimentos}
                    onFechar={() => setFichaComAdicaoAbertaId(null)}
                    onSalvo={() => router.refresh()}
                  />
                </div>
              )}
              {eventosDaFicha.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">Nenhum procedimento estruturado nesta ficha.</p>
              ) : (
                <div className="mt-3">
                  {agruparProcedimentosPorDente(gruposProcedimento).map(({ dente, linhas }) => (
                    <section key={dente ?? 'boca'} data-grupo-dente={dente ?? 'boca'} aria-label={dente == null ? 'Boca / região' : `Dente ${dente}`} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-3 border-t border-border py-2.5">
                      <div className={dente == null ? 'pt-2 text-xs font-semibold text-teal-ink' : 'flex h-[38px] items-center font-heading text-[19px] leading-[38px] text-teal-ink'}>{dente ?? 'Boca / região'}</div>
                      <ul className="min-w-0">
                      {linhas.map((grupo) => {
                        const evento = grupo.eventoPrincipal;
                        const eventoIds = grupo.eventos.map((item) => item.id);
                        const assinado = grupo.eventos.some((item) => item.assinaturaId != null);
                        const retirado = grupo.eventos.some((item) => item.retiradoEm != null);
                        const temEncaminhamento = grupo.eventos.some((item) => item.encaminhadoParaId != null);
                        const autorAtual = grupo.eventos.every((item) => item.dentistaId === dentistaId);
                        const encaminhadoAoAtual = grupo.eventos.every((item) => item.encaminhadoParaId === dentistaId);
                        const ficha = evento.fichaId === fichaAtual?.id
                          ? fichaAtual
                          : evento.fichaId ? atendimentoAberto.fichas.find((item) => item.id === evento.fichaId) : null;
                        const fichaAssinada = ficha?.assinadoEm != null;
                        const travadoPelaAssinatura = grupo.eventos.some(travadoPelaFicha);
                        const podeAlterarStatus = podeEscreverFicha && !retirado && !assinado && !travadoPelaAssinatura
                          && (temEncaminhamento ? encaminhadoAoAtual : autorAtual);
                        const realizados = grupo.eventos.filter((item) => item.status === 'realizado').length;
                        const todosRealizados = realizados === grupo.eventos.length;
                        const todosAFazer = realizados === 0;
                        const podeOrganizar = podeAlterarStatus && !temEncaminhamento && autorAtual && todosAFazer;
                        const emProximaSessao = todosAFazer && grupo.eventos.every((item) => item.momento_planejado === 'proxima_sessao');
                        const integrantesEditaveis = podeEscreverFicha
                          ? grupo.eventos.filter((item) => !travadoPelaFicha(item) && !item.retiradoEm && !item.assinaturaId && (
                            item.encaminhadoParaId == null
                              ? item.dentistaId === dentistaId
                              : item.encaminhadoParaId === dentistaId && (item.tipo === 'endodontia' || item.tipo === 'implante')
                          ))
                          : [];
                        const podeEditarDetalhes = integrantesEditaveis.length > 0;
                        const eventoVisualizado = grupo.eventos.find((item) => item.id === eventoDetalheAbertoId);
                        const eventoEmEdicao = integrantesEditaveis.find((item) => item.id === eventoDetalheAbertoId);
                        const detalheAberto = eventoVisualizado != null;
                        const podeVerDetalhes = grupo.eventos.some((item) => (
                          (item.tipo === 'endodontia' || item.tipo === 'implante')
                          && item.encaminhadoParaId != null
                        ));
                        const carregando = acaoProcedimento?.startsWith(`${grupo.chave}:`) ?? false;
                        const linhaAberta = linhasProcedimentoAbertas.has(evento.id);
                        return (
                        <li id={`procedimento-${evento.id}`} key={grupo.chave} className="min-w-0 text-sm">
                          <div data-procedimento-linha className="grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_28px_96px_24px] items-center gap-[5px] min-[601px]:grid-cols-[minmax(0,1fr)_38px_135px_110px_24px] min-[601px]:gap-3">
                            <span className="truncate text-[15px] text-text-primary" title={nomeClinicoProcedimento(evento)}>{nomeClinicoProcedimento(evento)}</span>
                            <span className="text-xs text-text-secondary" aria-label="Faces">{evento.ancora.faces?.join('') || '—'}</span>
                            <button type="button" disabled={!podeAlterarStatus || carregando}
                              onClick={() => void atualizarStatusGrupo(grupo, todosRealizados ? 'indicado' : 'realizado')}
                              title={podeAlterarStatus ? 'Alternar entre A fazer e Realizado' : assinado || travadoPelaAssinatura ? 'Assinado · registro bloqueado' : 'Status sem permissão de alteração'}
                              aria-label={`Status de ${nomeClinicoProcedimento(evento)} no ${dente == null ? 'âmbito Boca / região' : `dente ${dente}`}: ${retirado ? 'Retirado da ficha' : todosRealizados ? 'Realizado' : emProximaSessao ? 'A fazer · próxima sessão' : 'A fazer'}`}
                              className={`h-7 min-w-0 truncate rounded-[4px] bg-surface px-1 text-xs disabled:cursor-default ${retirado ? 'text-text-secondary' : 'text-teal-ink'}`}>
                              {retirado ? 'Retirado da ficha' : todosRealizados ? 'Realizado' : !todosAFazer ? `Parcial · ${realizados} de ${grupo.eventos.length}` : emProximaSessao ? 'Próxima sessão' : 'A fazer'}
                            </button>
                            <span data-procedimento-autor className="hidden truncate text-xs text-text-secondary min-[601px]:block" title={evento.autorOriginal.nome}>{evento.autorOriginal.nome}</span>
                            <button type="button" aria-expanded={linhaAberta} aria-controls={`detalhes-procedimento-${evento.id}`}
                              aria-label={`${linhaAberta ? 'Recolher' : 'Expandir'} ${nomeClinicoProcedimento(evento)} · ${rotuloLocalEvento(evento)}`}
                              onClick={() => setLinhasProcedimentoAbertas((atuais) => {
                                const proximas = new Set(atuais);
                                if (proximas.has(evento.id)) proximas.delete(evento.id);
                                else proximas.add(evento.id);
                                return proximas;
                              })}
                              className="flex h-8 w-6 items-center justify-center rounded text-lg text-text-secondary hover:bg-surface-alt hover:text-teal-ink">{linhaAberta ? '−' : '+'}</button>
                          </div>
                          <div id={`detalhes-procedimento-${evento.id}`} hidden={!linhaAberta} className="min-w-0 pb-4 pl-3.5 pt-3">
                            <p className="mb-2 break-words text-sm font-semibold text-text-primary">{nomeClinicoProcedimento(evento)}</p>
                            {evento.observacao && <p className="text-sm leading-[21px] text-text-secondary">{evento.observacao}</p>}
                            <p className="mt-1.5 text-xs text-text-secondary">
                              Registrado por {evento.autorOriginal.nome}
                              {evento.autorOriginal.cro ? ` · CRO ${evento.autorOriginal.cro}` : ''}
                            </p>
                            {evento.responsavelEncaminhado && (
                              <p className="mt-1 text-xs font-medium text-teal-ink">
                                Responsável clínico: {evento.responsavelEncaminhado.nome}
                                {evento.responsavelEncaminhado.cro ? ` · CRO ${evento.responsavelEncaminhado.cro}` : ''}
                              </p>
                            )}
                            {!evento.ultimaAlteracao && <p className="mt-1.5 text-xs text-text-secondary">Último registro: {/^\d{4}-\d{2}-\d{2}$/.test(evento.atualizadoEm) ? formatarData(evento.atualizadoEm) : formatarDataHora(evento.atualizadoEm)} · {evento.autorOriginal.nome}</p>}
                            {evento.ultimaAlteracao && (
                              <p className="mt-1.5 text-xs text-text-secondary">
                                Última alteração: {evento.ultimaAlteracao.atorNome ?? 'Profissional não identificado'} · {formatarDataHora(evento.ultimaAlteracao.alteradoEm)} · {rotuloUltimaAlteracao(evento.ultimaAlteracao.acao)}
                              </p>
                            )}
                            {retirado && <p className="mt-1.5 text-xs font-semibold text-text-secondary">Retirado da ficha</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                            {podeAlterarStatus && (
                              <div role="group" className="inline-flex rounded-lg border border-border bg-surface p-0.5" aria-label="Status clínico">
                                <button
                                  type="button"
                                  disabled={carregando}
                                  aria-pressed={todosAFazer}
                                  onClick={() => void atualizarStatusGrupo(grupo, 'indicado')}
                                  className={todosAFazer
                                    ? 'min-h-11 rounded-md bg-coral-pale px-3 py-1.5 text-xs font-bold text-coral-ink'
                                    : 'min-h-11 rounded-md px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary'}
                                >
                                  A fazer
                                </button>
                                <button
                                  type="button"
                                  disabled={carregando}
                                  aria-pressed={todosRealizados}
                                  onClick={() => void atualizarStatusGrupo(grupo, 'realizado')}
                                  className={todosRealizados
                                    ? 'min-h-11 rounded-md bg-clinical-done-pale px-3 py-1.5 text-xs font-bold text-clinical-done-ink'
                                    : 'min-h-11 rounded-md px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary'}
                                >
                                  Realizado
                                </button>
                              </div>
                            )}
                            {podeOrganizar && (
                              <button
                                type="button"
                                disabled={carregando}
                                onClick={() => void atualizarProximaSessao(grupo)}
                                className={emProximaSessao
                                  ? 'inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-warning-pale px-3 text-xs font-bold text-warning-ink'
                                  : 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary hover:border-warning/40 hover:text-warning-ink'}
                              >
                                <Star className={`h-3.5 w-3.5 ${emProximaSessao ? 'fill-current' : ''}`} />
                                {emProximaSessao ? 'Planejado para a próxima sessão' : 'Levar para próxima sessão'}
                              </button>
                            )}
                            {podeEscreverFicha && autorAtual && !temEncaminhamento && !retirado && !assinado && !travadoPelaAssinatura && todosAFazer && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEncaminhamentoEventoIds(eventoIds);
                                  setDestinoEncaminhamentoId(evento.encaminhadoParaId ?? '');
                                }}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary hover:border-teal/40 hover:text-teal-ink"
                              >
                                <Forward className="h-3.5 w-3.5" /> {evento.encaminhadoParaId ? 'Alterar encaminhamento' : 'Encaminhar'}
                              </button>
                            )}
                            {(podeEditarDetalhes || podeVerDetalhes) && (
                              <button
                                type="button"
                                onClick={() => detalheAberto ? setEventoDetalheAbertoId(null) : abrirDetalhesDoEvento(
                                  integrantesEditaveis[0]
                                  ?? grupo.eventos.find((item) => item.tipo === 'endodontia' || item.tipo === 'implante')
                                  ?? grupo.eventos[0],
                                )}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-text-secondary hover:bg-surface hover:text-text-primary"
                              >
                                <PenLine className="h-3.5 w-3.5" /> {detalheAberto ? 'Fechar detalhes' : podeEditarDetalhes ? grupo.eventos.length > 1 ? 'Editar integrantes' : autorAtual ? 'Editar procedimento' : 'Editar detalhes' : 'Ver detalhes'}
                              </button>
                            )}
                            {ficha && podeEscreverFicha && autorAtual && (assinado || fichaAssinada) && (
                              <button
                                type="button"
                                onClick={() => complementarAtendimento(atendimentoAberto, evento.ancora.dente ?? null)}
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-text-secondary hover:bg-surface hover:text-text-primary"
                              >
                                <PenLine className="h-3.5 w-3.5" /> Adicionar retificação
                              </button>
                            )}
                            {assinado && <span className="text-xs font-semibold text-text-secondary">Assinado · registro bloqueado</span>}
                            {carregando && <Loader2 className="h-4 w-4 animate-spin text-teal" aria-label="Salvando" />}
                          </div>
                          {eventoVisualizado && (
                            <div>
                            {eventoEmEdicao && grupo.eventos.length > 1 && (
                              <label className="mt-3 grid gap-1.5 text-xs font-semibold text-foreground">
                                Integrante que deseja editar
                                <select
                                  className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm"
                                  value={eventoEmEdicao.id}
                                  onChange={(event) => setEventoDetalheAbertoId(event.target.value)}
                                >
                                  {integrantesEditaveis.map((item) => (
                                    <option key={item.id} value={item.id}>{rotuloLocalEvento(item)} · {nomeClinicoProcedimento(item)}</option>
                                  ))}
                                </select>
                                <span className="font-normal text-muted-foreground">A alteração vale somente para o integrante selecionado.</span>
                              </label>
                            )}
                            <ProcedimentoDetalheFicha
                              key={eventoVisualizado.id}
                              evento={eventoVisualizado}
                              permitirNome={eventoEmEdicao?.dentistaId === dentistaId && eventoEmEdicao.encaminhadoParaId == null}
                              permitirObservacao={eventoEmEdicao?.dentistaId === dentistaId && eventoEmEdicao.encaminhadoParaId == null}
                              permitirDetalhe={eventoEmEdicao != null && (eventoEmEdicao.tipo === 'endodontia' || eventoEmEdicao.tipo === 'implante')}
                              permitirExclusao={eventoEmEdicao?.dentistaId === dentistaId && eventoEmEdicao.encaminhadoParaId == null}
                              somenteLeitura={eventoEmEdicao == null}
                              onFechar={() => setEventoDetalheAbertoId(null)}
                              onSalvo={() => {
                                setEventoDetalheAbertoId(null);
                                router.refresh();
                              }}
                              onExcluido={() => {
                                setEventoDetalheAbertoId(null);
                                router.refresh();
                              }}
                              onRevisarOrcamento={onGerarOrcamento && fichaAtual
                                ? () => onGerarOrcamento(fichaAtual.id)
                                : undefined}
                            />
                            </div>
                          )}
                          </div>
                        </li>
                        );
                      })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </article>
            <GrupoEditoresEvolucao key={chaveDoHistorico}>
            <section data-ficha-historico className="mt-5! border-t border-border pt-3.5" aria-label="Linha do tempo da ficha">
              <h2 className="font-sans text-[17px] font-bold text-text-primary">Linha do tempo da ficha</h2>
              <p className="mt-2 text-[12.5px] text-text-secondary">Sessões desta ficha · mais recentes primeiro</p>
              {sessoesVisiveis.map((visita) => {
                const procedimentos = visita.eventos
                  .map((evento) => `${nomeClinicoProcedimento(evento)} · ${rotuloLocalEvento(evento)}`)
                  .filter((item, indice, itens) => itens.indexOf(item) === indice);
                const destacada = historicoDaFicha.length > 1 && visita.id === visitaSolicitadaId;
                const temAssinatura = visita.documentos.length > 0
                  || visita.eventos.some((evento) => evento.assinaturaId != null)
                  || visita.fichas.some((ficha) => ficha.assinadoEm != null);
                const outrasFichas = superficie.tipo === 'ficha'
                  ? outrasFichasDaSessao(visita.id, superficie.fichaId, atendimentos) : [];
                const hora = visita.dataAtendimento.includes('T') ? visita.dataAtendimento : visita.criadoEm;
                return (
                  <section key={visita.id} id={`sessao-ficha-${idFichaDoHistorico}-${visita.id}`}
                    data-sessao={visita.id} aria-current={destacada ? 'true' : undefined}
                    className={`scroll-mt-6 border-b border-border py-3.5 ${destacada ? 'bg-muted/20' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-sans text-sm font-bold text-text-primary">
                        {format(new Date(`${visita.dataAtendimento.slice(0, 10)}T12:00:00`), 'dd/MM/yyyy')} · {format(new Date(hora), 'HH:mm')} · {visita.profissional.nome}
                      </h3>
                      {temAssinatura && <span className="text-xs text-teal-ink">Assinado</span>}
                    </div>
                    <p className="mt-1.5 break-words text-[15px] text-text-secondary">{procedimentos.length > 0 ? procedimentos.join(' · ') : 'Sem procedimentos nesta sessão.'}</p>
                    <div className="mt-3">
                      <EvolucaoClinicaFicha key={`${clinicaId}:${dentistaId}:${chaveDoHistorico}:${visita.id}`}
                        atendimento={visita} pacienteId={patientId} dentistaId={dentistaId}
                        canWrite={podeEscreverFicha} />
                    </div>
                    {visita.retorno && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                        <span>Retorno: {format(new Date(visita.retorno.dataHora), 'dd/MM HH:mm')} · {rotuloStatusAgenda(visita.retorno.status)}</span>
                        <button type="button" className="min-h-8 text-teal-ink hover:underline" onClick={() => router.push(`/dashboard/agendamentos?v=dia&d=${visita.retorno!.dataHora.slice(0, 10)}`)}>Ver na Agenda</button>
                      </p>
                    )}
                    {outrasFichas.map((outraFicha) => (
                      <p key={outraFicha.id} className="mt-2 text-xs text-text-secondary">
                        Também na ficha{' '}
                        <button type="button" className="min-h-8 break-words text-left text-teal-ink hover:underline" onClick={() => abrirFicha(outraFicha.id, visita.id)}>{outraFicha.nome}</button>
                      </p>
                    ))}
                  </section>
                );
              })}
              {!mostrarHistoricoCompleto && historicoDaFicha.length > 10 && (
                <Button variant="outline" className="mt-3 h-10 rounded-[8px]" onClick={() => setFichasComHistoricoCompleto((atuais) => new Set(atuais).add(chaveDoHistorico))}>
                  Mostrar sessões anteriores ({historicoDaFicha.length - 10})
                </Button>
              )}
            </section>
            </GrupoEditoresEvolucao>
          </div>
        </div>

        </article>

      <MarcarRetornoModal
        open={retornoAberto}
        onOpenChange={(open) => {
          setRetornoAberto(open);
          if (!open) setRetornoAtendimentoId(null);
        }}
        pacienteNome={patientName}
        role="dentista"
        dentistasClinica={[]}
        dentistaAlvoId={dentistaId}
        onDentistaAlvoChange={() => undefined}
        form={retorno.form}
        setForm={retorno.setForm}
        error={retorno.error}
        saving={retorno.saving}
        pedidoPendente={retorno.pedidoPendente}
        onMarcarRetorno={() => void retorno.marcarRetorno(dentistaId)}
        onTentarEnviarPedido={() => void retorno.tentarEnviarPedido(dentistaId)}
      />

        {exclusaoFichaId && resumoExclusao && <ConfirmarExclusaoFicha
          key={exclusaoFichaId}
          resumo={resumoExclusao}
          apagando={apagandoFicha}
          onCancelar={() => {
            setExclusaoFichaId(null);
            setResumoExclusao(null);
          }}
          onConfirmar={confirmarExclusaoFicha}
        />}

        <Dialog open={odontogramaCompletoAberto} onOpenChange={setOdontogramaCompletoAberto}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[1180px] overflow-hidden p-3 sm:w-[calc(100vw-2rem)] sm:max-w-[1180px] sm:p-6">
            <DialogHeader>
              <DialogTitle>Odontograma completo</DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden">
              <div className={ODONTOGRAMA_RESPONSIVO}>
                <Odontograma
                  selectedTeeth={[]}
                  eventos={eventosDaFicha}
                  onToothToggle={(dente) => {
                    const temProcedimento = eventosDaFicha.some((evento) => evento.ancora.dente === dente);
                    if (!temProcedimento) return;
                    setOdontogramaCompletoAberto(false);
                    abrirProcedimentoDoDente(eventosDaFicha, dente);
                  }}
                  presentationMode
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={complementoPendente != null} onOpenChange={(open) => { if (!open) setComplementoPendente(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Em qual Ficha entra?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">
              Esta consulta toca mais de uma Ficha. Escolha o destino para preservar a organização clínica.
            </p>
            <div className="grid gap-2">
              {complementoPendente?.atendimento.fichas.map((ficha) => (
                <Button
                  key={ficha.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    const pendente = complementoPendente;
                    setComplementoPendente(null);
                    if (!pendente) return;
                    abrirNovoRegistro({
                      fichaId: ficha.id,
                      dente: pendente.dente,
                      atendimentoOrigemId: pendente.atendimento.id,
                    });
                  }}
                >
                  <FolderOpen className="h-4 w-4" /> {ficha.nome}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={encaminhamentoEventoIds.length > 0} onOpenChange={(open) => { if (!open) setEncaminhamentoEventoIds([]); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Encaminhar procedimento</DialogTitle>
              <DialogDescription>O procedimento continua na mesma ficha; o nome de quem alterar e a data ficam registrados.</DialogDescription>
            </DialogHeader>
            <label className="grid gap-2 text-sm font-semibold text-text-primary">
              Dentista responsável
              <select
                value={destinoEncaminhamentoId}
                onChange={(event) => setDestinoEncaminhamentoId(event.target.value)}
                className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-teal"
              >
                <option value="">Sem encaminhamento</option>
                {dados.profissionaisClinicos.filter((profissional) => profissional.id !== dentistaId).map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>{profissional.nome}{profissional.cro ? ` · CRO ${profissional.cro}` : ''}</option>
                ))}
              </select>
            </label>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEncaminhamentoEventoIds([])}>Cancelar</Button>
              <Button disabled={acaoProcedimento === 'encaminhamento'} onClick={() => void salvarEncaminhamento()}>
                {acaoProcedimento === 'encaminhamento' && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar encaminhamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assinaturaAberta} onOpenChange={(open) => {
          setAssinaturaAberta(open);
          if (!open) setAssinaturaEtapa('selecao');
        }}>
          <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Coletar assinatura</DialogTitle>
              <DialogDescription>
                {assinaturaEtapa === 'selecao'
                  ? 'Escolha um, vários ou todos os procedimentos realizados.'
                  : 'A assinatura gera um documento por ficha e salva em Documentos do paciente.'}
              </DialogDescription>
            </DialogHeader>

            {assinaturaEtapa === 'selecao' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Procedimentos desta ficha</p>
                  <button
                    type="button"
                    onClick={() => setAssinaturaSelecionados(elegiveisParaAssinatura.map((evento) => evento.id))}
                    className="text-xs font-bold text-teal-ink hover:underline"
                  >
                    Selecionar todos os elegíveis
                  </button>
                </div>
                <div className="grid gap-2">
                  {gruposProcedimento.map((grupo) => {
                    const elegiveis = grupo.eventos.filter((evento) => (
                      evento.status === 'realizado'
                      && evento.assinaturaId == null
                      && evento.retiradoEm == null
                      && evento.fichaId != null
                      && !travadoPelaFicha(evento)
                      && (evento.encaminhadoParaId ?? evento.dentistaId) === dentistaId
                    ));
                    const habilitado = elegiveis.length > 0;
                    const marcado = habilitado && elegiveis.every((evento) => assinaturaSelecionados.includes(evento.id));
                    return (
                      <button
                        key={grupo.chave}
                        type="button"
                        disabled={!habilitado}
                        onClick={() => {
                          const ids = elegiveis.map((evento) => evento.id);
                          setAssinaturaSelecionados((atuais) => marcado
                            ? atuais.filter((id) => !ids.includes(id))
                            : [...new Set([...atuais, ...ids])]);
                        }}
                        className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span className={marcado
                          ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-teal bg-teal text-primary-foreground'
                          : 'h-5 w-5 shrink-0 rounded border border-border bg-surface-alt'}>
                          {marcado && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-text-primary">{nomeClinicoProcedimento(grupo.eventoPrincipal)}</span>
                          <span className="block text-xs text-text-secondary">
                            {habilitado ? 'Realizado · disponível para assinatura' : grupo.eventoPrincipal.status !== 'realizado' ? 'A fazer · conclua antes de assinar' : 'Já assinado ou sem ficha vinculada'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAssinaturaAberta(false)}>Cancelar</Button>
                  <Button disabled={assinaturaSelecionados.length === 0} onClick={() => setAssinaturaEtapa('coleta')}>Continuar</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="grid gap-4">
                  <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
                    Nome de quem assina
                    <input value={assinadoPor} onChange={(event) => setAssinadoPor(event.target.value)} className="min-h-11 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-teal" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
                    Orientações registradas no documento
                    <textarea value={orientacoesAssinatura} onChange={(event) => setOrientacoesAssinatura(event.target.value)} rows={3} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-teal" />
                  </label>
                  <SignaturePad padRef={assinaturaPadRef} />
                </div>
                <DialogFooter>
                  <Button variant="ghost" disabled={salvandoAssinatura} onClick={() => setAssinaturaEtapa('selecao')}>Voltar</Button>
                  <Button disabled={salvandoAssinatura} onClick={() => void salvarAssinaturas(eventosDaFicha)}>
                    {salvandoAssinatura && <Loader2 className="h-4 w-4 animate-spin" />}
                    Assinar e salvar documento
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Prontuário do paciente">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-border bg-surface px-4 py-4">
        <div>
          <p className="font-heading text-xl text-text-primary">Prontuário</p>
          <p className="mt-0.5 text-[15px] text-text-secondary">Consultas e histórico clínico do paciente.</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setImportacaoHistoricoAberta(true)} className="h-10 rounded-[8px] text-[13px]">
              <FileText className="h-4 w-4" /> Importar histórico
            </Button>
            <Button onClick={() => abrirNovoRegistro()} className="h-10 rounded-[8px] border border-teal-ink/30 bg-teal-pale text-[13px] text-teal-ink hover:bg-teal-pale/80">
              <Plus className="h-4 w-4" /> Novo atendimento
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-[12px] border border-border bg-surface p-4 shadow-none">
            <div className="flex flex-wrap gap-2">
              {([
                ['atendimentos', `${atendimentos.length} atendimento${atendimentos.length === 1 ? '' : 's'}`],
                ['pendencias', `${pendencias} pendência${pendencias === 1 ? '' : 's'}`],
              ] as const).map(([tipo, rotulo]) => {
                const aberto = resumoAberto === tipo;
                return (
                  <button
                    key={tipo}
                    type="button"
                    aria-expanded={aberto}
                    onClick={() => {
                      setResumoAberto(aberto ? null : tipo);
                      if (tipo === 'pendencias') setFiltroClinico('indicado');
                      if (tipo === 'atendimentos') setFiltroClinico('tudo');
                    }}
                    className={tipo === 'pendencias'
                      ? `inline-flex min-h-10 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-bold transition-colors ${aberto ? 'border-coral/50 bg-coral/15 text-coral-ink' : 'border-transparent bg-coral/10 text-coral-ink hover:border-coral/30'}`
                      : `inline-flex min-h-10 items-center gap-1 rounded-[8px] border px-3 text-[12.5px] font-bold transition-colors ${aberto ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border bg-surface-alt text-text-primary hover:border-teal/30'}`}
                  >
                    {rotulo} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                  </button>
                );
              })}
            </div>

            {resumoAberto && (
              <div className="mt-4 border-t border-border pt-3" aria-live="polite">
                {resumoAberto === 'atendimentos' && (
                  <div className="grid gap-1">
                    {atendimentos.slice(0, 5).flatMap((atendimento) => (
                      atendimento.fichas.length > 0
                        ? atendimento.fichas.map((ficha) => (
                          <button key={`${atendimento.id}:${ficha.id}`} type="button" onClick={() => abrirFicha(ficha.id, atendimento.id)} className="flex min-h-10 items-center justify-between gap-3 rounded-[8px] px-2 text-left text-[12.5px] font-semibold text-text-primary hover:bg-surface-alt">
                            <span>{formatarData(atendimento.dataAtendimento)} · {ficha.nome}</span><span className="text-text-secondary">Abrir ficha →</span>
                          </button>
                        ))
                        : [(
                          <button key={atendimento.id} type="button" onClick={() => abrirLegado(atendimento.id)} className="flex min-h-10 items-center justify-between gap-3 rounded-[8px] px-2 text-left text-[12.5px] font-semibold text-text-primary hover:bg-surface-alt">
                            <span>{formatarData(atendimento.dataAtendimento)}</span><span className="text-text-secondary">Abrir legado →</span>
                          </button>
                        )]
                    ))}
                    {atendimentos.length === 0 && <p className="text-[12.5px] text-text-secondary">Nenhum atendimento registrado.</p>}
                  </div>
                )}
                {resumoAberto === 'pendencias' && (
                  <div className="grid gap-1">
                    {eventosPendentes.slice(0, 6).map((evento) => {
                      const atendimento = atendimentos.find((item) => item.eventos.some((e) => e.id === evento.id));
                      return (
                        <button
                          key={evento.id}
                          type="button"
                          onClick={() => {
                            if (!atendimento) return;
                            if (evento.fichaId) abrirFicha(evento.fichaId, atendimento.id);
                            else abrirLegado(atendimento.id);
                          }}
                          disabled={!atendimento}
                          className="flex min-h-10 items-center justify-between gap-3 rounded-[8px] px-2 text-left text-[12.5px] font-semibold text-text-primary hover:bg-surface-alt disabled:cursor-default disabled:opacity-60"
                        >
                          <span>{nomeClinicoProcedimento(evento)}{evento.ancora.dente ? ` · ${evento.ancora.dente}` : ''}</span>
                          <span className="text-text-secondary">{atendimento ? 'Abrir pendência →' : 'Pendente'}</span>
                        </button>
                      );
                    })}
                    {eventosPendentes.length === 0 && <p className="text-[12.5px] text-text-secondary">Nenhuma pendência clínica.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-border">
        {([
          ['tudo', 'Tudo'],
          ['indicado', 'Indicados'],
          ['realizado', 'Realizados'],
        ] as const).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={filtroClinico === valor}
            onClick={() => setFiltroClinico(valor)}
            className={filtroClinico === valor
              ? 'min-h-10 border-b-2 border-teal-ink pb-3 text-[15px] font-bold text-teal-ink'
              : 'min-h-10 border-b-2 border-transparent pb-3 text-[15px] text-text-secondary transition-colors hover:text-text-primary'}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {dadosLocais.errosParciais.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/30 bg-coral/5 px-3 py-2.5">
          <p className="flex items-center gap-2 text-[12.5px] text-text-primary">
            <AlertTriangle className="h-4 w-4 shrink-0 text-coral-ink" aria-hidden />
            Não foi possível carregar: {dadosLocais.errosParciais.join(', ')}. O restante do prontuário continua disponível.
          </p>
          <Button variant="ghost" size="sm" className="h-10 rounded-[8px]" onClick={() => router.refresh()}>Atualizar</Button>
        </div>
      )}

      {atendimentos.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-surface px-6 py-12 text-center">
          <FileText className="mx-auto h-9 w-9 text-text-secondary/40" aria-hidden />
          <p className="mt-3 text-[15px] font-semibold text-text-primary">Nenhum atendimento registrado ainda.</p>
          <p className="mt-1 text-[12.5px] text-text-secondary">O primeiro atendimento pode ser feito aqui, manualmente ou com o Dex.</p>
        </div>
      ) : atendimentosVisiveis.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="text-[15px] font-semibold text-text-primary">Nenhum atendimento corresponde a este filtro.</p>
          <button type="button" onClick={() => setFiltroClinico('tudo')} className="mt-2 min-h-10 rounded-[8px] px-2 text-[12.5px] font-bold text-teal-ink hover:underline">
            Mostrar todos os atendimentos
          </button>
        </div>
      ) : (
        <ol className="space-y-3">
          {atendimentosVisiveis.map((atendimento) => {
            const texto = textoDaVisita(atendimento);
            const temAssinatura = atendimento.fichas.some((ficha) => ficha.assinadoEm != null);
            return (
              <li key={atendimento.id} className="rounded-[12px] border border-border bg-surface p-4 shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-text-primary">{formatarData(atendimento.dataAtendimento)}</p>
                    <p className="mt-0.5 text-[12.5px] text-text-secondary">{rotuloOrigem(atendimento)} · {atendimento.profissional.nome}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-surface-alt px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                      {atendimento.eventos.length} procedimento{atendimento.eventos.length === 1 ? '' : 's'}
                    </span>
                    {temAssinatura && <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal-ink">Assinado</span>}
                  </div>
                </div>

                {texto ? (
                  <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-text-primary">{texto}</p>
                ) : (
                  <p className="mt-3 text-[15px] italic text-text-secondary">Sem evolução textual registrada.</p>
                )}

                {atendimento.eventos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {atendimento.eventos.slice(0, 8).map((evento) => (
                      <span key={evento.id} className="rounded-[8px] border border-border bg-surface-alt px-2.5 py-1 text-[12.5px] text-text-secondary">
                        {nomeClinicoProcedimento(evento)}{evento.ancora.dente ? ` · ${evento.ancora.dente}` : ''}
                      </span>
                    ))}
                    {atendimento.eventos.length > 8 && <span className="px-2 py-1 text-[12.5px] text-text-secondary">+{atendimento.eventos.length - 8}</span>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {atendimento.fichas.map((ficha) => {
                    const fichaCompleta = fichasPorId.get(ficha.id);
                    const total = fichaCompleta?.totalProcedimentos ?? 0;
                    const realizados = fichaCompleta?.procedimentosRealizados ?? 0;
                    const progresso = total > 0 ? Math.round((realizados / total) * 100) : 0;
                    return (
                      <button
                        key={ficha.id}
                        type="button"
                        onClick={() => abrirFicha(ficha.id, atendimento.id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Abrir ficha · {ficha.nome}
                        {total > 0 && <span className="border-l border-border pl-2 tabular-nums text-text-secondary">{progresso}% · {realizados}/{total}</span>}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                  {atendimento.fichas.length === 0 && (
                    <button
                      type="button"
                      onClick={() => abrirLegado(atendimento.id)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      Abrir registro legado <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onGerarOrcamento && atendimento.fichas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onGerarOrcamento(atendimento.fichas[0]!.id)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      Gerar orçamento
                    </button>
                  )}
                  {atendimento.retorno ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/agendamentos?v=dia&d=${atendimento.retorno!.dataHora.slice(0, 10)}`)}
                      className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      Ver retorno
                    </button>
                  ) : canWrite
                    && atendimento.atendimentoId != null
                    && atendimento.profissional.id === dentistaId && (
                    <button
                      type="button"
                      onClick={() => {
                        setRetornoAtendimentoId(atendimento.atendimentoId);
                        setRetornoAberto(true);
                      }}
                      className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-[8px] border border-border px-3 text-[12.5px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Marcar retorno
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <MarcarRetornoModal
        open={retornoAberto}
        onOpenChange={(open) => {
          setRetornoAberto(open);
          if (!open) setRetornoAtendimentoId(null);
        }}
        pacienteNome={patientName}
        role="dentista"
        dentistasClinica={[]}
        dentistaAlvoId={dentistaId}
        onDentistaAlvoChange={() => undefined}
        form={retorno.form}
        setForm={retorno.setForm}
        error={retorno.error}
        saving={retorno.saving}
        pedidoPendente={retorno.pedidoPendente}
        onMarcarRetorno={() => void retorno.marcarRetorno(dentistaId)}
        onTentarEnviarPedido={() => void retorno.tentarEnviarPedido(dentistaId)}
      />

      <ColarDoWordDialog
        pacienteId={patientId}
        pacienteNome={patientName}
        open={importacaoHistoricoAberta}
        onOpenChange={setImportacaoHistoricoAberta}
        onImportado={() => router.refresh()}
      />
    </section>
  );
}
