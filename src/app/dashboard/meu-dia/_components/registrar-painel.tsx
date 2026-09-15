'use client';

// R-46b — "Registrar": odontograma + salvar. Estado local reseta a cada paciente por
// comparação de `agendamentoId` durante o render (bloco `agendamentoIdAoResetar`) — até
// R-78 F0 isso vinha de graça via `key={agendamentoId}` no pai, que remontava tudo; virando
// hook (F0) não há mais remount, então o reset precisou virar explícito.
//
// R-46d D1.1/D1.2 (04/08) — o campo mágico (`CampoMagicoMeuDia`) é a entrada principal.
//
// R-62 (05/08) — a disclosure "Registrar sem IA" SAIU de vez: o combobox de 17 tipos e a
// busca no catálogo viraram chips locais dentro do próprio campo mágico
// (`casar-procedimento-local.ts`, zero rede, zero IA — mantém o I1 de registrar funcionar
// com a IA fora do ar). O que sobra AQUI (chips de orto/rotina, painel "qual tipo clínico?"
// do catálogo, "+ Observação") não estava escondido nem era exclusivo do combobox — vira
// uma faixa sempre visível, sem toggle. `registrar()`/`tipoPendente`/`escolherDoCatalogo`
// são os MESMOS de sempre, só ganham `aplicarSugestaoLocal` como um 2º chamador.
//
// R-107a (13/08, debate ao vivo) — Status (a fazer/feito) e Observação globais SAÍRAM: eram
// redundantes com o pill de status e o textarea por-evento que já existem em
// `ToothDetailPanel`/`NestaSessaoBloco`. R-128 substituiu os atalhos fixos de rotina por
// escopo regional universal, compartilhado com a ficha. "+ texto da visita" virou
// "+ Observação" (mesmo mecanismo, só rótulo).
//
// 04/08 (pedido dele, ao vivo) — `OndeSeletor` (chips de arcada/quadrante) SAIU da barra
// sem-IA: clicar direto no dente do odontograma já resolve "onde" pros tipos por-dente, e os
// 4 tipos de boca (profilaxia/clareamento/flúor/exame periodontal) resolvem sozinhos por
// tipo — nenhum dos dois precisava do chip. `raspagem` (o único ambíguo, quadrante OU boca)
// perde a opção de ancorar por quadrante sem clicar dente a dente — aceito, mesma razão dele
// ("entre clique e digitar, digitar no campo mágico é mais fácil"). Ganhou em troca: chip de
// "Manutenção ortodôntica" — abre o OrtoForm (já existia, reusado tal qual), o 1º tipo real
// de "não usa o odontograma" que a barra passa a cobrir.
//
// C1 (contrato §5.4) — `eventosDraft`/`textoVisita` continuam sem dono local: o dono é
// `meu-dia-client`, que também lê "Nesta sessão" (colunas laterais). `denteAberto` idem —
// dono lá, lido aqui.
//
// C7 (04/08) — o painel do dente SAIU daqui. Virou 3º bloco de acordeão na coluna direita
// (`meu-dia-client.tsx`), igual A Fazer/Novos Procedimentos — sem resumo, sem `Sheet`, painel
// completo direto. O odontograma aqui nunca mais compartilha linha com painel nenhum, então
// `colapsarDireita` morreu de vez (não volta desta vez: a largura da direita agora é sempre
// 312px fixos, o painel mora lá dentro, não rouba espaço do centro). `tabelaContainer` (onde a
// tabela de especialidade abre, full-width, abaixo do odontograma) continua dono/renderizado
// AQUI — só a referência sobe pra `meu-dia-client.tsx` via `onTabelaContainerRef`, porque quem
// agora monta o `ToothDetailPanel` que precisa dela é lá.
//
// R-78 F0 (08/08) — vira HOOK (`useRegistrarPainel`, não mais componente): o casco de 3
// colunas fixas (`CockpitGrid`) morreu, e campo mágico / mapa-espelho / rodapé agora vivem em
// 3 posições DIFERENTES do novo fluxo vertical (`meu-dia-client.tsx`), não mais um card só.
// Mesma lógica/estado de sempre — só o retorno muda, de uma `<div>` pra
// `{campoMagico, slotCentral, rodape}`, que o pai posiciona. `onTabelaContainerRef` SAIU
// de vez (não só subiu): o portal inteiro morreu (achado dele 08/08 — full-width abaixo da
// linha ficava sem fundo, "flutuando"). `ToothDetailPanel` sem esse prop já renderiza a
// tabela de especialidade inline, dentro do próprio card do perfil (555px).

