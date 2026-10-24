'use client';

// R-46a — dono do estado de seleção (qual atendimento do rail está com o contexto aberto
// embaixo). R-46g (D5): a chave é agendamentoId, não pacienteId — 2 atendimentos do mesmo
// paciente no mesmo dia (retorno) ficariam indistinguíveis por pacienteId. Precedência do
// default: agendamentoInicialId (veio de ?ag=, se casar com um slot) > em atendimento
// (in_progress/checked_in) > próximo elegível > 1º slot encerrado (só quando o dia acabou).
// R-76 (08/08) — `onSalvo` volta a avançar pro próximo slot elegível do rail: reverte a
// decisão de C2 (P7, 03/08, "o dentista já troca de paciente clicando no rail"). `podeAtender`
// mora aqui agora (só este arquivo usa — a versão antiga vivia em rail.tsx e foi apagada no
// R-72 junto do link "Iniciar consulta"). Limpa o rascunho local primeiro (trava §5.6.1),
// depois avança, depois `router.refresh()` pra puxar `slots`/`contextoPorPaciente` frescos do
// servidor (✓ registrado, pendências fechadas) sem sair da rota (G3/G9).
//
// C1 (contrato §5.4) — dono de `eventosDraft`/`denteAberto`/`textoVisita` sobe pra cá: a
// coluna direita ("Nesta sessão") precisa ler o mesmo rascunho que o centro escreve, e o
// `key={agendamentoId}` do RegistrarPainel não alcança mais esses 3 campos. O reset ao
// trocar de paciente vira explícito (comparação de id abaixo) — sem isso, rascunho de um
// paciente vaza pro próximo (perda/contaminação de dado clínico).
//
// C6 (04/08) — jaFeito sai de vez. Colunas redistribuídas (§2.6): esquerda ganha "Concluídos
// hoje" (migrado) + "Anexar documentos" (novo, R-46d D8); direita perde os dois.
//
// C7 (04/08) — o painel do dente vira o 1º item da coluna direita: `ToothDetailPanel`
// renderiza AQUI agora (não mais em `registrar-painel.tsx`). `colapsarDireita` morreu de vez
// no `CockpitGrid`: a direita é sempre 312px, o painel mora dentro dela, nunca mais disputa
// largura com o centro. `tabelaContainer` sobe de `registrar-painel.tsx` pra cá também — é
// aqui que o `ToothDetailPanel` que a usa agora vive.
//
// R-63 F2 (05/08, §4.4/§4.5) — painel do dente vira FIXO (não é mais acordeão — o antigo
// `painelDenteAberto` morreu, `denteAberto` continua a seleção de verdade). As duas colunas
// trocam os N acordeões (`BlocoMoldavel`) por 1 card de abas cada (`abaEsquerda`/`abaDireita`).
//
// R-78 F0+F1+F2 (08/08) — CASCO NOVO, supera os 2 parágrafos acima sobre `CockpitGrid`/abas
// E o `tabelaContainer` que citam: as 3 colunas fixas (320|1fr|312) e as 2 barras de abas
// morreram. Fluxo vertical agora — campo mágico full-width, depois UMA linha [lista "Nesta
// ficha" (eventosDraft inteiro, `RegistroCard` de verdade — pill clicável, observação
// editável, F1) │ espelho/perfil ~555px], depois faixa de gavetas (Histórico/A fazer/
// Anexos, 1 aberta por vez), depois rodapé. `RegistrarPainel` virou hook
// (`useRegistrarPainel`) — mesmo estado/lógica, só devolve as peças posicionáveis.
//
// Direita é 1 ocupante só, 3 níveis: espelho (default) → `DenteHistoricoCard` (tocar o
// dente — leitura antes de escrita, F2) → `ToothDetailPanel` (editor de faces/chips,
// "+ registrar neste dente"). `tabelaContainer`/portal SAÍRAM (achado dele 08/08: a tabela
// de especialidade full-width abaixo da linha ficava sem fundo, "flutuando" — ele queria
// DENTRO do card do perfil) — `ToothDetailPanel` sem esse prop já renderiza a seção inline,
// dentro do próprio card (555px é bem mais que os 312px que motivaram o portal originalmente).
// Faltam F3 (gavetas, provavelmente já cobertas) e F5 (rótulo do rodapé).
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Hourglass } from 'lucide-react';
import {
  alternarMomentoRegistro, atualizarStatusEncaminhado,
  encaminharProcedimento, getGruposAbertos,
} from '@/server/patients/registro-actions';
import { salvarVisitaMeuDia } from '@/app/dashboard/meu-dia/actions';
import type { SalvarFichaResult } from '@/server/patients/salvar-ficha';
import { EncaminharBar } from '@/components/fichas/encaminhar-bar';
import { Rail } from './rail';
import { documentoVazio, semNovasDuplicatas, temConteudo, sincronizarEventos, unirFacesDaCaptura, chaveRascunho, lerRascunho, serializarRascunho, textoParaSalvar, LIMITE_TEXTO_SALVAR, relatoParaDex, type RascunhoAtendimento } from '@/lib/meu-dia/documento-atendimento';
import { chaveDedupEvento } from '@/lib/odontograma/dedup-eventos-draft';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { AtenderAgoraModal } from '@/app/dashboard/agendamentos/_components/atender-agora-modal';
import { atualizarStatusAgendamento } from '@/app/dashboard/agendamentos/actions';
import type { AgendamentoStatus } from '@/types/database';
import { HistoricoBloco } from './historico-bloco';
import { AnexarDocumentosBloco } from './anexar-documentos-bloco';
import { OrtoCard } from '@/components/fichas/orto-card';

import { ondeLabel } from './meu-dia-format';
import { useRegistrarPainel, pendenciaParaDraft } from './registrar-painel';

/** R-108b — rótulo do procedimento novo no eyebrow do seletor ("Restauração 26", artefato
 *  bloco 8). Dente entra como número puro, do jeito que o artefato mostra; âncora de região
 *  cai no `ondeLabel` que o resto do Meu dia já usa; nível-boca fica só com o tipo. */
function rotuloNovo(e: OdontogramaEventoDraft): string {
  const label = e.procedimentoNome?.trim()
    || (e.tipo === 'outro' ? e.observacao.trim() : '')
    || TIPO_LABEL[e.tipo];
  if (e.ancora.dente != null) return `${label} ${e.ancora.dente}`;
  if (e.ancora.arcada != null || e.ancora.quadrante != null) {
    return `${label} · ${ondeLabel({
      dente: null,
      arcada: e.ancora.arcada ?? null,
      quadrante: e.ancora.quadrante ?? null,
    })}`;
  }
  return label;
}
import { DenteHistoricoCard } from './dente-historico-card';
import { VisitaLeituraCard } from './visita-leitura-card';
import { ToothDetailPanel } from '@/components/odontograma/ToothDetailPanel';
import {
  useOrcamentoModal,
  type ItemManualClinico,
  type PrepararItensClinicosResult,
} from '@/app/dashboard/pacientes/[id]/_components/use-orcamento-modal';
import { NovoOrcamentoModal } from '@/app/dashboard/pacientes/[id]/_components/modals/novo-orcamento-modal';
import { DicaZona } from './dica-zona';
import { DexOnboardingController } from './dex-onboarding-controller';
import { hojeBRT } from '@/lib/hora-brt';
import { criarEventosContextuais } from '@/lib/odontograma/criar-eventos-contextuais';
import { responsavelPassaFiltro, FILTRO_MEUS } from '@/lib/fichas/filtro-responsavel';
import type { MeuDiaData, MeuDiaPendencia, MeuDiaVisita } from '@/server/dashboard/get-meu-dia';
import { TIPO_LABEL, type OdontogramaEventoDraft } from '@/types/odontograma';
import type { EventoOdontogramaParaOrc } from '@/app/dashboard/pacientes/[id]/_components/types';
import type { GrupoAberto } from '@/lib/odontograma/grupos-abertos';
import type { ProgressoOnboarding } from '@/types/onboarding';
import { escolherPrimeiroAtendimento, registrarMarcoOnboarding } from '../onboarding-actions';

/** Contador — sempre pill neutro, mesmo em 0 (o artefato não distingue "tem novidade"). */
function Contador({ n }: { n: number }) {
  return <span className="rounded-full bg-surface-alt px-1.5 py-px font-mono text-[10px] text-text-secondary">{n}</span>;
}

/** R-83 (08/08, achado dele testando o R-78) — converte o rascunho (draft local, ainda sem
 *  `ficha_id`) pro shape que o motor de orçamento (`use-orcamento-modal.ts`) espera, mesmo
 *  padrão de `paraCard` em historico-bloco.tsx (cada chamador adapta seu tipo real). Sem
 *  isto, "Gerar orçamento" só enxergava fichas já salvas — salvar antes empurra pro próximo
 *  paciente (R-76), então não dava pra orçar o que acabou de ditar sem sair da tela dele. */
