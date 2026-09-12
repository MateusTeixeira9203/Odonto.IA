'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowLeft, CalendarPlus, Check, ChevronDown, ChevronRight, ClipboardCheck, Download, Ellipsis, FileText, FolderOpen, Forward, Loader2, PenLine, Plus, Star, Stethoscope, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToothDetailPanel } from '@/components/odontograma/ToothDetailPanel';
import { Odontograma } from '@/components/odontograma/Odontograma';
import { ProcedimentoDetalheFicha } from '@/components/pacientes/procedimento-detalhe-ficha';
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
import { TIPO_LABEL } from '@/types/odontograma';
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
  dentistaId: string;
  canWrite: boolean;
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  dados: ProntuarioLongitudinalData;
  onGerarOrcamento?: (fichaId: string) => void;
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

function rotuloProcedimento(atendimento: ProntuarioAtendimento, eventoId: string): string {
  const evento = atendimento.eventos.find((item) => item.id === eventoId);
  if (!evento) return 'Procedimento clínico';
  return evento.procedimentoNome?.trim() || TIPO_LABEL[evento.tipo];
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

function dataDaAgenda(data: string): string {
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

type ResumoAberto = 'atendimentos' | 'tratamentos' | 'pendencias';

type GrupoProcedimento = {
  chave: string;
  eventos: ProntuarioAtendimento['eventos'];
  eventoPrincipal: ProntuarioAtendimento['eventos'][number];
};

function agruparProcedimentos(atendimento: ProntuarioAtendimento): GrupoProcedimento[] {
  // R-152 — agrupamento anatômico não pode virar ação em lote invisível. Cada card é um
  // procedimento/evento, e ações de status, sessão e encaminhamento recebem só o seu id.
  return atendimento.eventos.map((evento) => ({
    chave: evento.id,
    eventos: [evento],
    eventoPrincipal: evento,
  }));
}

const ODONTOGRAMA_RESPONSIVO = 'origin-top-left [zoom:0.46] min-[480px]:[zoom:0.62] sm:[zoom:0.78] md:[zoom:0.9] xl:[zoom:1]';

export function ProntuarioTab({
  patientId,
  patientName,
  dentistaId,
  canWrite,
  catalogoProcedimentos,
  dados,
  onGerarOrcamento,
  onAbrirArquivos,
}: ProntuarioTabProps) {
  const router = useRouter();
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
  const [eventoDetalheAbertoId, setEventoDetalheAbertoId] = useState<string | null>(null);
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
    boca: dados.boca,
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

  const atendimentos = useMemo(() => dados.atendimentos, [dados.atendimentos]);
  const fichaAberta = superficie.tipo === 'ficha'
    ? dados.fichas.find((ficha) => ficha.id === superficie.fichaId) ?? null
    : null;
  const atendimentoAberto = superficie.tipo === 'ficha'
    ? fichaAberta?.atendimentos.find((atendimento) => atendimento.id === superficie.atendimentoId)
      ?? fichaAberta?.atendimentos[0]
      ?? null
    : superficie.tipo === 'legado'
      ? atendimentos.find((atendimento) => atendimento.id === superficie.atendimentoId) ?? null
      : null;
  const atendimentosVisiveis = atendimentos.filter((atendimento) => (
    filtroClinico === 'tudo' || atendimento.eventos.some((evento) => evento.status === filtroClinico)
  ));
  const tratamentosEmCurso = dados.fichas.filter((ficha) => (
    ficha.status === 'aberta'
    && (ficha.totalProcedimentos === 0 || ficha.procedimentosPendentes > 0)
  ));
  const todasFichas = dados.fichas;
  const eventosClinicosUnicos = Array.from(new Map(
    dados.atendimentos.flatMap((atendimento) => atendimento.eventos).map((evento) => [evento.id, evento] as const),
  ).values());
  const resumosTratamento = tratamentosEmCurso.map((ficha) => {
    const eventos = eventosClinicosUnicos.filter((evento) => evento.fichaId === ficha.id);
    const realizados = eventos.filter((evento) => evento.status === 'realizado').length;
    const procedimentos = [...new Set(eventos.map((evento) => (
      evento.procedimentoNome?.trim() || TIPO_LABEL[evento.tipo]
    )))];
    return {
      ficha,
      realizados,
      total: eventos.length,
      progresso: eventos.length > 0 ? Math.round((realizados / eventos.length) * 100) : 0,
      procedimentos,
    };
  });
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

  function abrirProcedimentoDoDente(atendimento: ProntuarioAtendimento, dente: number): void {
    const evento = atendimento.eventos.find((item) => item.ancora.dente === dente);
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
    setAcaoProcedimento(`${grupo.chave}:status`);
    const resultado = encaminhadoAoAtual && !grupo.eventos.every((evento) => evento.dentistaId === dentistaId)
      ? await atualizarStatusEncaminhado({ eventoIds, novoStatus })
      : await alternarStatusRegistro({ eventoIds, novoStatus });
    setAcaoProcedimento(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
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
    setAcaoProcedimento('encaminhamento');
    const resultado = await encaminharProcedimento({
      eventoIds: encaminhamentoEventoIds,
      dentistaDestinoId: destinoEncaminhamentoId || null,
    });
    setAcaoProcedimento(null);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setEncaminhamentoEventoIds([]);
    toast.success(destinoEncaminhamentoId ? 'Procedimento encaminhado.' : 'Encaminhamento removido.');
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

  async function confirmarExclusaoFicha(): Promise<void> {
    if (!exclusaoFichaId) return;
    setApagandoFicha(true);
    const resultado = await deletarFicha(exclusaoFichaId);
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

  async function salvarAssinaturas(atendimento: ProntuarioAtendimento): Promise<void> {
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
    const selecionados = atendimento.eventos.filter((evento) => assinaturaSelecionados.includes(evento.id));
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
    const gruposProcedimento = agruparProcedimentos(atendimentoAberto);
    const fichaAtual = fichaAberta ?? atendimentoAberto.fichas[0] ?? null;
    const historicoDaFicha = fichaAberta?.atendimentos ?? [atendimentoAberto];
    const progressoDaFicha = fichaAberta && fichaAberta.totalProcedimentos > 0
      ? Math.round((fichaAberta.procedimentosRealizados / fichaAberta.totalProcedimentos) * 100)
      : 0;
    const elegiveisParaAssinatura = atendimentoAberto.eventos.filter((evento) => (
      evento.status === 'realizado'
      && evento.assinaturaId == null
      && evento.fichaId != null
      && evento.dentistaId === dentistaId
    ));
    const podeEscreverFicha = podeEditarProcedimentosDaSuperficie(superficie, canWrite);
    const podeComplementar = podeEscreverFicha;
    const podeMarcarRetornoDaVisita = podeEscreverFicha
      && atendimentoAberto.atendimentoId != null
      && atendimentoAberto.profissional.id === dentistaId;

    return (
      <section className="space-y-4" aria-label="Ficha aberta no prontuário">
        <header className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
            <button type="button" onClick={voltarAoContextoAnterior} className="mb-1 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-teal-ink hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao prontuário
            </button>
            <p className="font-heading text-2xl text-text-primary">{fichaAtual?.nome ?? `Registro de ${formatarData(atendimentoAberto.dataAtendimento)}`}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span>{fichaAtual ? `Responsável: ${fichaAtual.responsavel.nome}` : atendimentoAberto.profissional.nome}</span>
              <span aria-hidden>·</span>
              <span>Consulta de {formatarData(atendimentoAberto.dataAtendimento)}</span>
              {fichaAtual && (
                <span className="rounded-full border border-border bg-surface-alt px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                  {fichaAtual.status === 'aberta' ? 'Em curso' : fichaAtual.status}
                </span>
              )}
            </div>
            {fichaAberta && (
              <div className="mt-3 grid max-w-md gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <span
                  role="progressbar"
                  aria-label="Progresso da Ficha"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressoDaFicha}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-border"
                >
                  <span className="block h-full rounded-full bg-teal" style={{ width: `${progressoDaFicha}%` }} />
                </span>
                <span className="whitespace-nowrap text-xs font-bold tabular-nums text-text-secondary">
                  {progressoDaFicha}% · {fichaAberta.procedimentosRealizados} de {fichaAberta.totalProcedimentos} procedimentos
                </span>
              </div>
            )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-none">
              {podeEscreverFicha && fichaAtual && (
                <Button className="min-h-11 flex-1 sm:min-h-8 sm:flex-none" onClick={() => abrirNovoRegistro({ fichaId: fichaAtual.id })}>
                  <Plus className="h-4 w-4" /> Novo atendimento
                </Button>
              )}
              {fichaAtual && (
                <Button
                  variant="outline"
                  className="min-h-11 px-3 sm:min-h-8"
                  aria-label="Baixar PDF da Ficha"
                  onClick={() => window.open(`/api/fichas/${fichaAtual.id}/pdf`, '_blank', 'noopener,noreferrer')}
                >
                  <Download className="h-4 w-4" /> <span className="hidden min-[480px]:inline">Baixar PDF</span>
                </Button>
              )}
              {podeEscreverFicha && fichaAtual && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="min-h-11 sm:min-h-8" aria-label="Mais ações da Ficha">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      disabled={carregandoExclusao}
                      onSelect={() => void abrirExclusaoFicha(fichaAtual.id)}
                    >
                      {carregandoExclusao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Apagar Ficha
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.05fr)_minmax(300px,0.72fr)]">
          <div className="space-y-4">
            <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Evolução clínica</p>
                  <p className="mt-1 text-xs text-text-secondary">Registro da consulta em exibição.</p>
                </div>
                {podeComplementar && (
                  <Button className="min-h-11 w-full sm:min-h-8 sm:w-auto" variant="outline" onClick={() => complementarAtendimento(atendimentoAberto)}>
                    <Plus className="h-4 w-4" /> Complementar consulta
                  </Button>
                )}
              </div>
              <div className="mt-3 space-y-3">
                {atendimentoAberto.evolucoes.length > 0 ? atendimentoAberto.evolucoes.map((evolucao) => (
                  <div key={evolucao.id} className="border-l-2 border-teal/40 pl-3">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                      {evolucao.texto?.trim() || 'Sem evolução textual registrada.'}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {evolucao.automatica ? 'Registro automático do sistema' : evolucao.profissional.nome}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm italic text-text-secondary">Sem evolução textual registrada.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Odontograma do atendimento</p>
                  <p className="mt-1 text-xs text-text-secondary">Clique em um dente para ir ao procedimento desta consulta. Dentes sem procedimento não abrem formulário.</p>
                </div>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOdontogramaCompletoAberto(true)}>
                  Ver odontograma completo
                </Button>
              </div>
              <div className="mt-3 min-h-[360px] overflow-hidden">
                <div className={ODONTOGRAMA_RESPONSIVO}>
                  <Odontograma
                    selectedTeeth={[]}
                    eventos={atendimentoAberto.eventos}
                    onToothToggle={(dente) => abrirProcedimentoDoDente(atendimentoAberto, dente)}
                    presentationMode={!podeComplementar}
                  />
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Procedimentos</p>
                  <p className="mt-1 text-xs text-text-secondary">Status clínico e organização da próxima sessão são controles separados.</p>
                </div>
                {podeEscreverFicha && (
                  <Button
                    variant="outline"
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
                {atendimentoAberto.documentos.length > 0 && (
                  <Button variant="outline" onClick={onAbrirArquivos}>
                    <FileText className="h-4 w-4" /> Ver documento assinado
                  </Button>
                )}
              </div>
              {atendimentoAberto.eventos.length === 0 ? (
                <p className="mt-3 text-sm text-text-secondary">Nenhum procedimento estruturado nesta visita.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {gruposProcedimento.map((grupo) => {
                    const evento = grupo.eventoPrincipal;
                    const eventoIds = grupo.eventos.map((item) => item.id);
                    const assinado = grupo.eventos.some((item) => item.assinaturaId != null);
                    const autorAtual = grupo.eventos.every((item) => item.dentistaId === dentistaId);
                    const encaminhadoAoAtual = grupo.eventos.every((item) => item.encaminhadoParaId === dentistaId);
                    const ficha = evento.fichaId ? atendimentoAberto.fichas.find((item) => item.id === evento.fichaId) : null;
                    const fichaAssinada = ficha?.assinadoEm != null;
                    const podeAlterarStatus = podeEscreverFicha && !assinado && !fichaAssinada && (autorAtual || encaminhadoAoAtual);
                    const realizados = grupo.eventos.filter((item) => item.status === 'realizado').length;
                    const todosRealizados = realizados === grupo.eventos.length;
                    const todosAFazer = realizados === 0;
                    const podeOrganizar = podeAlterarStatus && autorAtual && todosAFazer;
                    const emProximaSessao = todosAFazer && grupo.eventos.every((item) => item.momento_planejado === 'proxima_sessao');
                    const detalheTecnico = evento.tipo === 'endodontia' || evento.tipo === 'implante';
                    const podeEditarDetalhes = podeEscreverFicha
                      && !assinado
                      && !fichaAssinada
                      && grupo.eventos.length === 1
                      && (autorAtual || (encaminhadoAoAtual && detalheTecnico));
                    const detalheAberto = eventoDetalheAbertoId === evento.id;
                    const statusClasse = todosRealizados
                      ? 'bg-clinical-done-pale text-clinical-done-ink'
                      : !todosAFazer
                        ? 'border border-border bg-surface text-text-secondary'
                        : emProximaSessao
                        ? 'bg-warning-pale text-warning-ink'
                        : 'bg-coral-pale text-coral-ink';
                    const carregando = acaoProcedimento?.startsWith(`${grupo.chave}:`) ?? false;
                    return (
                    <li id={`procedimento-${evento.id}`} key={grupo.chave} className="rounded-xl border border-border bg-surface-alt/40 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                        <p className="font-semibold text-text-primary">
                          {rotuloProcedimento(atendimentoAberto, evento.id)}
                          {evento.ancora.dente != null ? ` · dente ${evento.ancora.dente}` : ''}
                          {grupo.eventos.length > 1 ? ` · ${grupo.eventos.length} dentes/regiões` : ''}
                        </p>
                        {evento.observacao && <p className="mt-0.5 text-xs text-text-secondary">{evento.observacao}</p>}
                        <p className="mt-1.5 text-xs text-text-secondary">
                          Registrado por {evento.autorOriginal.nome}
                          {evento.autorOriginal.cro ? ` · CRO ${evento.autorOriginal.cro}` : ''}
                        </p>
                        {evento.ultimaAlteracao && (
                          <p className="mt-1.5 text-xs text-text-secondary">
                            Última alteração: {evento.ultimaAlteracao.atorNome ?? 'Profissional não identificado'} · {formatarDataHora(evento.ultimaAlteracao.alteradoEm)} · {rotuloUltimaAlteracao(evento.ultimaAlteracao.acao)}
                          </p>
                        )}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasse}`}>
                          {todosRealizados
                            ? 'Realizado'
                            : !todosAFazer
                              ? `Parcial · ${realizados} de ${grupo.eventos.length}`
                              : emProximaSessao
                                ? 'A fazer · próxima sessão'
                                : 'A fazer'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        {podeAlterarStatus && (
                          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" aria-label="Status clínico">
                            <button
                              type="button"
                              disabled={carregando}
                              onClick={() => void atualizarStatusGrupo(grupo, 'indicado')}
                              className={todosAFazer
                                ? 'rounded-md bg-coral-pale px-3 py-1.5 text-xs font-bold text-coral-ink'
                                : 'rounded-md px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary'}
                            >
                              A fazer
                            </button>
                            <button
                              type="button"
                              disabled={carregando}
                              onClick={() => void atualizarStatusGrupo(grupo, 'realizado')}
                              className={todosRealizados
                                ? 'rounded-md bg-clinical-done-pale px-3 py-1.5 text-xs font-bold text-clinical-done-ink'
                                : 'rounded-md px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-text-primary'}
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
                              ? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-warning-pale px-3 text-xs font-bold text-warning-ink'
                              : 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary hover:border-warning/40 hover:text-warning-ink'}
                          >
                            <Star className={`h-3.5 w-3.5 ${emProximaSessao ? 'fill-current' : ''}`} />
                            {emProximaSessao ? 'Planejado para a próxima sessão' : 'Levar para próxima sessão'}
                          </button>
                        )}
                        {podeEscreverFicha && autorAtual && !assinado && !fichaAssinada && todosAFazer && (
                          <button
                            type="button"
                            onClick={() => {
                              setEncaminhamentoEventoIds(eventoIds);
                              setDestinoEncaminhamentoId(evento.encaminhadoParaId ?? '');
                            }}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary hover:border-teal/40 hover:text-teal-ink"
                          >
                            <Forward className="h-3.5 w-3.5" /> {evento.encaminhadoParaId ? 'Alterar encaminhamento' : 'Encaminhar'}
                          </button>
                        )}
                        {podeEditarDetalhes && (
                          <button
                            type="button"
                            onClick={() => abrirDetalhesDoEvento(evento)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-text-secondary hover:bg-surface hover:text-text-primary"
                          >
                            <PenLine className="h-3.5 w-3.5" /> {detalheAberto ? 'Fechar detalhes' : detalheTecnico ? 'Ver/editar detalhes' : 'Editar procedimento'}
                          </button>
                        )}
                        {ficha && podeEscreverFicha && autorAtual && (assinado || fichaAssinada) && (
                          <button
                            type="button"
                            onClick={() => complementarAtendimento(atendimentoAberto, evento.ancora.dente ?? null)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-text-secondary hover:bg-surface hover:text-text-primary"
                          >
                            <PenLine className="h-3.5 w-3.5" /> Adicionar retificação
                          </button>
                        )}
                        {assinado && <span className="text-xs font-semibold text-text-secondary">Assinado · registro bloqueado</span>}
                        {carregando && <Loader2 className="h-4 w-4 animate-spin text-teal" aria-label="Salvando" />}
                      </div>
                      {detalheAberto && (
                        <ProcedimentoDetalheFicha
                          key={evento.id}
                          evento={evento}
                          permitirObservacao={autorAtual}
                          permitirDetalhe={detalheTecnico}
                          permitirExclusao={podeEscreverFicha && autorAtual && !assinado && !fichaAssinada}
                          onFechar={() => setEventoDetalheAbertoId(null)}
                          onSalvo={() => {
                            setEventoDetalheAbertoId(null);
                            router.refresh();
                          }}
                          onExcluido={() => {
                            setEventoDetalheAbertoId(null);
                            router.refresh();
                          }}
                        />
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </div>

          <aside className="space-y-3">
            <article className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Retorno</p>
              {atendimentoAberto.retorno ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-text-primary">{dataDaAgenda(atendimentoAberto.retorno.dataHora)}</p>
                  <p className="mt-1 text-xs text-text-secondary">{atendimentoAberto.retorno.dentistaNome ?? 'Dentista não identificado'} · {rotuloStatusAgenda(atendimentoAberto.retorno.status)}</p>
                  <Button className="mt-3 w-full" variant="outline" onClick={() => router.push(`/dashboard/agendamentos?v=dia&d=${atendimentoAberto.retorno!.dataHora.slice(0, 10)}`)}>
                    Abrir na Agenda
                  </Button>
                </>
              ) : (
                <p className="mt-2 text-sm text-text-primary">
                  {atendimentoAberto.atendimentoId ? 'Nenhum retorno vinculado a esta visita.' : 'Próximo agendamento ainda não registrado.'}
                </p>
              )}
              {podeMarcarRetornoDaVisita && !atendimentoAberto.retorno && (
                <Button className="mt-3 min-h-11 w-full" variant="outline" onClick={() => {
                  setRetornoAtendimentoId(atendimentoAberto.atendimentoId);
                  setRetornoAberto(true);
                }}>
                  <CalendarPlus className="h-4 w-4" /> Marcar retorno
                </Button>
              )}
            </article>

            <article className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Rastreabilidade</p>
              <p className="mt-2 text-sm text-text-primary">Materiais não informados</p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    A leitura de etiquetas será registrada nesta consulta quando o módulo de materiais estiver disponível.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Materiais e documentos</p>
              <p className="mt-2 text-sm text-text-primary">
                {atendimentoAberto.documentos.length > 0
                  ? `${atendimentoAberto.documentos.length} documento${atendimentoAberto.documentos.length === 1 ? '' : 's'} vinculado${atendimentoAberto.documentos.length === 1 ? '' : 's'} a esta consulta.`
                  : 'Nenhum documento vinculado a esta consulta.'}
              </p>
              <div className="mt-3 grid gap-2">
                <Button variant="ghost" className="justify-start" onClick={onAbrirArquivos}>
                  <FileText className="h-4 w-4" />
                  Abrir materiais e documentos
                </Button>
              </div>
            </article>

            {fichaAtual && (
              <article className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Histórico da Ficha</p>
                  <span className="text-[11px] font-bold text-text-secondary">{historicoDaFicha.length} visita{historicoDaFicha.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {historicoDaFicha.map((visita) => {
                    const procedimentos = visita.eventos
                      .map((evento) => `${evento.procedimentoNome?.trim() || TIPO_LABEL[evento.tipo]} · ${rotuloLocalEvento(evento)}`)
                      .filter((item, indice, itens) => itens.indexOf(item) === indice);
                    const atual = visita.id === atendimentoAberto.id;
                    return (
                      <button
                        key={visita.id}
                        type="button"
                        aria-current={atual ? 'page' : undefined}
                        onClick={() => abrirFicha(fichaAtual.id, visita.id)}
                        className={atual
                          ? 'rounded-xl border border-teal/40 bg-teal/10 px-3 py-3 text-left'
                          : 'rounded-xl border border-border px-3 py-3 text-left transition-colors hover:border-teal/30 hover:bg-surface-alt'}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-text-primary">{formatarData(visita.dataAtendimento)}</span>
                          <span className="text-[10px] font-bold text-teal-ink">{atual ? 'Em exibição' : 'Ver detalhes'}</span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-text-secondary">
                          {visita.profissional.nome} · {visita.eventos.length} procedimento{visita.eventos.length === 1 ? '' : 's'}
                        </span>
                        {procedimentos.length > 0 && (
                          <span className="mt-2 flex flex-wrap gap-1">
                            {procedimentos.slice(0, 2).map((procedimento) => (
                              <span key={procedimento} className="rounded-md bg-surface-alt px-2 py-1 text-[10px] font-semibold text-text-primary">
                                {procedimento}
                              </span>
                            ))}
                            {procedimentos.length > 2 && (
                              <span className="rounded-md bg-surface-alt px-2 py-1 text-[10px] font-semibold text-text-secondary">
                                +{procedimentos.length - 2}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {onGerarOrcamento && (
                    <Button variant="outline" onClick={() => onGerarOrcamento(fichaAtual.id)}>
                      Gerar orçamento
                    </Button>
                  )}
                </div>
              </article>
            )}
          </aside>
        </div>

        <Dialog open={exclusaoFichaId != null} onOpenChange={(open) => {
          if (!open && !apagandoFicha) {
            setExclusaoFichaId(null);
            setResumoExclusao(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Apagar esta Ficha?</DialogTitle>
              <DialogDescription>
                Esta ação é permanente. A ficha só pode ser apagada porque não há assinatura, documento clínico, orçamento aceito ou pagamento vinculados.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border bg-surface-alt p-3 text-sm text-text-secondary">
              Serão removidos {resumoExclusao?.eventos ?? 0} procedimento{(resumoExclusao?.eventos ?? 0) === 1 ? '' : 's'}, {resumoExclusao?.evolucoes ?? 0} {(resumoExclusao?.evolucoes ?? 0) === 1 ? 'evolução' : 'evoluções'} e {resumoExclusao?.orcamentosEditaveis ?? 0} orçamento{(resumoExclusao?.orcamentosEditaveis ?? 0) === 1 ? ' editável' : 's editáveis'}.
            </div>
            <DialogFooter>
              <Button variant="ghost" disabled={apagandoFicha} onClick={() => {
                setExclusaoFichaId(null);
                setResumoExclusao(null);
              }}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={apagandoFicha} onClick={() => void confirmarExclusaoFicha()}>
                {apagandoFicha && <Loader2 className="h-4 w-4 animate-spin" />}
                Apagar permanentemente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={odontogramaCompletoAberto} onOpenChange={setOdontogramaCompletoAberto}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[1180px] overflow-hidden p-3 sm:w-[calc(100vw-2rem)] sm:max-w-[1180px] sm:p-6">
            <DialogHeader>
              <DialogTitle>Odontograma completo</DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden">
              <div className={ODONTOGRAMA_RESPONSIVO}>
                <Odontograma
                  selectedTeeth={[]}
                  eventos={atendimentoAberto.eventos}
                  onToothToggle={(dente) => {
                    const temProcedimento = atendimentoAberto.eventos.some((evento) => evento.ancora.dente === dente);
                    if (!temProcedimento) return;
                    setOdontogramaCompletoAberto(false);
                    abrirProcedimentoDoDente(atendimentoAberto, dente);
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
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Procedimentos deste atendimento</p>
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
                      && evento.fichaId != null
                      && evento.dentistaId === dentistaId
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
                          <span className="block font-semibold text-text-primary">{rotuloProcedimento(atendimentoAberto, grupo.eventoPrincipal.id)}</span>
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
                  <Button disabled={salvandoAssinatura} onClick={() => void salvarAssinaturas(atendimentoAberto)}>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
        <div>
          <p className="font-heading text-xl text-text-primary">Prontuário</p>
          <p className="mt-0.5 text-sm text-text-secondary">Fichas em curso, consultas e histórico clínico do paciente.</p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setImportacaoHistoricoAberta(true)} className="min-h-11">
              <FileText className="h-4 w-4" /> Importar histórico
            </Button>
            <Button onClick={() => abrirNovoRegistro()} className="min-h-11">
              <Plus className="h-4 w-4" /> Novo atendimento
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Fichas em curso</p>
            <div className="mt-2 divide-y divide-border">
              {resumosTratamento.slice(0, 3).map(({ ficha, realizados, total, progresso, procedimentos }) => (
                <button
                  key={ficha.id}
                  type="button"
                  onClick={() => abrirFicha(ficha.id)}
                  className="grid w-full grid-cols-1 gap-2 py-3 text-left transition-colors hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-text-primary">{ficha.nome}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-text-secondary">
                      {procedimentos.length > 0 ? procedimentos.slice(0, 3).join(' · ') : 'Sem procedimentos estruturados'}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-text-secondary sm:text-right">
                    {progresso}% · {realizados} de {total} procedimentos
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-1 w-full overflow-hidden rounded-full bg-border sm:col-span-2"
                  >
                    <span className="block h-full rounded-full bg-teal transition-[width] motion-reduce:transition-none" style={{ width: `${progresso}%` }} />
                  </span>
                </button>
              ))}
              {resumosTratamento.length === 0 && (
                <p className="py-3 text-xs text-text-secondary">Nenhuma Ficha em curso.</p>
              )}
            </div>
          </div>
        <div className="border-t border-border pt-4">
            <div className="flex flex-wrap gap-2">
              {([
                ['atendimentos', `${atendimentos.length} atendimento${atendimentos.length === 1 ? '' : 's'}`],
                ['tratamentos', `${tratamentosEmCurso.length} ficha${tratamentosEmCurso.length === 1 ? '' : 's'} em curso`],
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
                      ? `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors ${aberto ? 'border-coral/50 bg-coral/15 text-coral-ink' : 'border-transparent bg-coral/10 text-coral-ink hover:border-coral/30'}`
                      : `inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors ${aberto ? 'border-teal/40 bg-teal/10 text-teal-ink' : 'border-border bg-surface-alt text-text-primary hover:border-teal/30'}`}
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
                          <button key={`${atendimento.id}:${ficha.id}`} type="button" onClick={() => abrirFicha(ficha.id, atendimento.id)} className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-alt">
                            <span>{formatarData(atendimento.dataAtendimento)} · {ficha.nome}</span><span className="text-text-secondary">Abrir ficha →</span>
                          </button>
                        ))
                        : [(
                          <button key={atendimento.id} type="button" onClick={() => abrirLegado(atendimento.id)} className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-alt">
                            <span>{formatarData(atendimento.dataAtendimento)}</span><span className="text-text-secondary">Abrir legado →</span>
                          </button>
                        )]
                    ))}
                    {atendimentos.length === 0 && <p className="text-xs text-text-secondary">Nenhum atendimento registrado.</p>}
                  </div>
                )}
                {resumoAberto === 'tratamentos' && (
                  <div className="grid gap-1">
                    {tratamentosEmCurso.map((ficha) => (
                      <button key={ficha.id} type="button" onClick={() => abrirFicha(ficha.id)} className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-alt">
                        <span>{ficha.nome}</span><span className="text-text-secondary">Abrir ficha →</span>
                      </button>
                    ))}
                    {tratamentosEmCurso.length === 0 && <p className="text-xs text-text-secondary">Nenhuma Ficha em curso.</p>}
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
                          className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-left text-xs font-semibold text-text-primary hover:bg-surface-alt disabled:cursor-default disabled:opacity-60"
                        >
                          <span>{evento.procedimentoNome?.trim() || TIPO_LABEL[evento.tipo]}{evento.ancora.dente ? ` · ${evento.ancora.dente}` : ''}</span>
                          <span className="text-text-secondary">{atendimento ? 'Abrir pendência →' : 'Pendente'}</span>
                        </button>
                      );
                    })}
                    {eventosPendentes.length === 0 && <p className="text-xs text-text-secondary">Nenhuma pendência clínica.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {([
          ['tudo', 'Tudo'],
          ['indicado', 'Indicados'],
          ['realizado', 'Realizados'],
        ] as const).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltroClinico(valor)}
            className={filtroClinico === valor
              ? 'rounded-lg bg-teal/10 px-3 py-1.5 text-xs font-bold text-teal-ink'
              : 'rounded-lg px-3 py-1.5 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary'}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {dados.errosParciais.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/30 bg-coral/5 px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs text-text-primary">
            <AlertTriangle className="h-4 w-4 shrink-0 text-coral-ink" aria-hidden />
            Não foi possível carregar: {dados.errosParciais.join(', ')}. O restante do prontuário continua disponível.
          </p>
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>Atualizar</Button>
        </div>
      )}

      {atendimentos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <FileText className="mx-auto h-9 w-9 text-text-secondary/40" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-text-primary">Nenhum atendimento registrado ainda.</p>
          <p className="mt-1 text-xs text-text-secondary">O primeiro atendimento pode ser feito aqui, manualmente ou com o Dex.</p>
        </div>
      ) : atendimentosVisiveis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">Nenhum atendimento corresponde a este filtro.</p>
          <button type="button" onClick={() => setFiltroClinico('tudo')} className="mt-2 text-xs font-bold text-teal-ink hover:underline">
            Mostrar todos os atendimentos
          </button>
        </div>
      ) : (
        <ol className="space-y-3">
          {atendimentosVisiveis.map((atendimento) => {
            const texto = textoDaVisita(atendimento);
            const temAssinatura = atendimento.fichas.some((ficha) => ficha.assinadoEm != null);
            return (
              <li key={atendimento.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-primary">{formatarData(atendimento.dataAtendimento)}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{rotuloOrigem(atendimento)} · {atendimento.profissional.nome}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-surface-alt px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                      {atendimento.eventos.length} procedimento{atendimento.eventos.length === 1 ? '' : 's'}
                    </span>
                    {temAssinatura && <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal-ink">Assinado</span>}
                  </div>
                </div>

                {texto ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-primary">{texto}</p>
                ) : (
                  <p className="mt-3 text-sm italic text-text-secondary">Sem evolução textual registrada.</p>
                )}

                {atendimento.eventos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {atendimento.eventos.slice(0, 8).map((evento) => (
                      <span key={evento.id} className="rounded-lg border border-border bg-surface-alt px-2.5 py-1 text-xs text-text-secondary">
                        {evento.procedimentoNome ?? evento.tipo}{evento.ancora.dente ? ` · ${evento.ancora.dente}` : ''}
                      </span>
                    ))}
                    {atendimento.eventos.length > 8 && <span className="px-2 py-1 text-xs text-text-secondary">+{atendimento.eventos.length - 8}</span>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {atendimento.fichas.map((ficha) => (
                    <button
                      key={ficha.id}
                      type="button"
                      onClick={() => abrirFicha(ficha.id, atendimento.id)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Abrir ficha · {ficha.nome} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ))}
                  {atendimento.fichas.length === 0 && (
                    <button
                      type="button"
                      onClick={() => abrirLegado(atendimento.id)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      Abrir registro legado <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onGerarOrcamento && atendimento.fichas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onGerarOrcamento(atendimento.fichas[0]!.id)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                    >
                      Gerar orçamento
                    </button>
                  )}
                  {atendimento.retorno ? (
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/agendamentos?v=dia&d=${atendimento.retorno!.dataHora.slice(0, 10)}`)}
                      className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
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
                      className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
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