import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, AlertTriangle, CalendarPlus, FileText, Loader2, ScanLine, X } from 'lucide-react';
import { Odontograma } from '@/components/odontograma/Odontograma';
import { salvarEventosOdontograma } from '@/server/patients/registro-actions';
import { CampoMagicoMeuDia } from './campo-magico-meu-dia';
import type { CapturaDexState } from '@/components/fichas/captura-livre-card';
import { OrtoForm } from '@/components/fichas/orto-form';
import { DexLoader } from '@/components/ui/dex-loader';
import { hojeBRT } from '@/lib/hora-brt';
import { sugerirEvolucaoResponseSchema } from '@/lib/dex/schemas';
import { montarPedidoSugestaoEvolucao } from '@/lib/dex/sugerir-evolucao';
import { salvarVisitaMeuDia } from '../actions';
import type { SalvarFichaResult } from '@/server/patients/salvar-ficha';
import type { RegistrarAtendimentoClinicoResult } from '@/server/patients/registrar-atendimento-clinico';
import { MarcarRetornoModal } from '@/components/pacientes/marcar-retorno-modal';
import { useMarcarRetorno } from '@/hooks/use-marcar-retorno';
import {
  TIPO_LABEL,
  type OdontogramaEventoDraft,
  type AncoraClinica,
  type ModoLancamento,
  type TipoRegistroOdontograma,
} from '@/types/odontograma';
import { criarEventosContextuais } from '@/lib/odontograma/criar-eventos-contextuais';
import { normalizarOrtoManutencao, type OrtoManutencaoDetalhe } from '@/lib/especialidades/orto';
import { type SugestaoLocal } from '@/lib/odontograma/casar-procedimento-local';
import { ditadoDevolveMapa, type SlotCentral } from '@/lib/odontograma/ditado-devolve-mapa';
import type { EscopoRegional } from '@/lib/odontograma/escopo-regional';
import type { MeuDiaPendencia, MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';

// R-109 — a faixa de lote inteira (lógica, estado interno e markup) saiu daqui pro componente
// compartilhado; a ficha monta a MESMA em vez de uma cópia (spec §2). Aqui ficou só o `onde`,
// que é a SELEÇÃO — essa continua sendo desta tela, porque cada tela seleciona do seu jeito.
import { FaixaLote } from '@/components/odontograma/faixa-lote';
import { FaixaEscopoRegional } from '@/components/odontograma/faixa-escopo-regional';

const TIPOS = Object.entries(TIPO_LABEL) as Array<[TipoRegistroOdontograma, string]>;

/** 03/08 — os únicos 4 tipos cuja âncora é 100% determinada pelo tipo (odontograma.ts:85-90,
 *  "Ancora em boca"). Pra estes, "onde" nunca existe. `raspagem` fica de fora de propósito —
 *  é o único tipo com nível ambíguo (quadrante OU boca) e, sem chip de região (04/08), só
 *  resolve clicando dente a dente no odontograma (âncora de dente, mais preciso que quadrante). */
const TIPOS_NIVEL_BOCA = new Set<TipoRegistroOdontograma>(['profilaxia', 'clareamento', 'fluor', 'exame_periodontal']);

/** Seleção de dente(s) — única entrada de "onde" restante depois que o chip de região saiu
 *  (04/08). Só dente(s), nunca mais região — mas o tipo continua aberto pra não reabrir esse
 *  desenho se um dia precisar. */
type OndeValor = { dentes: number[] } | null;

type SalvarRegistroClinicoResult = SalvarFichaResult | RegistrarAtendimentoClinicoResult;

export type SalvarRegistroClinico = (dados: {
  visitaKey: string;
  fichaId?: string;
  pacienteId: string;
  agendamentoId?: string;
  textoVisita: string;
  eventosDraft: OdontogramaEventoDraft[];
  alertaNovo: string | null;
  ortoManutencao: OrtoManutencaoDetalhe | null;
  destinoNovos: { fichaId: string | null };
}) => Promise<SalvarRegistroClinicoResult>;

interface RegistrarPainelProps {
  /** R-140a — a mesma chave cobre orçamento antecipado, salvar e retry da visita atual. */
  visitaKey: string;
  /** Identidade visual da bancada. No Meu Dia é o agendamento; no Prontuário, a própria visita. */
  contextoId: string;
  pacienteId: string;
  /** Só o Meu Dia possui agendamento; o Prontuário não inventa esse vínculo. */
  agendamentoId?: string;
  /** NOVO (D1) — só pro campo mágico (`CapturaLivreCard` precisa pro prompt da IA). */
  pacienteNome: string;
  /** R-64 — o "Marcar retorno" do rodapé abre a MESMA grade/modal do perfil do paciente;
   *  quem marca é sempre o dentista logado (mesmo trava de segurança de lá). */
  dentistaId: string;
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  /** C1 (§5.4) — dono é `meu-dia-client`; "Nesta sessão" (direita) lê o mesmo estado. */
  eventosDraft: OdontogramaEventoDraft[];
  onEventosDraftChange: (eventos: OdontogramaEventoDraft[]) => void;
  /** C7 (04/08) — dono continua em `meu-dia-client`, que agora é quem renderiza o
   *  `ToothDetailPanel` (3º bloco da direita). Lido aqui só pra saber se mostra o slot da
   *  tabela de especialidade (`onTabelaContainerRef` abaixo) e pra `onToothToggle` escrever. */
  denteAberto: number | null;
  onDenteAbertoChange: (dente: number | null) => void;
  textoVisita: string;
  onTextoVisitaChange: (texto: string) => void;
  /** C2 (§5.6, trava 2) — slot já tem ficha hoje: CTA nasce desabilitado com
   *  "já registrado hoje" até o dentista rascunhar algo novo. */
  temFichaHoje: boolean;
  /** R-85 — dono é `meu-dia-client` (mesmo padrão de `eventosDraft`). Quando "Gerar orçamento"
   *  já criou a ficha desta consulta (pra não deixar o orçamento com `ficha_id=null`),
   *  `handleSalvar` EDITA essa ficha em vez de criar uma 2ª. */
  fichaRascunhoId: string | null;
  /** R-108b — destino dos eventos que NASCEM nesta sessão, escolhido no seletor "o novo vai
   *  para" (dono é `meu-dia-client`, mesmo padrão de `eventosDraft`). `null` = tratamento novo.
   *  Pendência não passa por aqui: volta pra ficha onde foi planejada, sem pergunta (spec §2).
   *  Ignorado quando há `fichaRascunhoId` — o R-85 vence o roteamento. */
  destinoNovos: string | null;
  /** C2 (P7) — avisa o pai que a visita salvou (odontograma incluso, ver `eventosFalharam`
   *  abaixo). Nunca chamado enquanto o odontograma não gravou (I4). */
  onSalvo: (resultado: Extract<SalvarRegistroClinicoResult, { ok: true }>) => void;
  /** R-140c — permite que o mesmo painel grave um atendimento aberto pelo Prontuário. */
  onSalvarVisita?: SalvarRegistroClinico;
  /** R-46d D8 — "usar este documento de base" (anexar-documentos-bloco.tsx), repassado pro
   *  campo mágico. */
  anexarTexto?: { texto: string; nonce: number; origem: 'audio' | 'documento' };
  /** R-61 — estado persistido da boca (leitura), pinta o odontograma junto com
   *  `eventosDraft`. Passado direto pro `<Odontograma eventosPersistidos>`. */
  boca: OdontogramaEventoDraft[];
  /** R-63 — true quando o `ToothDetailPanel` (coluna direita) tem uma tabela de
   *  especialidade aberta pro dente atual. Dono é `meu-dia-client.tsx` (via
   *  `onDetalheAbertoChange` do painel); aqui só se lê, nunca se escreve. */
  detalheEspecialidadeAberto: boolean;
  /** R-46h F3 — picker geral: lista todas as fichas em aberto do paciente, dentista escolhe
   *  uma. Independente do estado de "Salvar" — nunca herda `disabled`/`semRascunho`, é ação
   *  separada (não precisa ter rascunho pra gerar orçamento de uma ficha antiga). */
  onAbrirPickerOrcamento: () => void;
  /** R-122 — detalhe é sempre um gesto explícito da faixa de ações rápidas. */
  onAbrirDetalheDental?: (dente: number) => void;
  /** Marca o primeiro uso do mapa sem transformar o atalho rápido em perfil do dente. */
  onOdontogramaInteragido?: () => void;
  /** R-130 — variante explícita que abre o fluxo de ponte no pilar selecionado. */
  onIniciarPonte: (dente: number) => void;
  /** R-49 F1 — o campo mágico extraiu detalhe de endo; abre o editor já expandido. */
  onAbrirDetalheEndo: (dente: number, eventoId: string) => void;
  /** R-105a §4.2 — repassado direto pro campo mágico. Derivado em `meu-dia-client.tsx`
   *  (dono da regra do realce); aqui é só passagem, nenhuma lógica. */
  realceCampoMagico?: boolean;
  /** R-105a §4.2.1 — idem: passagem pura pro campo mágico, que é quem sabe se já foi aberto. */
  dicaCampoMagico?: boolean;
}

/** Converte a pendência (já um evento real no banco, `status='indicado'`) num draft que
 *  PRESERVA o id — "fazer hoje" fecha o registro existente por upsert, nunca cria um novo
 *  ao lado dele (I3: nunca deixar a pendência original fantasma). Exportado — o gesto
 *  "fazer hoje" agora dispara do a-fazer-bloco.tsx (coluna direita), via meu-dia-client. */
export function pendenciaParaDraft(p: MeuDiaPendencia, dataPadrao: string): OdontogramaEventoDraft {
  const ancora: AncoraClinica = { nivel: p.nivel };
  if (p.dente != null) ancora.dente = p.dente;
  if (p.arcada != null) ancora.arcada = p.arcada;
  if (p.quadrante != null) ancora.quadrante = p.quadrante;
  if (p.faces.length > 0) ancora.faces = p.faces;
  return {
    id: p.id,
    tipo: p.tipo,
    procedimentoId: p.procedimentoId,
    procedimentoNome: p.procedimentoNome,
    status: 'realizado',
    origem: p.origem,
    // R-101 — vira 'realizado' aqui mesmo; a constraint do banco exige sessao_atual
    // sempre que status !== 'indicado' (mesmo reset da Fase 3 no toggle manual).
    momento_planejado: 'sessao_atual',
    ancora,
    grupo_id: p.grupoId,
    papel_no_grupo: p.papelNoGrupo,
    observacao: p.observacao ?? '',
    realizado_em: dataPadrao,
  };
}

function ancorasDoOnde(v: OndeValor): AncoraClinica[] {
  if (!v) return [];
  return v.dentes.map((dente): AncoraClinica => ({ nivel: 'dente', dente }));
}

export interface RegistrarPainelSlots {
  /** Entrada livre full-width no topo do fluxo. */
  campoMagico: ReactNode;
  /** Controles manuais que acompanham o odontograma (rotina, lote e observação). */
  controlesOdontograma: ReactNode;
  /** Ações independentes do save clínico, exibidas no cabeçalho da revisão. */
  acoesSecundarias: ReactNode;
  /** Ocupante default da coluna direita (~555px): mapa espelho ou OrtoForm — nunca os
   *  dois. Quando `denteAberto` está setado, o pai (`meu-dia-client`) mostra o
   *  `ToothDetailPanel` no lugar deste slot inteiro (mesma prioridade de sempre: orto
   *  vence — ver `slot` abaixo). */
  slotCentral: ReactNode;
  /** Rodapé com um único CTA primário + aviso de eventos pendentes. */
  rodape: ReactNode;
  /** Manutenção é estado estruturado da visita, mas precisa ser revisável antes do save. */
  ortoManutencao: OrtoManutencaoDetalhe | null;
  abrirManutencao: () => void;
}

export function useRegistrarPainel({
  visitaKey, contextoId, pacienteId, agendamentoId, pacienteNome, dentistaId, catalogoProcedimentos,
  eventosDraft, onEventosDraftChange: setEventosDraft,
  denteAberto, onDenteAbertoChange: setDenteAberto,
  textoVisita, onTextoVisitaChange: setTextoVisita,
  temFichaHoje,
  fichaRascunhoId,
  destinoNovos,
  onSalvo,
  onSalvarVisita,
  anexarTexto,
  boca,
  detalheEspecialidadeAberto,
  onAbrirPickerOrcamento,
  onAbrirDetalheDental,
  onOdontogramaInteragido,
  onIniciarPonte,
  onAbrirDetalheEndo,
  realceCampoMagico,
  dicaCampoMagico,
}: RegistrarPainelProps): RegistrarPainelSlots {
  const [capturaDex, setCapturaDex] = useState<CapturaDexState>({
    fase: 'idle', busy: false, impedeSalvar: false, audioParaRetry: false,
  });
  const [textoAberto, setTextoAberto] = useState(false);
  const [gerandoEvolucao, setGerandoEvolucao] = useState(false);
  const [evolucaoSugeridaDex, setEvolucaoSugeridaDex] = useState(false);
  /** Entrada visual do R-140d: a captura real de etiquetas ainda não existe nesta fatia. */
  const [materiaisAberto, setMateriaisAberto] = useState(false);
  const [quantidadeAoRenderizar, setQuantidadeAoRenderizar] = useState(eventosDraft.length);
  /** D1 — só escrita pro campo mágico; quem lê é `handleSalvar` abaixo (I3). */
  const [alertaNovo, setAlertaNovo] = useState<string | null>(null);

  const [onde, setOnde] = useState<OndeValor>(null);
  const [escopoRegional, setEscopoRegional] = useState<EscopoRegional | null>(null);
  const [modoLancamento, setModoLancamento] = useState<ModoLancamento>('a_fazer');
  // R-62 — carrega `dentes` junto (não só o item): quando a sugestão veio do texto do campo
  // mágico com número ("resina Z350 no 24"), o dente tem que sobreviver até o clique em
  // "qual tipo clínico?" — sem isso o passo seguinte caía de volta no `onde` (possivelmente
  // vazio ou de outro dente), mesmo bug de prioridade que `registrar()` tinha.
  const [catalogoPendente, setCatalogoPendente] = useState<{ item: MeuDiaCatalogoProcedimento; dentes: number[] } | null>(null);
  /** 03/08 — procedimento escolhido antes de haver "onde". Some assim que o onde chegar. */
  const [tipoPendente, setTipoPendente] = useState<{
    tipo: TipoRegistroOdontograma;
    observacao: string;
    procedimento?: { id: string | null; nome: string | null };
  } | null>(null);

  // R-107d/R-109 — a faixa de lote virou <FaixaLote>, e o estado interno dela (busca,
  // face pendente, catálogo, preço) mora lá dentro. Aqui sobrou só o `onde`, que é a
  // SELEÇÃO — essa continua sendo desta tela, porque cada tela seleciona do seu jeito.
  /** R-60 — preenchimento manual sempre começa limpo. Só a voz pode abrir o painel já preenchido. */
  const [ortoChipAberto, setOrtoChipAberto] = useState(false);
  const [ortoValor, setOrtoValor] = useState<OrtoManutencaoDetalhe | null>(null);

  // R-63 §4.1 — 1 ocupante por vez no slot central. Troca CONDICIONAL: só cede o mapa pra
  // conteúdo que precisa do espaço e não usa o mapa pra nada (orto, tabela de
  // especialidade). Os outros 15 de 17 tipos abrem o perfil na direita e o mapa FICA.
  const slot: SlotCentral = ortoChipAberto
    ? { tipo: 'orto' }
    : denteAberto != null && detalheEspecialidadeAberto
    ? { tipo: 'detalhe', dente: denteAberto }
    : { tipo: 'mapa' };
  const reduceMotion = useReducedMotion();

  const [isSaving, setIsSaving] = useState(false);
  const [savedFichaId, setSavedFichaId] = useState<string | null>(null);
  const [eventosPendentes, setEventosPendentes] = useState<OdontogramaEventoDraft[] | null>(null);
  const [isRegravando, setIsRegravando] = useState(false);

  // R-64 — "Marcar retorno" do rodapé. Fluxo próprio, independente do rascunho da visita
  // (agendamentos e fichas são tabelas diferentes) — fica habilitado mesmo com rascunho
  // pendente de propósito, não faz sentido travar uma coisa pela outra.
  const [retornoModalAberto, setRetornoModalAberto] = useState(false);
  const retorno = useMarcarRetorno({
    pacienteId,
    onConcluido: ({ comPedido }) => {
      setRetornoModalAberto(false);
      toast.success(comPedido ? 'Retorno marcado e pedido enviado.' : 'Retorno marcado.');
    },
  });

  // R-78 F0 — reset explícito ao trocar de paciente. Antes disto era de graça: o pai
  // desmontava/remontava o componente inteiro via `key={agendamentoId}` (comentário acima,
  // ainda descrevia esse mecanismo). Virando HOOK, não existe mais key que
  // force remount — sem este bloco, orto/catálogo pendente etc. de um paciente
  // vazariam pro próximo. Mesmo padrão de "comparar id durante o render" que
  // `meu-dia-client.tsx` (`idAoResetar`) já usa, pelo mesmo motivo (o lint do projeto,
  // `react-hooks/set-state-in-effect`, bloqueia a versão com `useEffect`).
  const [contextoIdAoResetar, setContextoIdAoResetar] = useState(contextoId);
  if (eventosDraft.length !== quantidadeAoRenderizar) {
    setQuantidadeAoRenderizar(eventosDraft.length);
  }
  if (contextoId !== contextoIdAoResetar) {
    setContextoIdAoResetar(contextoId);
    setTextoAberto(false);
    setGerandoEvolucao(false);
    setEvolucaoSugeridaDex(false);
    setMateriaisAberto(false);
    setQuantidadeAoRenderizar(eventosDraft.length);
    setAlertaNovo(null);
    setOnde(null);
    setEscopoRegional(null);
    setModoLancamento('a_fazer');
    setCatalogoPendente(null);
    setTipoPendente(null);
    setOrtoChipAberto(false);
    setOrtoValor(null);
    setIsSaving(false);
    setSavedFichaId(null);
    setEventosPendentes(null);
    setIsRegravando(false);
    setRetornoModalAberto(false);
    retorno.resetar();
  }

  const dataPadrao = hojeBRT();
  // C2 (§5.6) — as duas travas contra ficha duplicada colapsam numa condição só: nada pra
  // salvar. Trava 1 (limpar e desabilitar até rascunho novo) é local e imediata — não
  // espera o `router.refresh()` do pai, fecha a janela de corrida de um duplo clique rápido
  // pós-save. Trava 2 (slot já registrado hoje) é o MESMO estado vazio, só muda o rótulo.
  // 04/08 — visita só-de-orto (sem evento, sem texto) também é rascunho de verdade.
  const ortoParaSalvar = normalizarOrtoManutencao(ortoValor);
  const semRascunho = eventosDraft.length === 0 && textoVisita.trim() === '' && ortoParaSalvar == null;
  const podeSugerirEvolucao = textoVisita.trim() === ''
    && (eventosDraft.length > 0 || ortoParaSalvar != null);

  /** R-50 — orto veio da IA: vira estado editável E abre o chip. Abrir é o guarda-corpo (mesma
   *  razão do `criarDenteTipo` abrir a tabela de endo sozinha): dado extraído nunca entra
   *  invisível, o dentista vê e corrige antes de salvar. Sobrescreve o que o chip tivesse —
   *  o relato acabou de ser ditado, é mais recente que a herança do último atendimento. */
  function handleOrtoDetectado(orto: OrtoManutencaoDetalhe) {
    setOrtoValor(orto);
    setOrtoChipAberto(true);
  }

  const salvarRegistro: SalvarRegistroClinico = onSalvarVisita ?? (async (dados) => {
    if (!dados.agendamentoId) {
      return { ok: false, error: 'Este atendimento precisa de um agendamento válido.' };
    }
    return salvarVisitaMeuDia({
      visitaKey: dados.visitaKey,
      fichaId: dados.fichaId,
      pacienteId: dados.pacienteId,
      agendamentoId: dados.agendamentoId,
      textoVisita: dados.textoVisita,
      eventosDraft: dados.eventosDraft,
      alertaNovo: dados.alertaNovo,
      ortoManutencao: dados.ortoManutencao,
      destinoNovos: dados.destinoNovos,
    });
  });

  async function handleSugerirEvolucao() {
    if (!podeSugerirEvolucao || gerandoEvolucao || capturaDex.busy) return;
    setTextoAberto(true);
    setGerandoEvolucao(true);
    try {
      const response = await fetch('/api/dex/sugerir-evolucao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPedidoSugestaoEvolucao(eventosDraft, ortoParaSalvar)),
      });
      const payload: unknown = await response.json();
      const parsed = sugerirEvolucaoResponseSchema.safeParse(payload);
      if (!response.ok || !parsed.success) {
        const mensagem = payload && typeof payload === 'object' && 'error' in payload
          && typeof payload.error === 'string'
          ? payload.error
          : 'O Dex não conseguiu sugerir a evolução. Você pode continuar manualmente.';
        throw new Error(mensagem);
      }
      setTextoVisita(parsed.data.texto);
      setEvolucaoSugeridaDex(true);
      toast.success('Sugestão pronta. Revise antes de salvar.');
    } catch (error) {
      toast.error(error instanceof Error
        ? error.message
        : 'O Dex não conseguiu sugerir a evolução. Você pode continuar manualmente.');
    } finally {
      setGerandoEvolucao(false);
    }
  }

  /** R-125a — todos os caminhos manuais criam o mesmo draft contextual. */
  function criarEventos(
    tipo: TipoRegistroOdontograma,
    observacao: string,
    ancoras: AncoraClinica[],
    procedimento?: { id: string | null; nome: string | null },
    modo: ModoLancamento = modoLancamento,
  ): OdontogramaEventoDraft[] {
    return criarEventosContextuais({
      tipo,
      procedimentoId: procedimento?.id ?? null,
      procedimentoNome: procedimento?.nome ?? null,
      ancoras,
      dataPadrao,
      observacao,
      contexto: { capturaId: crypto.randomUUID(), modo },
    });
  }

  // R-62 — `dentesSugeridos` substitui o antigo `extrairDenteDoTexto(buscaTipo)`: o campo de
  // busca sumiu, o matcher local já entrega o dente extraído do MESMO texto que casou o tipo
  // (`SugestaoLocal.dentes`).
  //
  // PRIORIDADE: dentesSugeridos (o texto ATUAL do campo mágico) vence `onde` (clique no
  // odontograma), não o contrário — e SOBRESCREVE `onde`, não só o ignora. `onde` nunca é
  // limpo depois de um registro (comportamento antigo do multi-seleção, C6 §2 Q3: sobrevive
  // de propósito pro caso "clicar 2 dentes, DEPOIS escolher o tipo"). Sem a sobrescrita, um
  // 2º chip com dente diferente no texto (ex.: "canal 18" depois de "restauração 34") lia o
  // `onde` velho (ainda [34]) e o evento nascia no dente ERRADO — achado ao vivo, não por
  // leitura de código (dois cliques seguidos foram parar os dois no mesmo dente).
  function registrar(
    tipo: TipoRegistroOdontograma,
    observacao = '',
    dentesSugeridos: number[] = [],
    procedimento?: { id: string | null; nome: string | null },
    modo: ModoLancamento = modoLancamento,
  ) {
    // 03/08 — profilaxia/clareamento/flúor/exame periodontal não têm "onde": a âncora é
    // SEMPRE boca, e nenhum dente clicado antes se aplica aqui — não é esquecido, é ignorado
    // de propósito (D5 do R-06-07: nível boca nunca pinta dente).
    // R-107a — este branch (caminho digitado/ditado) continua acrescentando sem dedup; os
    // chips de Profilaxia/Clareamento da revisão atualizam o registro de rotina existente com
    // o modo manual ativo. Digitar o mesmo tipo 2x no campo mágico ainda cria 2 eventos —
    // comportamento pré-existente, fora de escopo desta fatia (spec R-107a §6).
    if (TIPOS_NIVEL_BOCA.has(tipo)) {
      setEventosDraft([...eventosDraft, ...criarEventos(tipo, observacao, [{ nivel: 'boca' }], procedimento, modo)]);
      setTipoPendente(null);
      setCatalogoPendente(null);
      return;
    }
    let ancoras: AncoraClinica[];
    if (dentesSugeridos.length > 0) {
      ancoras = dentesSugeridos.map((dente): AncoraClinica => ({ nivel: 'dente', dente }));
      setOnde({ dentes: dentesSugeridos });
    } else {
      ancoras = ancorasDoOnde(onde);
    }
    if (ancoras.length === 0) {
      // Ordem livre: guarda o procedimento em vez de descartar. `handleOndeChange` completa
      // o registro assim que um dente for clicado, em qualquer ordem. A observação digitada
      // (state, não este parâmetro) fica como está — `criarEventos` lê ela ao vivo quando o
      // registro finalmente acontecer, não precisa viajar dentro de `tipoPendente`.
      setTipoPendente({ tipo, observacao, procedimento });
      setCatalogoPendente(null);
      return;
    }
    // R-63 §4.3 — ditado devolve o mapa quando há confirmação real a dar (dente diferente
    // do que a tabela/orto aberta está mostrando). Fecha o ocupante e seleciona o dente
    // novo pra você ver onde caiu; mesmo dente ou âncora de boca não devolvem (§4.3).
    if (ditadoDevolveMapa(slot, ancoras)) {
      setOrtoChipAberto(false);
      const primeiroDente = ancoras.map((a) => a.dente).find((d): d is number => d != null);
      if (primeiroDente != null) setDenteAberto(primeiroDente);
    }
    setEventosDraft([...eventosDraft, ...criarEventos(tipo, observacao, ancoras, procedimento, modo)]);
    setTipoPendente(null);
    setCatalogoPendente(null);
  }

  function handleOndeChange(novoOnde: OndeValor) {
    setOnde(novoOnde);
    if (!tipoPendente) return;
    const ancoras = ancorasDoOnde(novoOnde);
    if (ancoras.length === 0) return;
    setEventosDraft([
      ...eventosDraft,
      ...criarEventos(
        tipoPendente.tipo,
        tipoPendente.observacao,
        ancoras,
        tipoPendente.procedimento,
      ),
    ]);
    setTipoPendente(null);
  }

  // C5 (contrato §5.5) — toque no odontograma escreve no MESMO "onde" que o resto do painel lê
  // (fonte única, nenhum estado novo).
  //
  // R-154 — o mapa preserva o atalho rápido padrão: cada toque soma/remove um dente da
  // seleção, para que a mesma faixa atenda um dente ou vários. Região continua sendo o
  // caminho padrão logo abaixo do mapa enquanto não há seleção dental.
  function onToothToggle(dente: number) {
    onOdontogramaInteragido?.();
    setEscopoRegional(null);
    if (tipoPendente) {
      handleOndeChange({ dentes: [dente] });
      return;
    }

    const dentesSelecionados = onde?.dentes ?? [];
    if (dentesSelecionados.includes(dente)) {
      const restantes = dentesSelecionados.filter((item) => item !== dente);
      handleOndeChange(restantes.length > 0 ? { dentes: restantes } : null);
      return;
    }

    handleOndeChange({ dentes: [...dentesSelecionados, dente] });
  }

  /** Item do catálogo escolhido — só o nome comercial, nunca o tipo estrutural (§A3: sem
   *  de-para confiável). Fica pendente até o dentista confirmar qual dos 16 tipos. `dentes`
   *  viaja junto (R-62) — é o que o clique em "qual tipo clínico?" usa depois. */
  function escolherDoCatalogo(item: MeuDiaCatalogoProcedimento, dentes: number[] = []) {
    setCatalogoPendente({ item, dentes });
  }

  /** R-62 — clique num chip do campo mágico. Mesmos 2 caminhos que a antiga "Registrar sem
   *  IA" tinha (tipo direto vs. item de catálogo pedindo o tipo), só que a entrada é a
   *  sugestão local em vez do valor escolhido no combobox. */
  function aplicarSugestaoLocal(s: SugestaoLocal) {
    if (s.catalogo) {
      escolherDoCatalogo(s.catalogo, s.dentes);
      return;
    }
    if (s.tipo) registrar(s.tipo, '', s.dentes, undefined, s.origem === 'preexistente' ? 'preexistente' : undefined);
  }

  /** "✕ limpar" — só esvazia a seleção, nunca desfaz o que já foi registrado. */
  function limparLote() {
    setOnde(null);
  }

  function selecionarEscopoRegional(escopo: EscopoRegional | null) {
    setOnde(null);
    setDenteAberto(null);
    setTipoPendente(null);
    setCatalogoPendente(null);
    setEscopoRegional(escopo);
  }

  // I1 — 1 clique = 1 ficha: `salvarFicha` não é idempotente por agendamentoId, o `disabled`
  // abaixo é a única proteção contra duplo clique/duplo submit (mesmo padrão de consulta-client).
  async function handleSalvar() {
    if (capturaDex.impedeSalvar) {
      toast.error(capturaDex.audioParaRetry
        ? 'Há um áudio aguardando transcrição. Tente novamente ou descarte o áudio antes de salvar.'
        : 'A captura do Dex ainda está em andamento. Aguarde antes de salvar.');
      return;
    }
    setIsSaving(true);
    // R-86 — achado pela auditoria de 08/08: sem o try/catch (mesmo padrão que
    // `handleRegravarEventos`, logo abaixo, já usa), uma falha de rede/servidor (503 visto ao
    // vivo) lançava uma exceção não tratada — `isSaving` nunca voltava a `false`, nenhum toast
    // aparecia, e o botão ficava travado (disabled) pros cliques seguintes. Parecia "não fez
    // nada" quando na verdade tinha crashado silenciosamente.
    let resultado: SalvarRegistroClinicoResult;
    try {
      resultado = await salvarRegistro({
        // R-85 — se "Gerar orçamento" já criou a ficha (fichaRascunhoId), EDITA em vez de criar
        // uma 2ª: mesmos eventos por id (upsert), sem duplicar o que o orçamento já gravou.
        // finalizarAtendimento omitido (default true) — É este clique que fecha o atendimento.
        visitaKey,
        fichaId: fichaRascunhoId ?? undefined,
        pacienteId, agendamentoId, textoVisita, eventosDraft, alertaNovo, ortoManutencao: ortoParaSalvar,
        // R-108b — só governa o que NASCEU nesta sessão. A pendência concluída volta pra ficha
        // onde foi planejada sozinha, decidida no servidor pelo `ficha_id` que ela já tem.
        destinoNovos: { fichaId: destinoNovos },
      });
    } catch {
      resultado = { ok: false, error: 'Falha de conexão. Tente novamente.' };
    }
    setIsSaving(false);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setSavedFichaId(resultado.fichaId);
    if (resultado.eventosFalharam) {
      // I4 — a ficha salvou mas o desenho não; não avança sozinho até o dentista decidir.
      setEventosPendentes(eventosDraft);
      return;
    }
    toast.success('Visita registrada.');
    onSalvo(resultado);
  }

  async function handleRegravarEventos() {
    if (!savedFichaId || !eventosPendentes) return;
    setIsRegravando(true);
    let res: { ok: boolean; error?: string };
    try {
      res = await salvarEventosOdontograma({ fichaId: savedFichaId, pacienteId, eventos: eventosPendentes });
    } catch {
      res = { ok: false, error: 'Falha de conexão. Tente novamente.' };
    }
    if (res.ok) {
      let resultado: SalvarRegistroClinicoResult;
      try {
        resultado = await salvarRegistro({
          visitaKey,
          fichaId: savedFichaId,
          pacienteId,
          agendamentoId,
          textoVisita,
          eventosDraft,
          alertaNovo,
          ortoManutencao: ortoParaSalvar,
          destinoNovos: { fichaId: destinoNovos },
        });
      } catch {
        resultado = { ok: false, error: 'Falha de conexão. Tente novamente.' };
      }
      if (!resultado.ok || resultado.eventosFalharam) {
        setIsRegravando(false);
        toast.error(resultado.ok ? 'Não foi possível concluir a visita. Tente novamente.' : resultado.error);
        return;
      }
      setEventosPendentes(null);
      setIsRegravando(false);
      toast.success('Odontograma gravado.');
      onSalvo(resultado);
    } else {
      setIsRegravando(false);
      toast.error(res.error ?? 'Não foi possível regravar o odontograma.');
    }
  }

  // R-122 — Campo Mágico é só a entrada livre. Controles manuais deixam de disputar o topo
  // da tela e acompanham o odontograma no slot contextual abaixo.
  const campoMagico = (
    <CampoMagicoMeuDia
      key={contextoId}
      pacienteNome={pacienteNome}
      eventosDraft={eventosDraft}
      onEventosDraftChange={setEventosDraft}
      textoVisita={textoVisita}
      onTextoVisitaChange={(texto) => {
        setTextoVisita(texto);
        setEvolucaoSugeridaDex(false);
      }}
      onAlertaNovoChange={setAlertaNovo}
      onOrtoDetectado={handleOrtoDetectado}
      onEndoDetectado={onAbrirDetalheEndo}
      anexarTexto={anexarTexto}
      catalogoProcedimentos={catalogoProcedimentos}
      onAplicarSugestao={aplicarSugestaoLocal}
      onCapturaStateChange={setCapturaDex}
      realce={realceCampoMagico}
      dica={dicaCampoMagico}
      compacto
    />
  );

  const controlesOdontograma = (
    <div className="flex min-h-[126px] flex-col justify-center">
      <div className="flex flex-col gap-2">
          {catalogoPendente && (
            <div className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-text-primary">
                  &ldquo;{catalogoPendente.item.nome}&rdquo; — qual tipo clínico?
                </p>
                <button
                  type="button"
                  onClick={() => setCatalogoPendente(null)}
                  aria-label="Cancelar"
                  className="text-text-secondary hover:text-coral"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS.map(([tipo, label]) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => registrar(
                      tipo,
                      '',
                      catalogoPendente.dentes,
                      { id: catalogoPendente.item.id, nome: catalogoPendente.item.nome },
                    )}
                    className="rounded-full border border-teal/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-teal-ink hover:bg-teal/10"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!onde && (
            <FaixaEscopoRegional
              escopo={escopoRegional}
              onEscopoChange={selecionarEscopoRegional}
              eventosDraft={eventosDraft}
              onEventosDraftChange={setEventosDraft}
              catalogoProcedimentos={catalogoProcedimentos}
              dataPadrao={dataPadrao}
              modoLancamento={modoLancamento}
              onModoLancamentoChange={setModoLancamento}
              manutencaoOrtodonticaAtiva={ortoChipAberto || ortoValor != null}
              onManutencaoOrtodontica={() => setOrtoChipAberto((aberto) => !aberto)}
              layout="grade"
            />
          )}

          {onde && (
            <FaixaLote
              dentes={onde.dentes}
              eventosDraft={eventosDraft}
              onEventosDraftChange={setEventosDraft}
              catalogoProcedimentos={catalogoProcedimentos}
              dataPadrao={dataPadrao}
              modoLancamento={modoLancamento}
              onModoLancamentoChange={setModoLancamento}
              onLimpar={limparLote}
              onModoMultidenteChange={() => {}}
              onAbrirDetalheDental={onAbrirDetalheDental}
              onIniciarPonte={onIniciarPonte}
            />
          )}

          {tipoPendente && (
            <p className="text-[11px] font-semibold text-teal-ink">
              {TIPO_LABEL[tipoPendente.tipo]} aguardando onde — clique no dente no odontograma.
            </p>
          )}

      </div>

      {textoAberto && (
        <div className="mt-2 rounded-lg border border-border bg-surface-alt p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Evolução clínica</p>
              {evolucaoSugeridaDex && (
                <p className="mt-0.5 text-[11px] font-semibold text-teal-ink">Rascunho do Dex — revise antes de salvar</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTextoAberto(false)}
              className="text-[11px] font-semibold text-text-secondary hover:text-teal-ink"
            >
              Recolher
            </button>
          </div>
          {gerandoEvolucao ? (
            <DexLoader size="sm" label="Dex preparando a evolução para revisão..." className="min-h-28" />
          ) : (
            <textarea
              value={textoVisita}
              onChange={(event) => {
                setTextoVisita(event.target.value);
                if (event.target.value.trim() === '') setEvolucaoSugeridaDex(false);
              }}
              placeholder="Curativo, sutura, orientação ou evolução da consulta"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-teal"
            />
          )}
        </div>
      )}
    </div>
  );

  // R-63 §4.1 — 1 ocupante por vez: mapa OU orto (troca CONDICIONAL, orto vence — mesma
  // prioridade de sempre). Endo/implante ('detalhe') NÃO entra mais aqui (R-78 F0): quando
  // há dente aberto, `meu-dia-client` mostra o `ToothDetailPanel` no lugar deste slot
  // inteiro, então `slot.tipo` só chega 'detalhe' quando este trecho nem está montado —
  // guarda mantida por clareza, não por necessidade.
  const slotCentral = (
    <AnimatePresence mode="wait" initial={false}>
      {slot.tipo !== 'detalhe' && (
        <motion.div
          key={slot.tipo}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
        >
          {slot.tipo === 'orto' ? (
            // bg-surface (não -alt): o OrtoForm já usa bg-surface-alt nos próprios
            // inputs (orto-form.tsx). Empilhar -alt aqui em cima de -alt zerava o
            // contraste do input contra o wrapper em light mode — as duas eram
            // literalmente a mesma cor (confirmado: rgb(218,218,222) nos dois, medido ao
            // vivo). FichasTab.tsx, o outro lugar que monta o OrtoForm, nunca teve esse
            // wrapper — por isso só aparecia aqui.
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-3 py-3">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div>
                  <p className="text-sm font-bold text-text-primary">Manutenção ortodôntica</p>
                  <p className="text-[11px] text-text-secondary">Preencha o necessário e volte para revisar antes de salvar.</p>
                </div>
                <button
                  type="button"
                  onClick={voltarParaBoca}
                  className="min-h-9 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
                >
                  Voltar à boca
                </button>
              </div>
              <OrtoForm valor={ortoValor} onChange={setOrtoValor} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Odontograma
                eventos={eventosDraft}
                eventosPersistidos={boca}
                selectedTeeth={onde?.dentes ?? []}
                onToothToggle={onToothToggle}
                compact
                zoom={0.85}
                hideFilters
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const acoesSecundarias = (
    <div className="flex flex-wrap justify-end gap-2">
      {podeSugerirEvolucao && (
        <button
          type="button"
          onClick={() => void handleSugerirEvolucao()}
          disabled={gerandoEvolucao || capturaDex.busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-3 text-xs font-bold text-teal-ink transition-colors hover:bg-teal/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gerar evolução com Dex
        </button>
      )}
      <button
        type="button"
        onClick={() => setRetornoModalAberto(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
      >
        <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
        Marcar retorno
      </button>
      <button
        type="button"
        onClick={onAbrirPickerOrcamento}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Gerar orçamento
      </button>
    </div>
  );

  const rodape = (
    <>
      {eventosPendentes && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-pale px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
          <div>
            <p className="text-sm text-text-primary">A visita foi salva, mas o desenho do odontograma não gravou.</p>
            <button
              type="button"
              onClick={() => void handleRegravarEventos()}
              disabled={isRegravando}
              className="mt-1 text-sm font-semibold text-warning-ink underline underline-offset-2 disabled:opacity-60"
            >
              {isRegravando ? 'Gravando...' : 'Tentar de novo'}
            </button>
          </div>
        </div>
      )}

      {/* R-78 F5 (§1.3/§3.2/G11) — o estado é informativo, nunca parece bloqueio: o
          indicador some quando ele salva de novo (semRascunho volta a false), o botão
          NUNCA vira texto estático ("Já registrado hoje") — sempre é uma ação disponível,
          só o rótulo muda pra deixar claro que é uma 2ª ficha. Mecanismo intacto: sempre
          create (§1.3), disabled continua o mesmo (nada pra salvar / salvando / pendência). */}
      {temFichaHoje && semRascunho && (
        <p className="mb-2 text-xs font-bold text-teal-ink">✓ 1 ficha hoje</p>
      )}
      {materiaisAberto && (
        <section className="mb-3 flex items-start gap-3 rounded-xl border border-border bg-surface-alt px-3 py-2.5" aria-label="Materiais e etiquetas">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal-ink">
            <ScanLine className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold text-text-primary">Materiais e etiquetas</p>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold text-text-secondary">0 etiquetas</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">
              A leitura será feita aqui na etapa de rastreabilidade. Salvar o atendimento continuará possível sem etiquetas.
            </p>
          </div>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMateriaisAberto((aberto) => !aberto)}
          aria-expanded={materiaisAberto}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface-alt px-3 text-xs font-bold text-text-secondary transition-colors hover:border-teal/40 hover:text-teal-ink"
        >
          <ScanLine className="h-4 w-4" aria-hidden />
          Materiais / etiquetas
          <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">0</span>
        </button>
        <button
          type="button"
          onClick={() => void handleSalvar()}
          disabled={isSaving || capturaDex.impedeSalvar || eventosPendentes != null || semRascunho}
          className="flex min-h-11 min-w-[190px] items-center justify-center gap-2 rounded-xl bg-teal-dark px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isSaving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
            // R-85 — com fichaRascunhoId, este clique EDITA a ficha que "Gerar orçamento" já
            // criou (fecha o atendimento agora, pela 1ª vez) — não é uma 2ª ficha de verdade,
            // mesmo com temFichaHoje=true (o servidor já vê a ficha que acabou de nascer).
            : <><Check className="h-4 w-4" /> Salvar atendimento</>
          }
        </button>
      </div>

      <MarcarRetornoModal
        open={retornoModalAberto}
        onOpenChange={(open) => {
          setRetornoModalAberto(open);
          if (!open) retorno.limparErro();
        }}
        pacienteNome={pacienteNome}
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
    </>
  );

  // R-123 — atalhos só reaproveitam as ações existentes: Ctrl+Enter é tratado pela captura;
  // Ctrl+S chama o mesmo salvar que o botão do rodapé. Nenhum atalho cria rota paralela.
  const salvarPorAtalho = useEffectEvent(() => {
    if (!isSaving && eventosPendentes == null && !semRascunho) void handleSalvar();
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      salvarPorAtalho();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function voltarParaBoca() {
    setOrtoChipAberto(false);
    setEscopoRegional(null);
  }

  function abrirManutencao() {
    setOnde(null);
    voltarParaBoca();
    setDenteAberto(null);
    setOrtoChipAberto(true);
  }

  return {
    campoMagico,
    controlesOdontograma,
    acoesSecundarias,
    slotCentral,
    rodape,
    ortoManutencao: ortoParaSalvar,
    abrirManutencao,
  };
}