function draftParaEventoOrc(e: OdontogramaEventoDraft): EventoOdontogramaParaOrc {
  return {
    id: e.id,
    tipo: e.tipo,
    procedimento_id: e.procedimentoId ?? null,
    procedimento_nome: e.procedimentoNome ?? null,
    observacao: e.observacao,
    status: e.status,
    origem: e.origem,
    nivel: e.ancora.nivel,
    arcada: e.ancora.arcada ?? null,
    quadrante: e.ancora.quadrante ?? null,
    dente: e.ancora.dente ?? null,
    faces: e.ancora.faces ?? null,
    papel_no_grupo: e.papel_no_grupo,
    grupo_id: e.grupo_id,
    assinatura_id: e.assinaturaId ?? null,
    encaminhado_para: e.encaminhadoParaId ?? null,
    encaminhado_dentista: null,
  };
}

type UltimaAcaoPlano = {
  pendencia: MeuDiaPendencia;
  momentoAnterior: MeuDiaPendencia['momentoPlanejado'];
  descricao: string;
};

interface MeuDiaClientProps extends MeuDiaData {
  profissionalNome: string;
  agendamentoInicialId?: string;
  /** R-46h — o hook de orçamento compartilhado (pacientes/[id]/_components) precisa disto
   *  pra escopar a query; MeuDiaData não carrega (é parâmetro do fetch, não parte do retorno). */
  clinicaId: string;
  progressoOnboarding: ProgressoOnboarding | null;
  emFormacaoClinica: boolean;
}

export function MeuDiaClient({
  profissionalNome, slots, contextoPorPaciente, agendamentoInicialId, catalogoProcedimentos, meuDentistaId,
  destinosEncaminhar, clinicaId, primeiraSessao,
  progressoOnboarding, emFormacaoClinica,
}: MeuDiaClientProps) {
  const router = useRouter();

  const defaultAgendamentoId = useMemo(() => {
    if (agendamentoInicialId && slots.some((s) => s.agendamentoId === agendamentoInicialId)) {
      return agendamentoInicialId;
    }
    const emAtendimento = slots.find(
      (s) => s.statusAgendamento === 'in_progress' || s.statusAgendamento === 'checked_in',
    );
    const proximoElegivel = slots.find(
      (s) => !['cancelled', 'no_show', 'completed'].includes(s.statusAgendamento),
    );
    return (emAtendimento ?? proximoElegivel ?? slots[0])?.agendamentoId ?? null;
  }, [slots, agendamentoInicialId]);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(defaultAgendamentoId);
  const [trocaPendenteId, setTrocaPendenteId] = useState<string | null>(null);

  // R-57 F1 — encaixe criado no rail: fica na rota (não vai pro /consulta que o R-15
  // aposentou), refaz o refresh e seleciona o slot novo assim que ele aparecer em `slots`.
  // Ajuste durante o render (não `useEffect`, mesmo motivo do `idAoResetar` abaixo): o slot
  // só existe depois que o `router.refresh()` trouxer `slots` frescos do servidor — setar
  // `selecionadoId` direto apontaria pra um slot inexistente e cairia em tela vazia.
  const [encaixeAberto, setEncaixeAberto] = useState(false);
  const [aguardandoSlot, setAguardandoSlot] = useState<string | null>(null);
  if (aguardandoSlot && slots.some((s) => s.agendamentoId === aguardandoSlot)) {
    setSelecionadoId(aguardandoSlot);
    setAguardandoSlot(null);
  }

  const [estadoDraft, setEstadoDraft] = useState<ReturnType<typeof semNovasDuplicatas>>({ eventos: [], descartados: [] });
  const eventosDraft = estadoDraft.eventos;
  const [documento, setDocumento] = useState(documentoVazio);
  const acoesDocumento = useRef<{ organizar: () => void; corrigirPendentes: () => void } | null>(null);
  const recargaSegura = useRef(false);
  const confirmarSalvar = useRef<((confirmado: boolean) => void) | null>(null);
  const [escolhaSalvar, setEscolhaSalvar] = useState<{ textoNovo: boolean; semDente: number } | null>(null);

  const [rascunhoInicial, setRascunhoInicial] = useState<{ contextoId: string; orto: RascunhoAtendimento['orto']; alerta: string | null }>();
  const [rascunhoCarregado, setRascunhoCarregado] = useState<string | null>(null);
  const [selecaoRecuperada, setSelecaoRecuperada] = useState(false);
  const timerRascunho = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaveDescartada = useRef<string | null>(null);

  const [documentoBloqueado, setDocumentoBloqueado] = useState(false);
  const setEventosDraft = useCallback((atualizacao: SetStateAction<OdontogramaEventoDraft[]>) => {
    setEstadoDraft((atual) => semNovasDuplicatas(atual.eventos,
      unirFacesDaCaptura(atual.eventos, typeof atualizacao === 'function' ? atualizacao(atual.eventos) : atualizacao)));
  }, []);
  const [eventosNoDocumento, setEventosNoDocumento] = useState(eventosDraft);
  if (eventosNoDocumento !== eventosDraft) {
    setEventosNoDocumento(eventosDraft);
    setDocumento((atual) => sincronizarEventos(atual, eventosDraft));
  }
  function avisarDuplicataDoLote(dentes: number[], rotulo: string) {
    for (const dente of dentes) {
      toast.warning(`${dente} já tem ${rotulo} em aberto`);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) continue;
      for (const evento of eventosDraft.filter((atual) => atual.ancora.dente === dente)) {
        document.querySelector<HTMLElement>(`[data-documento-evento="${CSS.escape(evento.id)}"]`)
          ?.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 500, iterations: 4 });
      }
    }
  }
  useEffect(() => {
    for (const evento of estadoDraft.descartados) {
      const nome = evento.procedimentoNome || TIPO_LABEL[evento.tipo];
      toast.warning(`${evento.ancora.dente ?? 'Boca'} já tem ${nome} ${evento.ancora.faces?.join('') ?? ''} em aberto`, { id: `duplicata:${evento.id}` });
      const existente = estadoDraft.eventos.find((atual) => chaveDedupEvento(atual) === chaveDedupEvento(evento));
      if (existente && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelector<HTMLElement>(`[data-documento-evento="${CSS.escape(existente.id)}"]`)
          ?.animate([{ opacity: 0.5, backgroundColor: 'var(--color-teal-pale)' }, { opacity: 1, backgroundColor: 'transparent' }], { duration: 500, iterations: 4 });
      }
    }
  }, [estadoDraft]);
  /** R-140a — não é refeito no orçamento antecipado; só quando muda o atendimento do rail. */
  const [visitaKey, setVisitaKey] = useState(() => crypto.randomUUID());
  /** R-85 — quando "Gerar orçamento" precisa gravar a ficha cedo (ver `onAbrirPickerOrcamento`
   *  abaixo) pra não deixar o orçamento sem `ficha_id`. `null` até isso acontecer; o Salvar
   *  de verdade, depois, EDITA esta mesma ficha em vez de criar uma 2ª. */
  const [fichaRascunhoId, setFichaRascunhoId] = useState<string | null>(null);
  const [denteAberto, setDenteAberto] = useState<number | null>(null);
  const [iniciarPonteDente, setIniciarPonteDente] = useState<number | null>(null);
  /** R-78 F2 — dente aberto mostra o HISTÓRICO por padrão (§3.2 da spec: leitura antes de
   *  escrita); isto revela o editor de faces/chips (`ToothDetailPanel`, reusado tal qual)
   *  por cima, via "+ registrar neste dente" ou "continuar aqui" do aviso de grupo aberto. */
  const [registrandoDenteAberto, setRegistrandoDenteAberto] = useState(false);
  /** R-78 — id do evento cuja tabela de especialidade deve nascer já aberta no editor
   *  (⤢ de um card de "Nesta ficha"). `null` = editor nasce fechado, comportamento normal. */
  const [detalheAlvoId, setDetalheAlvoId] = useState<string | null>(null);
  /** R-63 — true quando o `ToothDetailPanel` tem uma tabela de especialidade (endo/implante)
   *  aberta pro dente atual. É o que o slot central (`RegistrarPainel`) lê pra decidir se
   *  troca o mapa — vem de `onDetalheAbertoChange`, nunca escrito direto por outro caminho. */
  const [detalheEspecialidadeAberto, setDetalheEspecialidadeAberto] = useState(false);
  /** R-78 F4 — "ler tudo ⤢" do texto de uma visita no Histórico. 4º ocupante do slot direito
   *  (§3.2: 1 ocupante só) — mutuamente exclusivo com `denteAberto` (ver handleDenteAbertoChange
   *  e abrirLeituraGrande). */
  const [leituraGrande, setLeituraGrande] = useState<MeuDiaVisita | null>(null);
  const [textoVisita, setTextoVisita] = useState('');
  const [gruposAbertos, setGruposAbertos] = useState<GrupoAberto[]>([]);
  /** Documento de referência: entra na escrita somente ao pedir "Usar como base". */
  const [documentoNome, setDocumentoNome] = useState<string | null>(null);
  const [documentoTexto, setDocumentoTexto] = useState<string | null>(null);
  const [documentoOrigem, setDocumentoOrigem] = useState<'audio' | 'documento'>('documento');
  const [anexarTexto, setAnexarTexto] = useState<{ texto: string; nonce: number; origem: 'audio' | 'documento' }>();

  // Reset explícito ao trocar de paciente (contrato §5.4) — o `key={agendamentoId}` do
  // RegistrarPainel não alcança mais estes campos, que agora moram aqui. Ajuste durante o
  // render (comparando o id anterior), não `useEffect`: é o padrão que o React recomenda pra
  // "resetar estado quando uma prop muda" — evita o passe de render extra do efeito, e o lint
  // do projeto (`react-hooks/set-state-in-effect`) bloqueia a versão com efeito.
  /** R-52 — modo seleção pra encaminhar em lote. Mesmo padrão do FichasTab (R-04 Fase 3). */
  const [modoEncaminhar, setModoEncaminhar] = useState(false);
  const [selecionadosEncaminhar, setSelecionadosEncaminhar] = useState<Set<string>>(new Set());
  const [destinoEncaminhar, setDestinoEncaminhar] = useState<string | null>(null);
  const [acaoPlanoEmAndamentoId, setAcaoPlanoEmAndamentoId] = useState<string | null>(null);
  const [ultimaAcaoPlano, setUltimaAcaoPlano] = useState<UltimaAcaoPlano | null>(null);

  // R-78 F0 — as duas barras de abas morreram: "Hoje"/"Novos" fundiram em "Nesta ficha"
  // (lista única, sempre visível); Histórico/A fazer/Anexos viraram gaveta — 1 aberta por
  // vez, mas agora FECHADA por padrão (nenhuma "aba default" — a lista+espelho é o que fica
  // sempre visível, gaveta é sob demanda, T5/orçamento vertical).
  const [anexosAbertos, setAnexosAbertos] = useState(false);

  /** R-108b — destino dos eventos que NASCEM nesta sessão (spec §4). `undefined` = o dentista
   *  ainda não tocou no seletor, então vale o pré-marcado (1º tratamento aberto — "caso comum
   *  segue zero clique", spec §2). `null` = "+ Novo tratamento". */
  const [destinoEscolhido, setDestinoEscolhido] = useState<string | null | undefined>(undefined);

  const [idAoResetar, setIdAoResetar] = useState(selecionadoId);
  if (selecionadoId !== idAoResetar) {
    setIdAoResetar(selecionadoId);
    setEventosDraft([]);
    setDocumento(documentoVazio());
    setDocumentoBloqueado(false);
    setRascunhoInicial(undefined);
    setRascunhoCarregado(null);
    setVisitaKey(crypto.randomUUID());
    setDestinoEscolhido(undefined); // R-108b — tratamento aberto é do paciente anterior
    setFichaRascunhoId(null); // R-85 — ficha do orçamento antecipado é do paciente anterior
    setDenteAberto(null);
    setDetalheEspecialidadeAberto(false); // R-63 — paciente novo não herda tabela aberta do anterior
    setRegistrandoDenteAberto(false); // R-78 F2 — idem, nunca herda o editor aberto
    setDetalheAlvoId(null);
    setLeituraGrande(null); // R-78 F4 — idem, nunca herda a leitura de visita do paciente anterior
    setAnexosAbertos(false); // G13 — troca de paciente reseta a gaveta pro default (fechada)
    setTextoVisita('');
    // Trocar de paciente com o modo de encaminhar ligado deixaria a barra selecionando
    // pendência do paciente ERRADO (contexto.pendencias troca, os ids selecionados não).
    setModoEncaminhar(false);
    setSelecionadosEncaminhar(new Set());
    setDestinoEncaminhar(null);
    setAcaoPlanoEmAndamentoId(null);
    setUltimaAcaoPlano(null);
    // D8 — documento anexado é do paciente anterior, não sobrevive à troca.
    setDocumentoNome(null);
    setDocumentoTexto(null);
    setAnexarTexto(undefined);
    setDocumentoOrigem('documento');
  }

  const slotSelecionado = selecionadoId ? (slots.find((s) => s.agendamentoId === selecionadoId) ?? null) : null;
  const contexto = slotSelecionado ? contextoPorPaciente[slotSelecionado.pacienteId] : null;
  // Uma visita com âncora clínica finalizada é imutável neste cockpit. A revisão fica no perfil;
  // uma nova consulta no mesmo dia nasce por novo encaixe, sem herdar esse estado.
  const atendimentoJaRegistrado = slotSelecionado?.atendimentoRegistrado === true;
  const chaveDaAba = slotSelecionado ? chaveRascunho({ clinicaId, dentistaId: meuDentistaId, pacienteId: slotSelecionado.pacienteId, agendamentoId: slotSelecionado.agendamentoId }) : null;
  useEffect(() => {
    try {
      for (const slot of slots) {
        if (!slot.atendimentoRegistrado) continue;
        sessionStorage.removeItem(chaveRascunho({ clinicaId, dentistaId: meuDentistaId,
          pacienteId: slot.pacienteId, agendamentoId: slot.agendamentoId }));
      }
    } catch { /* O Meu Dia segue disponível quando o storage está bloqueado. */ }
  }, [slots, clinicaId, meuDentistaId]);

  const observacoesPendentes = documento.blocos.flatMap((bloco) => bloco.tipo === 'pendente' && bloco.modelo.observacao.trim()
    ? [`${bloco.modelo.procedimentoNome}: ${bloco.modelo.observacao}`] : []);
  const textoDoDocumento = textoParaSalvar([textoVisita, ...observacoesPendentes].filter(Boolean).join('\n\n'), documento, true);

  function resolverEscolhaSalvar(confirmado: boolean) {
    const resolver = confirmarSalvar.current;
    confirmarSalvar.current = null;
    setEscolhaSalvar(null);
    resolver?.(confirmado);
  }

  async function antesDeSalvar() {
    if (textoDoDocumento.excede) return false;
    const textoNovo = relatoParaDex(documento) !== null;
    const semDente = documento.blocos.filter((bloco) => bloco.tipo === 'pendente').length;
    if (!textoNovo && semDente === 0) return true;
    confirmarSalvar.current?.(false);
    return new Promise<boolean>((resolver) => {
      confirmarSalvar.current = resolver;
      setEscolhaSalvar({ textoNovo, semDente });
    });
  }
  useEffect(() => () => {
    const resolver = confirmarSalvar.current;
    confirmarSalvar.current = null;
    resolver?.(false);
  }, []);


  function limparRascunhoDaAba() {
    if (timerRascunho.current) clearTimeout(timerRascunho.current);
    chaveDescartada.current = chaveDaAba;
    try { if (chaveDaAba) sessionStorage.removeItem(chaveDaAba); } catch { /* Memória continua disponível quando o storage não está. */ }
  }


  function limparEstadoDoAtendimento() {
    limparRascunhoDaAba();
    resolverEscolhaSalvar(false);
    setTrocaPendenteId(null);
    setEstadoDraft({ eventos: [], descartados: [] });
    setDocumento(documentoVazio());
    setDocumentoBloqueado(false);
    setTextoVisita('');
    setRascunhoInicial({ contextoId: selecionadoId ?? '', orto: null, alerta: null });
    setVisitaKey(crypto.randomUUID());
    setFichaRascunhoId(null);
    setDenteAberto(null);
    setDetalheEspecialidadeAberto(false);
    setRegistrandoDenteAberto(false);
    setDetalheAlvoId(null);
    setLeituraGrande(null);
    setDocumentoNome(null);
    setDocumentoTexto(null);
    setAnexarTexto(undefined);
    setDocumentoOrigem('documento');
  }


  // R-84 §3 — discriminador: id já existia no banco antes desta sessão (boca, R-61) vs.
  // indicação nova desta ficha. Derivado a cada render, nunca persistido — mesmo princípio de
  // `emAndamento`/`semPendencia` (evita 3º status por acidente, cilada documentada no R-51).
  const idsDeAntes = useMemo(
    () => new Set((contexto?.boca ?? []).map((b) => b.id)),
    [contexto?.boca],
  );

  // R-108b — o seletor "o novo vai para" (artefato bloco 8). Só existe quando há ambiguidade
  // real: nasceu procedimento novo E há tratamento aberto pra absorvê-lo. Observação dele:
  // "quando já tiver todos os em aberto fechado, não vai precisar do trigger".
  const tratamentosAbertos = contexto?.tratamentosAbertos ?? [];
  const eventosNovosDaSessao = eventosDraft.filter((e) => !idsDeAntes.has(e.id));
  // R-85 vence o roteamento (invariante §7): com a ficha do orçamento antecipado já criada, o
  // destino está decidido e perguntar seria mentira — o `fichaId` explícito ganha de qualquer
  // escolha feita aqui.
  const mostraSeletor =
    fichaRascunhoId == null && eventosNovosDaSessao.length > 0 && tratamentosAbertos.length > 0;
  const destinoNovos =
    destinoEscolhido !== undefined ? destinoEscolhido : (tratamentosAbertos[0]?.fichaId ?? null);

  // R-105a §4.2 — a regra do realce, derivada a cada render e nunca persistida (I2). No
  // máximo UM aceso por vez, e nenhum depois que a primeira ficha existe. O rail vazio cuida
  // do caso 'encaixe' sozinho (ele já recebe `primeiraSessao`); aqui só falta o campo mágico,
  // que acende enquanto o rascunho está vazio — assim que o 1º procedimento entra, o realce
  // apaga e quem passa a ensinar é o "Salvar e passar" perdendo o disabled.
  const onboardingClinicoAtivo = Boolean(
    primeiraSessao
    && progressoOnboarding
    && progressoOnboarding.etapa !== 'concluido'
    && progressoOnboarding.etapa !== 'pulado',
  );
  const realceCampoMagico =
    onboardingClinicoAtivo && slotSelecionado != null && eventosDraft.length === 0;

  const marcoCampoMagicoEnviado = useRef(false);
  useEffect(() => {
    if (!onboardingClinicoAtivo || eventosDraft.length === 0 || marcoCampoMagicoEnviado.current) return;
    marcoCampoMagicoEnviado.current = true;
    void registrarMarcoOnboarding('campo_magico');
  }, [eventosDraft.length, onboardingClinicoAtivo]);

  // R-105a §4.2.1 — as dicas de zona. Cada uma some quando A SUA zona é usada, não no fim de
  // tudo: é o que impede as 5 de virarem mobília. Todas derivadas aqui (I2), exceto a do campo
  // mágico (mora lá, é lá que vive o "aberto") e a do dente, que precisa de um "já tocou"
  // porque `denteAberto` volta a null quando o dentista fecha o perfil.
  const [jaTocouDente, setJaTocouDente] = useState(false);
  const semRascunhoAqui = eventosDraft.length === 0 && textoVisita.trim() === '';
  const dicas = {
    rail:       onboardingClinicoAtivo && slots.length === 0,
    campo:      onboardingClinicoAtivo,
    nestaFicha: onboardingClinicoAtivo && eventosDraft.length === 0,
    odontograma: onboardingClinicoAtivo && !jaTocouDente,
    rodape:     onboardingClinicoAtivo && semRascunhoAqui,
  };

  // R-46h — picker de orçamento (Histórico por-visita + rodapé do Registrar). Meu dia é
  // dentista-only (page.tsx redireciona secretaria): isSecretaria sempre false,
  // dentistasClinica sempre [], sem onOrcamentoCriado (não há lista de orçamentos aqui).
  // `pacienteId` segue o slot selecionado — os botões que abrem o modal só existem quando
  // há slotSelecionado, então o fallback '' nunca é de fato usado pra buscar nada.
  const prepararItensClinicosDoOrcamento = async (
    itens: ItemManualClinico[],
  ): Promise<PrepararItensClinicosResult> => {
    if (!slotSelecionado) return { ok: false, erro: 'Selecione um atendimento antes de gerar o orçamento.' };

    const eventosPorIndice = itens.map((item) => {
      const procedimentoNome = item.descricao.split(' — ')[0]?.trim() || item.descricao.trim();
      const eventos = criarEventosContextuais({
        tipo: 'outro',
        procedimentoId: item.procedimentoId,
        procedimentoNome,
        ancoras: Array.from({ length: item.quantidade }, () => ({ nivel: 'geral' as const })),
        contexto: { capturaId: crypto.randomUUID(), modo: 'a_fazer' },
        dataPadrao: hojeBRT(),
        observacao: procedimentoNome,
      });
      return { indice: item.indice, eventoIds: eventos.map((evento) => evento.id), eventos };
    });
    const eventosCompletos = [...eventosDraft, ...eventosPorIndice.flatMap((item) => item.eventos)];
    let resultado: SalvarFichaResult;
    try {
      resultado = await salvarVisitaMeuDia({
        visitaKey,
        fichaId: fichaRascunhoId ?? undefined,
        pacienteId: slotSelecionado.pacienteId,
        agendamentoId: slotSelecionado.agendamentoId,
        textoVisita,
        eventosDraft: eventosCompletos,
        finalizarAtendimento: false,
      });
    } catch {
      return { ok: false, erro: 'Falha de conexão ao registrar os procedimentos. Tente novamente.' };
    }
    if (!resultado.ok) return { ok: false, erro: resultado.error };
    if (resultado.eventosFalharam) {
      return { ok: false, erro: 'A ficha foi salva, mas os procedimentos não puderam ser registrados. Tente novamente.' };
    }

    setEventosDraft(eventosCompletos);
    setFichaRascunhoId(resultado.fichaId);
    return {
      ok: true,
      fichaId: resultado.fichaId,
      eventosPorIndice: eventosPorIndice.map(({ indice, eventoIds }) => ({ indice, eventoIds })),
    };
  };

  const orcamentoModal = useOrcamentoModal({
    pacienteId: slotSelecionado?.pacienteId ?? '',
    clinicaId,
    meuDentistaId,
    procedimentosClinica: catalogoProcedimentos,
    isSecretaria: false,
    dentistasClinica: [],
    prepararItensClinicos: prepararItensClinicosDoOrcamento,
  });

  // R-78 F0 — hook (era componente `<RegistrarPainel key={agendamentoId}>`): mesma
  // lógica/estado de sempre, devolve as 3 peças que o novo fluxo posiciona (campo mágico /
  // espelho / rodapé). Chamado incondicionalmente (regra dos hooks) — os fallbacks
  // ''/[]/null/false espelham o mesmo padrão que `useOrcamentoModal` acima já usa; a saída só
  // é RENDERIZADA dentro do `{slotSelecionado && contexto ? ... }` abaixo, nunca aparece vazia.
  const registrarPainel = useRegistrarPainel({
    variante: 'meu-dia',
    onVerSessao: contexto?.visitas[0] ? () => abrirLeituraGrande(contexto.visitas[0]) : undefined,
    onAnexar: () => { handleDenteAbertoChange(null); setLeituraGrande(null); setAnexosAbertos(true); },
    rascunhoInicial,
    impedeSalvar: textoDoDocumento.excede || documentoBloqueado || rascunhoCarregado !== chaveDaAba,
    antesDeSalvar,
    onSalvarVisita: async (dados) => {
      if (!dados.agendamentoId || textoDoDocumento.excede) return { ok: false, error: 'Confira o texto e o atendimento antes de salvar.' };
      return salvarVisitaMeuDia({ ...dados, agendamentoId: dados.agendamentoId, textoVisita: textoDoDocumento.texto });
    },
    documento: { acoes: acoesDocumento, onRecarregar: recarregarComRascunho, valor: documento, onChange: setDocumento, onBloqueioChange: setDocumentoBloqueado,
      textoVisita, onTextoVisitaChange: setTextoVisita, idsDeAntes, destinosEncaminhar, onAbrirDenteGrande: abrirDenteGrande },
    onDuplicataIgnorada: avisarDuplicataDoLote,
    visitaKey,
    contextoId: slotSelecionado?.agendamentoId ?? '',
    pacienteId: slotSelecionado?.pacienteId ?? '',
    agendamentoId: slotSelecionado?.agendamentoId ?? '',
    pacienteNome: slotSelecionado?.pacienteNome ?? '',
    dentistaId: meuDentistaId,
    catalogoProcedimentos,
    eventosDraft,
    onEventosDraftChange: setEventosDraft,
    denteAberto,
    onDenteAbertoChange: handleDenteAbertoChange,
    textoVisita,
    onTextoVisitaChange: setTextoVisita,
    temFichaHoje: slotSelecionado?.temFichaHoje ?? false,
    fichaRascunhoId,
    destinoNovos,
    onSalvo: handleSalvo,
    anexarTexto,
    boca: contexto?.boca ?? [],
    detalheEspecialidadeAberto,
    // R-84 §5.1 — só o que é indicação NOVA desta ficha vai pro orçamento; o que é pendência
    // antiga sendo fechada hoje já foi vendido na avaliação (§2.2). Filtro por evento, não por
    // card: elemento novo acrescentado hoje a um grupo antigo continua sendo venda legítima.
    // R-85 — achado pela auditoria de 08/08: orçar o que é novo ANTES de salvar criava um
    // orçamento com `ficha_id=null` (nunca virava registro clínico). Se há algo novo pra
    // orçar, grava agora (sem fechar o atendimento — `finalizarAtendimento: false`) — cria a
    // ficha na 1ª vez, EDITA nas vezes seguintes (fichaRascunhoId já setado). Sem isto, um 2º
    // procedimento registrado depois do 1º "Gerar orçamento" entrava no orçamento sem nunca
    // ter sido gravado (mesmo bug, só que a partir do 2º item em diante). O Salvar de verdade,
    // depois, edita essa mesma ficha de novo e SÓ ELE fecha o atendimento/avisa a secretária.
    realceCampoMagico,
    dicaCampoMagico: dicas.campo,
    onAbrirPickerOrcamento: () => {
      const eventosNovos = eventosDraft.filter((e) => !idsDeAntes.has(e.id));
      if (!slotSelecionado) {
        void orcamentoModal.abrirPickerFichasAbertas(null);
        return;
      }
      if (eventosNovos.length === 0) {
        // A ficha já foi criada pelo primeiro clique em "Gerar orçamento". Reabrir o
        // modal precisa buscar os eventos dela, não cair no picker vazio: o dentista espera
        // rever e ajustar os mesmos procedimentos da consulta corrente.
        if (fichaRascunhoId) {
          void orcamentoModal.abrirOrcamentoParaFicha(fichaRascunhoId);
        } else {
          orcamentoModal.abrirMontagemManualMeuDia();
        }
        return;
      }
      void (async () => {
        // R-86 — mesmo cuidado do handleSalvar (registrar-painel.tsx): sem o try/catch, uma
        // falha de rede aqui deixava o clique em "Gerar orçamento" travado sem abrir nada e
        // sem avisar nada, indistinguível de "não fiz nada".
        let resultado: SalvarFichaResult;
        try {
          resultado = await salvarVisitaMeuDia({
            visitaKey,
            fichaId: fichaRascunhoId ?? undefined,
            pacienteId: slotSelecionado.pacienteId,
            agendamentoId: slotSelecionado.agendamentoId,
            textoVisita,
            eventosDraft: eventosNovos,
            finalizarAtendimento: false,
          });
        } catch {
          resultado = { ok: false, error: 'Falha de conexão. Tente novamente.' };
        }
        if (!resultado.ok) {
          toast.error(`Não deu pra preparar o orçamento: ${resultado.error}`);
          return;
        }
        setFichaRascunhoId(resultado.fichaId);
        void orcamentoModal.abrirPickerFichasAbertas(resultado.fichaId, eventosNovos.map(draftParaEventoOrc));
      })();
    },
    onAbrirDetalheEndo: abrirDenteGrande,
    onAbrirDetalheDental: abrirDetalheDental,
    onIniciarPonte: iniciarPonte,
  });

  const limparAtendimentoConfirmado = useEffectEvent(() => {
    limparEstadoDoAtendimento();
    setRascunhoCarregado(chaveDaAba);
  });
  // A confirmação pode chegar pelo refresh mesmo depois do prazo do cliente.
  useEffect(() => {
    if (atendimentoJaRegistrado) limparAtendimentoConfirmado();
  }, [atendimentoJaRegistrado, chaveDaAba]);

  const recuperarRascunho = useEffectEvent(() => {
    if (!selecaoRecuperada) {
      try {
        const recuperaveis = slots.filter((slot) => !slot.atendimentoRegistrado && sessionStorage.getItem(chaveRascunho({
          clinicaId, dentistaId: meuDentistaId, pacienteId: slot.pacienteId, agendamentoId: slot.agendamentoId,
        })) !== null);
        if (!agendamentoInicialId && recuperaveis.length === 1) setSelecionadoId(recuperaveis[0].agendamentoId);
      } catch { /* Sem storage, a consulta segue somente na memória. */ }
      setSelecaoRecuperada(true);
      return;
    }
    if (!chaveDaAba || rascunhoCarregado === chaveDaAba) return;
    chaveDescartada.current = null;
    try {
      const json = sessionStorage.getItem(chaveDaAba);
      if (json && !atendimentoJaRegistrado) {
        const leitura = lerRascunho(json);
        if (leitura.ok) {
          const rascunho = leitura.rascunho;
          setEstadoDraft({ eventos: rascunho.eventosDraft, descartados: [] });
          setEventosNoDocumento(rascunho.eventosDraft);
          setDocumento(rascunho.documento);
          setTextoVisita(rascunho.textoVisita);
          setVisitaKey(rascunho.visitaKey);
          setRascunhoInicial({ contextoId: selecionadoId ?? '', orto: rascunho.orto, alerta: rascunho.alerta });
          toast.success('Rascunho desta aba recuperado');
        } else {
          toast.warning('Não foi possível recuperar o rascunho');
          sessionStorage.removeItem(chaveDaAba);
        }
      } else if (atendimentoJaRegistrado) sessionStorage.removeItem(chaveDaAba);
    } catch { /* Nenhuma exceção de storage interrompe a edição. */ }
    setRascunhoCarregado(chaveDaAba);
  });
  useEffect(() => { recuperarRascunho(); }, [chaveDaAba, rascunhoCarregado, selecaoRecuperada]);

  function gravarRascunho(): boolean {
    if (!chaveDaAba || rascunhoCarregado !== chaveDaAba || chaveDescartada.current === chaveDaAba || atendimentoJaRegistrado) return false;
    try {
      if (temEdicaoNaoSalva()) {
        const json = serializarRascunho({ documento, eventosDraft, textoVisita,
          orto: registrarPainel.rascunhoAtual.orto, alerta: registrarPainel.rascunhoAtual.alerta, visitaKey });
        sessionStorage.setItem(chaveDaAba, json);
        return sessionStorage.getItem(chaveDaAba) === json;
      }
      sessionStorage.removeItem(chaveDaAba);
      return true;
    } catch { return false; }
  }
  const gravarRascunhoAgora = useEffectEvent(() => { gravarRascunho(); });

  function recarregarComRascunho() {
    if (!slotSelecionado || !gravarRascunho()) {
      toast.error('Não foi possível guardar o rascunho na aba. Ele continua nesta tela; a página não foi recarregada.');
      return;
    }
    const destino = new URL(window.location.href);
    destino.searchParams.set('ag', slotSelecionado.agendamentoId);
    recargaSegura.current = true;
    setTimeout(() => { recargaSegura.current = false; }, 2000);
    window.location.assign(destino.toString());
  }
  useEffect(() => {
    timerRascunho.current = setTimeout(() => gravarRascunhoAgora(), 500);
    return () => { if (timerRascunho.current) clearTimeout(timerRascunho.current); };
  }, [chaveDaAba, rascunhoCarregado, documento, eventosDraft, textoVisita, visitaKey, registrarPainel.rascunhoAtual.orto, registrarPainel.rascunhoAtual.alerta, documentoTexto]);
  useEffect(() => {
    const guardar = () => gravarRascunhoAgora();
    window.addEventListener('pagehide', guardar);
    return () => window.removeEventListener('pagehide', guardar);
  }, []);

  // O modelo inclui o texto ainda não enviado ao Dex, sem consultar campos do DOM.
  function temEdicaoNaoSalva() {
    if (atendimentoJaRegistrado) return false;
    return eventosDraft.length > 0 || textoVisita.trim() !== ''
      || registrarPainel.rascunhoAtual.orto != null || registrarPainel.rascunhoAtual.alerta != null || documentoTexto != null
      || temConteudo(documento);
  }

  function selecionarAtendimento(id: string) {
    if (id === selecionadoId) return;
    if (temEdicaoNaoSalva()) setTrocaPendenteId(id);
    else setSelecionadoId(id);
  }

  function abrirEncaixe() {
    if (temEdicaoNaoSalva()) setTrocaPendenteId('encaixe');
    else setEncaixeAberto(true);
  }

  const avisarSaida = useEffectEvent((event: BeforeUnloadEvent) => {
    if (recargaSegura.current) return;
    if (!temEdicaoNaoSalva()) return;
    gravarRascunhoAgora();
    event.preventDefault();
    event.returnValue = '';
  });
  useEffect(() => {
    const avisar = (event: BeforeUnloadEvent) => avisarSaida(event);
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, []);


  // C6 — o Sheet precisa da mesma lista que o painel do dente sempre recebeu; migrado de
  // registrar-painel.tsx (era `useEffect` local ali, key `pacienteId`). Dep proposital só no
  // id, não no objeto inteiro — refetch só quando o PACIENTE muda, mesmo padrão de antes.
  useEffect(() => {
    if (!slotSelecionado) return;
    let cancelado = false;
    getGruposAbertos(slotSelecionado.pacienteId).then((g) => { if (!cancelado) setGruposAbertos(g); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotSelecionado?.pacienteId]);

  // R-76 — status que ainda podem ser atendidos (cancelado/faltou/concluído já saíram do dia).
  function podeAtender(status: string): boolean {
    return !['cancelled', 'no_show', 'completed'].includes(status);
  }

  // R-76 — a partir do slot atual, o próximo elegível NA ORDEM do rail. Sem próximo → null
  // (fim de dia, intencional — nunca cai de volta no slots[0] escondido).
  function avancarProximo() {
    const idxAtual = slots.findIndex((s) => s.agendamentoId === selecionadoId);
    const proximo = idxAtual === -1 ? undefined : slots.slice(idxAtual + 1).find((s) => podeAtender(s.statusAgendamento));
    setSelecionadoId(proximo?.agendamentoId ?? null);
  }

  // C2 (§5.6) — trava 1: limpa o rascunho AGORA, local e síncrono, não espera o refresh do
  // servidor. Fecha a janela de corrida de um duplo clique rápido logo após salvar (o
  // `router.refresh()` sozinho não seria rápido o bastante pra proteger o 2º clique).
  function handleSalvo() {
    limparEstadoDoAtendimento();
    if (onboardingClinicoAtivo) void registrarMarcoOnboarding('primeira_ficha');
    avancarProximo();
    router.refresh();
  }

  // R-57 F1 — o modal já fechou sozinho (onOpenChange(false) antes de chamar onCriado).
  function handleEncaixeCriado(agendamentoId: string) {
    setAguardandoSlot(agendamentoId);
    router.refresh();
  }

  // 07/08 — troca manual de status. `salvarVisitaMeuDia` já marca 'completed' sozinho
  // (origem='modo_consulta'), mas isso não cobre quem registrou por outro caminho (ficha
  // rápida do perfil) nem corrige um clique errado — reusa a MESMA escrita que a Agenda usa
  // (`atualizarStatusAgendamento`), só um 2º ponto de entrada.
  async function handleMudarStatus(agendamentoId: string, status: AgendamentoStatus) {
    const res = await atualizarStatusAgendamento(agendamentoId, status);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  function handleDenteAbertoChange(dente: number | null) {
    if (dente != null) setJaTocouDente(true); // R-105a §4.2.1 — dispensa a dica do odontograma
    setDenteAberto(dente);
    setIniciarPonteDente(null);
    // R-63 — nova seleção (ou fechar via ✕) nunca herda a tabela aberta do dente anterior;
    // o próprio ToothDetailPanel também reseta o índice local pro mesmo efeito (§4.2/I3).
    setDetalheEspecialidadeAberto(false);
    // R-78 F2 — trocar de dente (ou fechar) sempre volta pro histórico; nunca herda o
    // editor aberto do dente anterior.
    setRegistrandoDenteAberto(false);
    setDetalheAlvoId(null);
    // R-78 F4 — tocar um dente sai do modo "ler visita" (1 ocupante só, §3.2).
    setLeituraGrande(null);
  }

  /** R-78 F4 — "ler tudo ⤢" de uma visita no Histórico. Fecha o dente se algum estava
   *  aberto (mesma regra do ocupante único, §3.2) — a gaveta continua aberta, só o slot
   *  direito troca. */
  function abrirLeituraGrande(visita: MeuDiaVisita) {
    setAnexosAbertos(false);
    setDenteAberto(null);
    setRegistrandoDenteAberto(false);
    setDetalheAlvoId(null);
    setLeituraGrande(visita);
  }

  /** R-78 — ⤢ de um card de "Nesta ficha": vai direto pro editor do dente (pula o
   *  histórico, o dentista já sabe o que quer editar) com a tabela já expandida. */
  function abrirDenteGrande(dente: number, eventoId: string) {
    handleDenteAbertoChange(dente);
    setRegistrandoDenteAberto(true);
    setDetalheAlvoId(eventoId);
  }

  /** R-122 — seleção no mapa não abre nada. Este é o gesto explícito que leva às faces,
   * histórico e tabelas do dente escolhido. */
  function abrirDetalheDental(dente: number) {
    handleDenteAbertoChange(dente);
    setRegistrandoDenteAberto(true);
    setDetalheAlvoId(null);
  }

  function iniciarPonte(dente: number) {
    abrirDetalheDental(dente);
    setIniciarPonteDente(dente);
  }

  // R-123 — o painel de faces só existe por gesto explícito. Esc acompanha o ✕ e
  // devolve para o odontograma; campos internos que já usam Esc (ex.: busca livre)
  // chamam preventDefault e preservam seu próprio comportamento.
  useEffect(() => {
    if (denteAberto == null || !registrandoDenteAberto) return;

    function voltarAoOdontograma(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      handleDenteAbertoChange(null);
    }

    window.addEventListener('keydown', voltarAoOdontograma);
    return () => window.removeEventListener('keydown', voltarAoOdontograma);
  }, [denteAberto, handleDenteAbertoChange, registrandoDenteAberto]);

  /** Registro próprio entra na revisão da consulta como rascunho com o MESMO id. Assim o
   * dentista informa detalhe de implante/canal antes do save, sem criar evento fantasma. */
  function registrarHoje(pendencia: MeuDiaPendencia): void {
    if (eventosDraft.some((evento) => evento.id === pendencia.id)) {
      toast.message('Este procedimento já está na revisão do atendimento.');
      return;
    }
    setEventosDraft((anteriores) => [...anteriores, pendenciaParaDraft(pendencia, hojeBRT())]);
    setAnexosAbertos(false);
    toast.success('Adicionado à revisão. Complete os detalhes e salve o atendimento.');
  }

  /** Encaminhado é exceção deliberada: o destino não pode editar detalhe/autoria do evento
   * alheio, mas pode concluir pelo caminho estreito autorizado pela RPC. */
  async function concluirEncaminhada(pendencia: MeuDiaPendencia): Promise<void> {
    setAcaoPlanoEmAndamentoId(pendencia.id);
    const resultado = await atualizarStatusEncaminhado({ eventoIds: [pendencia.id], novoStatus: 'realizado' });
    setAcaoPlanoEmAndamentoId(null);
    if (!resultado.ok) {
      toast.error(resultado.error ?? 'Não foi possível concluir o procedimento encaminhado.');
      return;
    }
    toast.success('Procedimento encaminhado concluído.');
    router.refresh();
  }

  /** Próxima sessão é organização, portanto persiste imediatamente no evento já salvo. */
  async function alterarSituacaoDoPlano(
    pendencia: MeuDiaPendencia,
    situacao: 'sessao_atual' | 'proxima_sessao',
  ): Promise<void> {
    const propria = pendencia.dentistaId === meuDentistaId;
    if (!propria) {
      toast.error('Só o dentista autor pode organizar a próxima sessão.');
      return;
    }
    if (pendencia.momentoPlanejado === situacao) return;

    setAcaoPlanoEmAndamentoId(pendencia.id);
    const resultado = await alternarMomentoRegistro({ eventoIds: [pendencia.id], novoMomento: situacao });
    setAcaoPlanoEmAndamentoId(null);
    if (!resultado.ok) {
      toast.error(resultado.error ?? 'Não foi possível atualizar o procedimento.');
      return;
    }

    const nome = pendencia.procedimentoNome?.trim() || TIPO_LABEL[pendencia.tipo];
    setUltimaAcaoPlano({
      pendencia,
      momentoAnterior: pendencia.momentoPlanejado,
      descricao: situacao === 'proxima_sessao'
        ? `${nome} separado para a próxima sessão.`
        : `${nome} voltou para A fazer.`,
    });
    toast.success('Planejamento atualizado.');
    router.refresh();
  }

  async function desfazerUltimaAcaoDoPlano(): Promise<void> {
    if (ultimaAcaoPlano == null) return;
    const { pendencia, momentoAnterior } = ultimaAcaoPlano;
    setAcaoPlanoEmAndamentoId(pendencia.id);
    const resultado = await alternarMomentoRegistro({ eventoIds: [pendencia.id], novoMomento: momentoAnterior });

    if (!resultado.ok) {
      setAcaoPlanoEmAndamentoId(null);
      toast.error(resultado.error ?? 'Não foi possível desfazer a ação.');
      return;
    }
    setAcaoPlanoEmAndamentoId(null);
    setUltimaAcaoPlano(null);
    toast.success('Última ação desfeita.');
    router.refresh();
  }

  // R-52 — modo seleção pra encaminhar em lote (mesmo mecanismo do FichasTab, R-04 Fase 3):
  // liga o modo, marca ids, escolhe 1 destino, confirma em 1 chamada batch.
  function sairModoEncaminhar() {
    setModoEncaminhar(false);
    setSelecionadosEncaminhar(new Set());
    setDestinoEncaminhar(null);
  }
  function toggleModoEncaminhar() {
    if (modoEncaminhar) sairModoEncaminhar();
    else setModoEncaminhar(true);
  }
  function toggleSelecaoEncaminhar(id: string) {
    setSelecionadosEncaminhar((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function confirmarEncaminhamento() {
    if (destinoEncaminhar == null || selecionadosEncaminhar.size === 0) return;
    const ids = [...selecionadosEncaminhar];
    sairModoEncaminhar();
    const res = await encaminharProcedimento({ eventoIds: ids, dentistaDestinoId: destinoEncaminhar });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // R-52 — sucesso parcial: um lote pode ter id que mudou de estado entre a seleção e o
    // confirmar (outra aba). Avisa em vez de fingir que os ignorados também foram.
    if (res.ignorados.length > 0) {
      toast.warning(`${res.encaminhados.length} encaminhado(s). ${res.ignorados.length} não puderam ser (mudaram de estado).`);
    } else {
      toast.success(`${res.encaminhados.length} procedimento(s) encaminhado(s).`);
    }
    router.refresh();
  }

  // R-46d D8 — anexar documento (caixa embaixo do Histórico) e "usar este documento de base"
  // (empurra pro campo mágico via nonce, append nunca substituição).
  function handleAnexado(nome: string, texto: string, origem: 'audio' | 'documento') {
    setDocumentoNome(nome);
    setDocumentoTexto(texto);
    setDocumentoOrigem(origem);
  }
  function handleUsarComoBase() {
    if (documentoTexto == null) return;
    setAnexarTexto((anterior) => ({ texto: documentoTexto, origem: documentoOrigem, nonce: (anterior?.nonce ?? 0) + 1 }));
  }

  // R-52 — "A fazer" é o TRABALHO QUE EU VOU FAZER (decisão dele, 03/08, com o número de
  // impacto medido no banco antes de fechar). Dois casos entram, dois ficam de fora:
  //
  //   ✅ minha e não encaminhada   → é minha, eu faço
  //   ✅ encaminhada PRA mim       → é trabalho meu, mesmo que o autor seja outro
  //   ❌ minha, mas eu encaminhei  → saiu da minha mesa
  //   ❌ de colega, não encaminhada→ não é minha; o panorama do paciente vive na ficha
  //
  // X1 (MAPA-MEU-DIA.md) — "responsável = encaminhadoParaId ?? dentistaId" é a MESMA regra
  // que `filtro-responsavel.ts` já usa na ficha (R-16). Reimplementar à mão seria o débito
  // que a decisão do X1 condenou: duas leituras da mesma regra podem divergir em silêncio.
  //
  // R-63 F2 — subiu de dentro de `a-fazer-bloco.tsx` pra cá: o MESMO array agora alimenta a
  // lista renderizada no histórico, nunca duas leituras da regra.
  const minhasPendencias = (contexto?.pendencias ?? []).filter((p) =>
    responsavelPassaFiltro(p.encaminhadoParaId ?? p.dentistaId, FILTRO_MEUS, meuDentistaId),
  );

  // R-52 — mesmo critério de "encaminhavel" de a-fazer-bloco.tsx: autoria + não rascunhada
  // ainda. Recalculado aqui só pra alimentar `totalEncaminhavel` da EncaminharBar.
  const pendenciasEncaminhaveis = (contexto?.pendencias ?? []).filter(
    (p) => p.dentistaId === meuDentistaId && !eventosDraft.some((e) => e.id === p.id),
  );

  return (
    <div inert={documentoBloqueado || chaveDaAba !== rascunhoCarregado} className="flex min-w-0 flex-col">
      {/* §4.2.2 — antes do primeiro atendimento quem explica é o Dex, num card inteiro (há
          espaço e não há ninguém na cadeira). Depois disso, só as dicas de zona. */}
      {primeiraSessao && progressoOnboarding && (
        <DexOnboardingController
          progresso={progressoOnboarding}
          primeiraSessao={primeiraSessao}
          podeUsarDemo
          emFormacaoClinica={emFormacaoClinica}
          onAtenderReal={abrirEncaixe}
        />
      )}
      <Rail
        slots={slots}
        selecionadoId={selecionadoId}
        onSelecionar={selecionarAtendimento}
        onEncaixe={abrirEncaixe}
        onMudarStatus={handleMudarStatus}
        primeiraSessao={primeiraSessao}
      />
      <AlertDialog open={escolhaSalvar !== null} onOpenChange={(open) => { if (!open) resolverEscolhaSalvar(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{escolhaSalvar?.textoNovo ? 'Há texto que o Dex ainda não organizou' : `${escolhaSalvar?.semDente ?? 0} linha(s) sem dente`}</AlertDialogTitle>
            <AlertDialogDescription>
              {escolhaSalvar?.textoNovo && 'Você pode organizar agora ou salvar o texto nas observações, como está. '}
              {!!escolhaSalvar?.semDente && `${escolhaSalvar.semDente} linha(s) sem dente. Ao salvar assim mesmo, essas linhas ficam nas observações, sem criar procedimentos sem dente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap">
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            {escolhaSalvar?.textoNovo && <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-teal-ink" onClick={() => {
              resolverEscolhaSalvar(false);
              setTimeout(() => acoesDocumento.current?.organizar(), 0);
            }}>Organizar agora</button>}
            {!!escolhaSalvar?.semDente && <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold text-teal-ink" onClick={() => {
              resolverEscolhaSalvar(false);
              setTimeout(() => acoesDocumento.current?.corrigirPendentes(), 0);
            }}>Corrigir</button>}
            <AlertDialogAction onClick={() => resolverEscolhaSalvar(true)}>Salvar assim mesmo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={trocaPendenteId !== null} onOpenChange={(open) => { if (!open) setTrocaPendenteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar o que não foi salvo de {slotSelecionado?.pacienteNome}?</AlertDialogTitle>
            <AlertDialogDescription>O rascunho desta consulta será descartado ao trocar de atendimento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (trocaPendenteId === 'encaixe') {
                setEncaixeAberto(true);
              } else if (trocaPendenteId) { limparRascunhoDaAba(); setSelecionadoId(trocaPendenteId); }
              setTrocaPendenteId(null);
            }}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AtenderAgoraModal
        clinicaId={clinicaId}
        open={encaixeAberto}
        onOpenChange={setEncaixeAberto}
        onCriado={handleEncaixeCriado}
        onCaminhoEscolhido={(caminho) => { void escolherPrimeiroAtendimento(caminho); }}
      />
      <NovoOrcamentoModal {...orcamentoModal.modalProps} />
      {slotSelecionado && contexto ? (
        <>
          <article data-meu-dia-cartao inert={documentoBloqueado || chaveDaAba !== rascunhoCarregado} aria-busy={documentoBloqueado} className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface">
          <div data-meu-dia-paciente className="flex flex-col gap-3 max-[600px]:min-h-[114.4px] max-[600px]:justify-between border-b border-border px-6 py-[18px] min-[601px]:flex-row min-[601px]:items-center min-[601px]:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
              <h2 className="font-bold text-text-primary">{slotSelecionado.pacienteNome}</h2>
              {slotSelecionado.pacienteIdade != null && <span className="text-text-secondary">· {slotSelecionado.pacienteIdade} anos</span>}
              {(fichaRascunhoId || destinoNovos) && <span className="text-text-secondary">· Ficha de tratamento</span>}
              {contexto.alertas.map((alerta, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs text-warning-ink">
                  <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />{alerta}
                </span>
              ))}
              {minhasPendencias.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                  <Hourglass className="h-3 w-3 shrink-0" aria-hidden />
                  {minhasPendencias.length} pendente{minhasPendencias.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 text-[12.5px] text-text-secondary">
              <span>{profissionalNome}</span>
              <Link href={`/dashboard/pacientes/${slotSelecionado.pacienteId}`} className="font-semibold hover:text-text-primary">Ver perfil completo →</Link>
            </div>
          </div>
          <div data-meu-dia-retomada className="border-b border-border px-6 py-3.5 text-[13px]">
            <p className="text-text-primary"><strong>{tratamentosAbertos.find((t) => t.fichaId === destinoNovos)?.nome ?? 'Nova ficha'}</strong></p>
            <p className="mt-1 text-teal-ink">Sessão atual · {hojeBRT().split('-').reverse().join('/')} · {slotSelecionado.horario} · {profissionalNome}</p>
            <details className="mt-[7px] text-text-secondary">
              <summary className="cursor-pointer">Última sessão{contexto.visitas[0]
                ? ` · ${contexto.visitas[0].data.split('-').reverse().join('/')} · ${contexto.visitas[0].dentistaNome}`
                : ' · Sem sessão anterior'}</summary>
              <div data-meu-dia-historico role="region" aria-label="Plano e histórico das sessões" tabIndex={0} className="mt-3 max-h-[min(50dvh,480px)] overflow-y-auto overscroll-contain pr-2">
                  <HistoricoBloco
                    visitas={contexto.visitas}
                    pacienteId={slotSelecionado.pacienteId}
                    pacienteNome={slotSelecionado.pacienteNome}
                    onImportado={() => router.refresh()}
                    onGerarOrcamento={(fichaId) => void orcamentoModal.abrirOrcamentoParaFicha(fichaId)}
                    meuDentistaId={meuDentistaId}
                    pendencias={minhasPendencias}
                    onSituacaoChange={(pendencia, situacao) => void alterarSituacaoDoPlano(pendencia, situacao)}
                    onRegistrarHoje={registrarHoje}
                    onConcluirEncaminhada={(pendencia) => void concluirEncaminhada(pendencia)}
                    ultimaAcao={ultimaAcaoPlano}
                    onDesfazerUltimaAcao={() => void desfazerUltimaAcaoDoPlano()}
                    acaoEmAndamentoId={acaoPlanoEmAndamentoId}
                    modoEncaminhar={modoEncaminhar}
                    selecionadosEncaminhar={selecionadosEncaminhar}
                    onToggleModoEncaminhar={toggleModoEncaminhar}
                    onToggleSelecaoEncaminhar={toggleSelecaoEncaminhar}
                    onLerGrande={abrirLeituraGrande}
                  />
              </div>
            </details>
            {mostraSeletor && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="w-full text-xs text-text-secondary">
                  {eventosNovosDaSessao.length === 1
                    ? `O novo (${rotuloNovo(eventosNovosDaSessao[0])}) vai para`
                    : `Os ${eventosNovosDaSessao.length} novos vão para`}
                </p>
                {tratamentosAbertos.map((t) => (
                  <button
                    key={t.fichaId}
                    type="button"
                    aria-pressed={destinoNovos === t.fichaId}
                    onClick={() => setDestinoEscolhido(t.fichaId)}
                    className={`flex min-h-10 max-w-full items-center justify-between gap-3 rounded-lg border border-border px-[13px] py-2 text-left text-[13px] transition-colors ${
                      destinoNovos === t.fichaId
                        ? 'bg-teal-pale font-bold text-teal-ink'
                        : 'text-text-secondary hover:bg-surface-alt'
                    }`}
                  >
                    <span className="min-w-0 truncate">{t.nome}</span>
                    <span className="shrink-0 font-mono">{t.concluidos} de {t.totalProcedimentos}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={destinoNovos === null}
                  onClick={() => setDestinoEscolhido(null)}
                  className={`flex min-h-10 max-w-full items-center justify-between gap-3 rounded-lg border border-border px-[13px] py-2 text-left text-[13px] transition-colors ${
                    destinoNovos === null
                      ? 'bg-teal-pale font-bold text-teal-ink'
                      : 'text-text-secondary hover:bg-surface-alt'
                  }`}
                >
                  <span className="min-w-0 truncate">+ Novo tratamento</span>
                  <span className="shrink truncate font-mono">ficha à parte</span>
                </button>
              </div>
            )}

          </div>

          {atendimentoJaRegistrado ? (
            <section
              aria-label="Atendimento já registrado"
              className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-border bg-surface px-5 py-8 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-teal-ink">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-bold text-text-primary">Atendimento já registrado</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
                Para uma nova consulta hoje, use Encaixe. O perfil do paciente continua disponível
                quando você quiser revisar ou editar a ficha.
              </p>
            </section>
          ) : (
            <>
          {/* OD-001b — captura/revisão e contexto clínico na mesma superfície. */}
          <div data-meu-dia-workspace className="grid w-full min-w-0 grid-cols-1 items-stretch min-[1001px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <motion.div
              layout="size"
              transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
              data-meu-dia-atendimento className="flex min-w-0 flex-col px-7 py-[25px] max-[600px]:px-3.5 max-[600px]:py-[18px]"
            >
              {dicas.nestaFicha && (
                <DicaZona titulo="Revisão da consulta">
                  Tudo que o Dex entendeu cai aqui. Dá pra corrigir antes de salvar.
                </DicaZona>
              )}
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[17px] font-bold text-text-primary">Atendimento</p>
                  <Contador n={eventosDraft.length + (registrarPainel.ortoManutencao ? 1 : 0)} />
                </div>
              </div>
              <div data-meu-dia-captura className="mb-[18px] min-w-0">{registrarPainel.campoMagico}</div>
              {registrarPainel.ortoManutencao && <div className="mt-3 border-t border-border pt-3">
                <button type="button" onClick={registrarPainel.abrirManutencao} className="mb-2 text-xs font-semibold text-teal-ink">Editar manutenção ortodôntica</button>
                <OrtoCard valor={registrarPainel.ortoManutencao} />
              </div>}
            </motion.div>

            {/* Os controles existentes seguem na coluna de contexto, sem altura fixa. */}
            <motion.div
              layout="size"
              transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
              data-meu-dia-odontograma
              className="min-w-0 overflow-x-auto border-t border-border px-6 py-[25px] min-[1001px]:border-l min-[1001px]:border-t-0 max-[600px]:px-4 max-[600px]:py-[18px]"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold text-text-primary">Odontograma</h2>
                <span className="text-[12.5px] text-text-secondary">Dentição permanente</span>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                {anexosAbertos ? (
                  <motion.div key="anexos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[15px] font-bold text-text-primary">Documento de base</h3>
                      <button type="button" aria-label="Fechar documento de base" onClick={() => setAnexosAbertos(false)} className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-surface-alt">×</button>
                    </div>
                    <AnexarDocumentosBloco documentoNome={documentoNome} documentoTexto={documentoTexto} onAnexado={handleAnexado} onUsarComoBase={handleUsarComoBase} />
                  </motion.div>
                ) : denteAberto != null && registrandoDenteAberto ? (
                  <motion.div
                    key="editor-dente"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <ToothDetailPanel
                      dente={denteAberto}
                      eventos={eventosDraft}
                      onChange={setEventosDraft}
                      // R-123 — fechar o editor de faces volta ao mapa; o histórico
                      // continua acessível pelo gesto explícito "Ver histórico".
                      onClose={() => handleDenteAbertoChange(null)}
                      dataPadrao={hojeBRT()}
                      iniciarPonte={iniciarPonteDente === denteAberto}
                      onPonteIniciada={() => setIniciarPonteDente(null)}
                      gruposAbertos={gruposAbertos}
                      onDetalheAbertoChange={setDetalheEspecialidadeAberto}
                      abrirDetalheDoEvento={detalheAlvoId ?? undefined}
                      // R-107b — catálogo do dentista pro match local da busca livre.
                      catalogoProcedimentos={catalogoProcedimentos}
                      className="border-0 p-0"
                    />
                  </motion.div>
                ) : denteAberto != null ? (
                  <motion.div
                    key="historico-dente"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <DenteHistoricoCard
                      dente={denteAberto}
                      eventosDraft={eventosDraft}
                      visitas={contexto.visitas}
                      gruposAbertos={gruposAbertos}
                      onFechar={() => handleDenteAbertoChange(null)}
                      onRegistrar={() => setRegistrandoDenteAberto(true)}
                    />
                  </motion.div>
                ) : leituraGrande != null ? (
                  <motion.div
                    key="leitura-visita"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <VisitaLeituraCard visita={leituraGrande} onFechar={() => setLeituraGrande(null)} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="espelho"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {/* Só no espelho: quando há dente aberto a dica já foi dispensada
                        (`jaTocouDente`), então nunca aparece sobre o perfil do dente. */}
                    {dicas.odontograma && (
                      <DicaZona titulo="O odontograma">
                        A boca do paciente. Toque um dente pra ver o histórico dele.
                      </DicaZona>
                    )}
                    {registrarPainel.slotCentral}
                    {registrarPainel.controlesOdontograma}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* R-140b — rodapé da bancada: retorno e orçamento ficam na revisão; aqui permanece
              apenas o estado da ficha e o CTA primário de salvar o atendimento. */}
          <div data-meu-dia-rodape className="w-full border-t border-border px-6 py-[20.5px]">
            {dicas.rodape && (
              <DicaZona titulo="O que sai daqui">
                Da ficha salva saem o orçamento e o retorno, sem redigitar nada.
              </DicaZona>
            )}
            {textoDoDocumento.tamanho >= 4500 && <p role={textoDoDocumento.excede ? 'alert' : 'status'} className={`mb-3 text-sm ${textoDoDocumento.excede ? 'text-warning-ink' : 'text-text-secondary'}`}>
              {textoDoDocumento.tamanho.toLocaleString('pt-BR')} / {LIMITE_TEXTO_SALVAR.toLocaleString('pt-BR')} caracteres
              {textoDoDocumento.excede && <span className="mt-1 block">Organize com o Dex ou encurte a evolução. Nenhum texto será cortado.</span>}
            </p>}
            {registrarPainel.rodape}
          </div>

          {/* R-52 — barra do modo seleção, fixa no rodapé (mesmo componente do FichasTab,
              R-04 Fase 3, zero mudança nele). */}
          <AnimatePresence>
            {modoEncaminhar && (
              <EncaminharBar
                totalSelecionado={selecionadosEncaminhar.size}
                totalEncaminhavel={pendenciasEncaminhaveis.length}
                destinosDisponiveis={destinosEncaminhar}
                destino={destinoEncaminhar}
                onDestino={setDestinoEncaminhar}
                onSelecionarTudo={() => setSelecionadosEncaminhar(new Set(pendenciasEncaminhaveis.map((p) => p.id)))}
                onLimpar={() => setSelecionadosEncaminhar(new Set())}
                onConfirmar={() => void confirmarEncaminhamento()}
                onSair={sairModoEncaminhar}
              />
            )}
          </AnimatePresence>
            </>
          )}
          </article>
        </>
      ) : slots.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center">
          <p className="text-sm font-semibold text-text-primary">Todos os atendimentos de hoje foram registrados.</p>
          <p className="mt-1 text-xs text-text-secondary">Bom trabalho — o dia terminou por aqui.</p>
        </div>
      ) : null}
    </div>
  );
}
