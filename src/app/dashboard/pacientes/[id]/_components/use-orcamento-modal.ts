'use client';

// R-46h — extraído de paciente-detail-client.tsx (comportamento idêntico, motor movido, não
// reescrito) pra ser compartilhado com o Meu dia. Fica aqui (não em meu-dia/) porque é código
// de orçamento, não de Meu dia nem de paciente especificamente — mesmo raciocínio de
// corpo-especialidade.tsx (R-58).
//
// Meu dia é dentista-only (page.tsx redireciona secretaria) — os campos isSecretaria/
// dentistasClinica só fazem sentido pra tela do paciente. Meu dia sempre passa
// isSecretaria=false e dentistasClinica=[].
//
// onOrcamentoCriado é opcional: só a tela do paciente mantém uma lista local de orçamentos
// (orcamentosState) que precisa do item novo pra atualizar sem esperar um reload. Meu dia não
// tem essa lista — não passa nada, o callback nunca é chamado.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  criarOrcamento,
  adicionarItensAoOrcamento,
  criarProcedimentoRapido,
  gerarParcelas,
  definirPlanoAvista,
  type FormaPagamento,
} from '@/app/dashboard/orcamentos/actions';
import { composicaoParaSalvar } from '@/lib/orcamentos/grupos';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import {
  stripDenteDoNome, denteLabel,
  ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA,
  QUAD_SUP_DIREITO, QUAD_SUP_ESQUERDO, QUAD_INF_DIREITO, QUAD_INF_ESQUERDO,
} from '@/lib/arcadas';
import { TIPO_LABEL } from '@/types/odontograma';
import { eventosVisiveis, FILTRO_MEUS } from '@/lib/fichas/filtro-responsavel';
import type { NovoOrcamentoModalProps } from './modals/novo-orcamento-modal';
import type {
  FichaParaOrc, EventoOdontogramaParaOrc, ProcedimentoClinica, NovoOrcItem, OrcamentoComItens,
} from './types';

export interface UseOrcamentoModalInput {
  pacienteId: string;
  clinicaId: string;
  meuDentistaId: string;
  procedimentosClinica: ProcedimentoClinica[];
  /** Falha ao buscar o catálogo não pode parecer uma lista vazia: sem catálogo, não há preço
   * canônico confiável para montar uma proposta. */
  erroCatalogo?: string | null;
  isSecretaria: boolean;
  dentistasClinica: { id: string; nome: string }[];
  /** Só quem mantém uma lista local de orçamentos (tela do paciente) precisa disto — chamado
   *  com o orçamento otimista recém-criado. Meu dia não passa nada. */
  onOrcamentoCriado?: (orcamento: OrcamentoComItens) => void;
  /** O perfil abre o detalhe persistido assim que a proposta nasce, sem exigir aba/card. */
  onContinuarConfiguracao?: (orcamentoId: string) => void;
  /**
   * No Meu Dia, uma linha escolhida manualmente no catálogo ainda não tem evento clínico.
   * O chamador a transforma em procedimento planejado e persiste a ficha sem encerrar a visita
   * antes desta hook criar a proposta financeira.
   */
  prepararItensClinicos?: (itens: ItemManualClinico[]) => Promise<PrepararItensClinicosResult>;
}

export interface ItemManualClinico {
  indice: number;
  procedimentoId: string;
  descricao: string;
  quantidade: number;
}

export type PrepararItensClinicosResult =
  | { ok: true; fichaId: string; eventosPorIndice: Array<{ indice: number; eventoIds: string[] }> }
  | { ok: false; erro: string };

export interface UseOrcamentoModalResult {
  abrirNovoOrcamento: () => Promise<void>;
  abrirOrcamentoParaFicha: (fichaId: string) => Promise<void>;
  /** NOVO (R-46h) — só o Meu dia usa: abre direto no passo 'selecionar', pulando o "geral vs.
   *  por-ficha" que a tela do paciente precisa porque lá não há paciente já óbvio de antemão.
   *  R-83 (08/08) — `eventosRascunho`: itens indicados no rascunho ainda não salvo desta
   *  sessão. Quando presente, PULA a etapa 'selecionar' direto pra 'itens' — ele já sabe o que
   *  quer orçar, é o que acabou de ditar (achado dele: sem isto só dava pra orçar depois de
   *  salvar, e salvar avança pro próximo paciente — R-76). R-84 §5.2 — não junta mais com o
   *  agregado do banco (era o vazamento de pendência já vendida na avaliação).
   *  R-85 (08/08) — `fichaId`: quando vem de `eventosRascunho`, o chamador (meu-dia-client)
   *  já gravou a ficha antes de chegar aqui (senão o orçamento nascia com `ficha_id=null`,
   *  sem nenhum registro clínico por trás). `null` só no caminho antigo sem rascunho (agrega
   *  fichas já existentes — nenhuma delas se beneficia de um fichaId único aqui). */
  abrirPickerFichasAbertas: (fichaId: string | null, eventosRascunho?: EventoOdontogramaParaOrc[]) => Promise<void>;
  /** Entrada do Meu Dia sem procedimento no odontograma: o item escolhido vira evento planejado
   * no checkpoint de criação, mantendo a consulta aberta. */
  abrirMontagemManualMeuDia: () => void;
  isLoadingFichaParaOrc: boolean;
  modalProps: NovoOrcamentoModalProps;
}

const ITEM_VAZIO: NovoOrcItem = { procedimentoId: '', descricao: '', quantidade: 1, preco: '', eventoIds: [], origem: 'manual' };

type ModoPersistenciaOrcamento =
  | { tipo: 'novo' }
  | { tipo: 'adicionar'; orcamentoId: string };

type ResumoOrigemOrcamento = {
  disponiveis: number;
  deOutrosResponsaveis: number;
  responsaveis: string[];
};

const CAMPOS_FICHA_ORC =
  'id, created_at, data_atendimento, queixa_principal, dentes_afetados, dentes_observacoes, ' +
  'dentista_id, dentista:dentistas(nome)';
const CAMPOS_EVENTO_ORC =
  'id, tipo, procedimento_id, procedimento_nome, status, origem, nivel, arcada, quadrante, dente, faces, papel_no_grupo, grupo_id, assinatura_id, observacao, ' +
  'encaminhado_para, encaminhado_dentista:dentistas!odontograma_eventos_encaminhado_para_fkey(nome)';
const SELECT_FICHA_PARA_ORC = `${CAMPOS_FICHA_ORC}, odontograma_eventos(${CAMPOS_EVENTO_ORC})`;
// R-130 — !inner mantém o agregado enxuto, mas a elegibilidade financeira não depende mais
// de status/assinatura: qualquer evento clínico da ficha pode virar item de orçamento.
const SELECT_FICHA_PARA_ORC_AGREGADO = `${CAMPOS_FICHA_ORC}, odontograma_eventos!inner(${CAMPOS_EVENTO_ORC})`;

export function useOrcamentoModal({
  pacienteId, clinicaId, meuDentistaId, procedimentosClinica, erroCatalogo = null, isSecretaria, dentistasClinica,
  onOrcamentoCriado, onContinuarConfiguracao, prepararItensClinicos,
}: UseOrcamentoModalInput): UseOrcamentoModalResult {
  const router = useRouter();

  const [isNovoOrcOpen, setIsNovoOrcOpen] = useState(false);
  const [isLoadingFichaParaOrc, setIsLoadingFichaParaOrc] = useState(false);
  const [fichasParaOrc, setFichasParaOrc] = useState<FichaParaOrc[]>([]);
  const [fichaOrcId, setFichaOrcId] = useState<string | null>(null);
  const [novoOrcItens, setNovoOrcItens] = useState<NovoOrcItem[]>([ITEM_VAZIO]);
  const [registeringProcIdx, setRegisteringProcIdx] = useState<number | null>(null);
  const [orcSaving, setOrcSaving] = useState(false);
  const [orcError, setOrcError] = useState<string | null>(null);
  const [etapaNovoOrc, setEtapaNovoOrc] = useState<'selecionar' | 'itens'>('itens');
  const [novoOrcValorFinal, setNovoOrcValorFinal] = useState<number | null>(null);
  const [novoOrcDentistaAlvoId, setNovoOrcDentistaAlvoId] = useState('');
  const [modoPersistencia, setModoPersistencia] = useState<ModoPersistenciaOrcamento>({ tipo: 'novo' });
  const [eventoIdsJaOrcados, setEventoIdsJaOrcados] = useState<Set<string>>(() => new Set());
  const [resumoOrigemOrcamento, setResumoOrigemOrcamento] = useState<ResumoOrigemOrcamento | null>(null);
  const [bloqueioFicha, setBloqueioFicha] = useState<string | null>(null);
  const [contextoClinicoPendente, setContextoClinicoPendente] = useState(false);
  // Pré-seleciona o 1º dentista da lista assim que ela chega — só quando ainda vazio, nunca
  // sobrescreve uma escolha manual já feita (o pai só popula `dentistasClinica` quando
  // isSecretaria; dentista comum nunca aciona isto, `dentistasClinica` fica sempre []).
  useEffect(() => {
    if (!novoOrcDentistaAlvoId && dentistasClinica.length > 0) {
      setNovoOrcDentistaAlvoId(dentistasClinica[0].id);
    }
  }, [dentistasClinica, novoOrcDentistaAlvoId]);
  // R-34 — forma de pagamento já na criação (reduz a fricção de ter os dois passos).
  const [novoOrcPlanoForma, setNovoOrcPlanoForma] = useState<'avista' | 'parcelado' | null>(null);
  const [novoOrcNumParcelas, setNovoOrcNumParcelas] = useState('3');
  const [novoOrcPrimeiroVencimento, setNovoOrcPrimeiroVencimento] = useState('');
  const [novoOrcParcelasForma, setNovoOrcParcelasForma] = useState<FormaPagamento | ''>('');

  const novoOrcSubtotal = useMemo(
    () => novoOrcItens
      .filter((item) => item.selecionado !== false)
      .reduce((s, i) => s + i.quantidade * parseValorBR(i.preco), 0),
    [novoOrcItens]
  );
  const novoOrcTotal = useMemo(
    () => novoOrcValorFinal !== null ? Math.max(0, novoOrcValorFinal) : novoOrcSubtotal,
    [novoOrcSubtotal, novoOrcValorFinal]
  );

  // Cadastro rápido (handleCadastrarProcedimento, abaixo) precisa refletir no catálogo usado
  // por ESTE modal na mesma sessão — sem isso, o item recém-criado não aparece pro match de
  // itensDoTexto/matchProcedimentoPorTipo até um reload. `procedimentosClinica` é só leitura
  // (prop, o pai que é dono do catálogo de verdade); o que o cadastro rápido cria mora aqui,
  // mesclado por cima — nenhum acesso de escrita ao estado do pai é necessário.
  const [procedimentosCadastradosAgora, setProcedimentosCadastradosAgora] = useState<ProcedimentoClinica[]>([]);
  const procedimentosClinicaCompleto = useMemo(
    () => [...procedimentosClinica, ...procedimentosCadastradosAgora].sort((a, b) => a.nome.localeCompare(b.nome)),
    [procedimentosClinica, procedimentosCadastradosAgora]
  );

  const sentinelDaAncora = (ev: EventoOdontogramaParaOrc): number | null => {
    if (ev.nivel === 'boca') return ARCH_COMPLETA;
    if (ev.nivel === 'arcada') {
      if (ev.arcada === 'superior') return ARCH_SUPERIOR;
      if (ev.arcada === 'inferior') return ARCH_INFERIOR;
      return null;
    }
    if (ev.nivel === 'quadrante') {
      switch (ev.quadrante) {
        case 1: case 5: return QUAD_SUP_DIREITO;
        case 2: case 6: return QUAD_SUP_ESQUERDO;
        case 3: case 7: return QUAD_INF_ESQUERDO;
        case 4: case 8: return QUAD_INF_DIREITO;
        default: return null;
      }
    }
    return null;
  };

  const normalizarNomeProcedimento = (nome: string) => nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

  // O catálogo só entra automaticamente com nome exato. "Extração" e "Extração de siso",
  // por exemplo, são procedimentos e preços distintos; texto parecido não é vínculo clínico.
  const matchProcedimentoPorNomeExato = (nome: string) => {
    const normalizado = normalizarNomeProcedimento(nome);
    return procedimentosClinicaCompleto.find(
      (procedimento) => normalizarNomeProcedimento(procedimento.nome) === normalizado,
    );
  };

  // R-130 — fonte única da elegibilidade: evento clínico pode ser cobrado tenha sido ele
  // planejado ou realizado. Pré-existente é histórico; vínculo existente evita duplicidade.
  const eventoPodeEntrarNoOrcamento = (
    evento: EventoOdontogramaParaOrc,
    idsJaOrcados: ReadonlySet<string>,
  ) => evento.origem === 'clinica' && !idsJaOrcados.has(evento.id);

  const eventosParaItens = (
    eventos: EventoOdontogramaParaOrc[],
    idsJaOrcados: ReadonlySet<string> = eventoIdsJaOrcados,
  ): NovoOrcItem[] => {
    const elegiveis = eventos.filter((ev) => eventoPodeEntrarNoOrcamento(ev, idsJaOrcados));
    if (elegiveis.length === 0) return [];

    const grupos = new Map<string, EventoOdontogramaParaOrc[]>();
    for (const ev of elegiveis) {
      const chave = `${ev.tipo}|${ev.grupo_id ?? ev.id}`;
      const arr = grupos.get(chave);
      if (arr) arr.push(ev); else grupos.set(chave, [ev]);
    }

    return Array.from(grupos.values()).map((grupoEventos) => {
      const primeiro = grupoEventos[0];
      const catalogoVinculado = primeiro.procedimento_id
        ? procedimentosClinica.find((procedimento) => procedimento.id === primeiro.procedimento_id)
        : undefined;
      const rotulo = primeiro.procedimento_nome?.trim()
        || (primeiro.tipo === 'outro' ? primeiro.observacao?.trim() : null)
        || TIPO_LABEL[primeiro.tipo];
      const match = catalogoVinculado ?? matchProcedimentoPorNomeExato(rotulo);

      const dentesDistintos = [
        ...new Set(grupoEventos.map((ev) => ev.dente).filter((d): d is number => d != null)),
      ];
      const sentinel = sentinelDaAncora(primeiro);

      const quantidade = dentesDistintos.length > 0 ? dentesDistintos.length : 1;
      const alcance =
        sentinel != null
          ? denteLabel(sentinel)
          : dentesDistintos.length > 0
            ? `D${dentesDistintos.join(', D')}`
            : '';

      const pilares = grupoEventos
        .filter((ev) => ev.papel_no_grupo === 'pilar' && ev.dente != null)
        .map((ev) => `D${ev.dente}`);
      const ponticos = grupoEventos
        .filter((ev) => ev.papel_no_grupo === 'pontico' && ev.dente != null)
        .map((ev) => `D${ev.dente}`);
      const descricaoPonte = primeiro.tipo === 'ponte'
        ? `${match?.nome ?? 'Ponte fixa'} — pilares ${pilares.join(' e ') || alcance} · ${ponticos.length === 1 ? 'pôntico' : 'pônticos'} ${ponticos.join(', ') || alcance}`
        : null;

      return {
        procedimentoId: primeiro.procedimento_id ?? match?.id ?? '',
        descricao: descricaoPonte ?? (alcance ? `${rotulo} — ${alcance}` : rotulo),
        quantidade,
        preco: match?.preco_padrao != null ? formatValorBR(match.preco_padrao) : '',
        eventoIds: grupoEventos.map((evento) => evento.id),
        origem: 'evento',
      };
    });
  };

  // R-53 (§2.1, X1) — adapta o evento cru pro shape que filtro-responsavel.ts espera.
  const paraResponsavel = (ev: EventoOdontogramaParaOrc) => ({
    encaminhadoPara: ev.encaminhado_para
      ? { id: ev.encaminhado_para, nome: ev.encaminhado_dentista?.nome ?? 'Dentista' }
      : null,
  });

  // R-53 — flatten de N fichas (o agregado) pro filtro de responsável + eventosParaItens.
  const itensDoAgregado = (
    fichas: FichaParaOrc[],
    alvoDentistaId: string,
    idsJaOrcados: ReadonlySet<string> = eventoIdsJaOrcados,
  ): NovoOrcItem[] => {
    const itens = fichas.flatMap((f) => {
      const eventosComResponsavel = (f.odontograma_eventos ?? []).map((ev) => ({ ...ev, ...paraResponsavel(ev) }));
      const visiveis = eventosVisiveis(eventosComResponsavel, f.dentista_id, FILTRO_MEUS, alvoDentistaId);
      return eventosParaItens(visiveis, idsJaOrcados);
    });
    return itens.length > 0 ? itens : [ITEM_VAZIO];
  };

  // R-125b — a ficha pode ter eventos encaminhados de outro autor. A consulta no banco vem
  // completa e a responsabilidade é resolvida aqui, por evento; filtrar `fichas.dentista_id`
  // na query esconderia justamente os encaminhados corretos.
  const fichaParaItens = (
    ficha: FichaParaOrc,
    alvoDentistaId: string,
    idsJaOrcados: ReadonlySet<string> = eventoIdsJaOrcados,
  ): NovoOrcItem[] => {
    const eventos = ficha.odontograma_eventos ?? [];
    const visiveis = eventosVisiveis(
      eventos.map((ev) => ({ ...ev, ...paraResponsavel(ev) })),
      ficha.dentista_id,
      FILTRO_MEUS,
      alvoDentistaId,
    );
    const itens = eventosParaItens(visiveis, idsJaOrcados);
    // Texto legado é histórico, não identidade financeira. Uma Ficha sem evento estruturado
    // não cria item cobravel: sem `evento_id` não há como provar origem nem não duplicidade.
    return itens;
  };

  const bloqueioParaFichaSemItens = (ficha: FichaParaOrc | null, itens: NovoOrcItem[]) => {
    if (!ficha || itens.length > 0) return null;
    if ((ficha.odontograma_eventos ?? []).length === 0) {
      return 'Esta ficha não possui procedimentos estruturados. Registre o procedimento na ficha antes de gerar o orçamento.';
    }
    return 'Esta ficha não possui procedimentos clínicos disponíveis para este orçamento.';
  };

  /** O banco já barra evento de outro responsável. Este resumo apenas deixa a regra visível
   * antes do dentista editar preços ou tentar salvar o orçamento. */
  const resumoDaFichaParaOrcamento = (
    ficha: FichaParaOrc,
    alvoDentistaId: string,
    idsJaOrcados: ReadonlySet<string> = eventoIdsJaOrcados,
  ): ResumoOrigemOrcamento | null => {
    const eventos = ficha.odontograma_eventos ?? [];
    if (eventos.length === 0) return null;
    const eventosComResponsavel = eventos.map((ev) => ({ ...ev, ...paraResponsavel(ev) }));
    const visiveis = eventosVisiveis(eventosComResponsavel, ficha.dentista_id, FILTRO_MEUS, alvoDentistaId);
    const idsVisiveis = new Set(visiveis.map((ev) => ev.id));
    const candidatos = eventos.filter((ev) => ev.origem === 'clinica' && !idsJaOrcados.has(ev.id));
    const deOutros = candidatos.filter((ev) => !idsVisiveis.has(ev.id));
    const responsaveis = [...new Set(deOutros.map((ev) => ev.encaminhado_dentista?.nome ?? ficha.dentista?.nome ?? 'outro dentista'))];
    return {
      disponiveis: candidatos.length - deOutros.length,
      deOutrosResponsaveis: deOutros.length,
      responsaveis,
    };
  };

  const alvoAtual = () => isSecretaria
    ? (novoOrcDentistaAlvoId || dentistasClinica[0]?.id || '')
    : meuDentistaId;

  const carregarEventoIdsJaOrcados = async (
    fichas: FichaParaOrc[],
    eventosExtras: EventoOdontogramaParaOrc[] = [],
  ): Promise<Set<string>> => {
    const eventoIds = [
      ...fichas.flatMap((ficha) => (ficha.odontograma_eventos ?? []).map((evento) => evento.id)),
      ...eventosExtras.map((evento) => evento.id),
    ];
    const idsUnicos = [...new Set(eventoIds)];
    if (idsUnicos.length === 0) return new Set();

    const supabase = createClient();
    const { data, error } = await supabase
      .from('orcamento_eventos')
      .select('evento_id')
      .eq('clinica_id', clinicaId)
      .in('evento_id', idsUnicos);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((row) => row.evento_id));
  };

  /** R-135 — uma ficha pode ter orçamento já criado. Nunca escolhe um legado duplicado sozinho. */
  const carregarModoDaFicha = async (fichaId: string, dentistaId: string): Promise<ModoPersistenciaOrcamento> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orcamentos')
      .select('id')
      .eq('ficha_id', fichaId)
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .eq('dentista_id', dentistaId)
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 1) {
      throw new Error('Há mais de um orçamento desta ficha. Abra o orçamento que deseja ajustar na aba Orçamentos.');
    }
    return data?.[0] ? { tipo: 'adicionar', orcamentoId: data[0].id } : { tipo: 'novo' };
  };

  const handleDentistaAlvoChange = (id: string) => {
    setNovoOrcDentistaAlvoId(id);
    // Só o fluxo agregado da ficha usa `itensDoAgregado`. O Meu dia e o fallback de uma
    // ficha preservam seus itens próprios — trocar o select nunca pode reinterpretá-los.
    if (isSecretaria && fichaOrcId === null && etapaNovoOrc === 'itens') {
      setNovoOrcItens(itensDoAgregado(fichasParaOrc, id, eventoIdsJaOrcados));
    }
    if (isSecretaria && fichaOrcId !== null && etapaNovoOrc === 'itens') {
      const ficha = fichasParaOrc.find((item) => item.id === fichaOrcId);
      if (ficha) {
        const itens = fichaParaItens(ficha, id, eventoIdsJaOrcados);
        setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
        setResumoOrigemOrcamento(resumoDaFichaParaOrcamento(ficha, id, eventoIdsJaOrcados));
        setBloqueioFicha(bloqueioParaFichaSemItens(ficha, itens));
      }
      void carregarModoDaFicha(fichaOrcId, id)
        .then(setModoPersistencia)
        .catch((error: unknown) => {
          setModoPersistencia({ tipo: 'novo' });
          setOrcError(error instanceof Error ? error.message : 'Não foi possível localizar o orçamento desta ficha.');
        });
    }
  };

  // R-130 — busca única do agregado: todos os eventos clínicos do paciente, reusada pelos
  // pontos de entrada que agregam. A responsabilidade continua resolvida em JS.
  const carregarFichasAgregado = async (): Promise<FichaParaOrc[]> => {
    const supabase = createClient();
    const query = supabase
      .from('fichas')
      .select(SELECT_FICHA_PARA_ORC_AGREGADO)
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .eq('odontograma_eventos.origem', 'clinica');
    const { data, error } = await query.order('data_atendimento', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as FichaParaOrc[]) ?? [];
  };

  const abrirNovoOrcamento = async () => {
    setOrcError(null);
    setIsLoadingFichaParaOrc(true);
    try {
      const agregado = await carregarFichasAgregado();
      const idsJaOrcados = await carregarEventoIdsJaOrcados(agregado);
      setEventoIdsJaOrcados(idsJaOrcados);

      if (agregado.length > 0) {
        // fichaOrcId fica null — o orçamento não pertence mais a 1 ficha só (I6). O alvo é o
        // próprio dentista ou, para secretária, o dentista selecionado no campo obrigatório.
        const alvoId = alvoAtual();
        setFichasParaOrc(agregado);
        // Uma única ficha é um caso não ambíguo: mantém a relação orçamento↔ficha e, se já
        // existir uma proposta nela, passa ao modo de acrescentar. Com várias fichas, a origem
        // é agregada e um novo orçamento continua sendo o comportamento correto.
        if (agregado.length === 1) {
          setFichaOrcId(agregado[0].id);
          setModoPersistencia(await carregarModoDaFicha(agregado[0].id, alvoId));
          const itens = fichaParaItens(agregado[0], alvoId, idsJaOrcados);
          setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
          setResumoOrigemOrcamento(resumoDaFichaParaOrcamento(agregado[0], alvoId, idsJaOrcados));
        } else {
          setFichaOrcId(null);
          setModoPersistencia({ tipo: 'novo' });
          setNovoOrcItens(itensDoAgregado(agregado, alvoId, idsJaOrcados));
          setResumoOrigemOrcamento(null);
        }
        setEtapaNovoOrc('itens');
      } else {
        // G4 — fallback INTACTO: nenhum indicado aberto em ficha nenhuma. Mesmo comportamento
        // de antes do R-53 (10 fichas recentes, decide selecionar vs. texto).
        const supabase = createClient();
        const { data, error } = await supabase
          .from('fichas')
          .select(SELECT_FICHA_PARA_ORC)
          .eq('paciente_id', pacienteId)
          .eq('clinica_id', clinicaId)
          .order('data_atendimento', { ascending: false })
          .limit(10);
        if (error) throw new Error(error.message);

        const fichas = (data as unknown as FichaParaOrc[]) ?? [];
        const idsJaOrcadosFallback = await carregarEventoIdsJaOrcados(fichas);
        setEventoIdsJaOrcados(idsJaOrcadosFallback);
        setFichasParaOrc(fichas);

        if (fichas.length > 1) {
          setFichaOrcId(null);
          setEtapaNovoOrc('selecionar');
          setNovoOrcItens([ITEM_VAZIO]);
          setResumoOrigemOrcamento(null);
        } else {
          setFichaOrcId(fichas.length === 1 ? fichas[0].id : null);
          if (fichas.length === 1) {
            setModoPersistencia(await carregarModoDaFicha(fichas[0].id, alvoAtual()));
          } else {
            setModoPersistencia({ tipo: 'novo' });
          }
          const itens = fichas.length === 1
            ? fichaParaItens(fichas[0], alvoAtual(), idsJaOrcadosFallback)
            : [];
          setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
          setResumoOrigemOrcamento(fichas.length === 1
            ? resumoDaFichaParaOrcamento(fichas[0], alvoAtual(), idsJaOrcadosFallback)
            : null);
          setEtapaNovoOrc('itens');
        }
      }
    } catch (error: unknown) {
      setFichasParaOrc([]);
      setFichaOrcId(null);
      setNovoOrcItens([ITEM_VAZIO]);
      setResumoOrigemOrcamento(null);
      setEtapaNovoOrc('itens');
      setOrcError(error instanceof Error ? error.message : 'Não foi possível carregar os procedimentos indicados. Tente novamente antes de criar o orçamento.');
    } finally {
      setIsLoadingFichaParaOrc(false);
    }
    setIsNovoOrcOpen(true);
  };

  // NOVO (R-46h) — picker geral do Meu dia: pula direto pro passo 'selecionar', sem o "geral
  // vs. por-ficha" que abrirNovoOrcamento tem, porque aqui o paciente já é o do slot aberto.
  // R-83 (08/08) — com `eventosRascunho`, pula direto pra 'itens': o rascunho é sempre do
  // dentista logado (Meu dia é dele), por isso entra fixo em FILTRO_MEUS.
  // R-84 §5.2 — NÃO junta mais com o agregado do banco (era o vazamento: `indicado` em aberto
  // aqui quer dizer "já vendido na avaliação", não "esquecido" — R-53 §2.2). `carregarFichasAgregado`
  // continua chamado: `fichasParaOrc` alimenta o `← Voltar` (§5.3), o caminho manual pro backlog.
  const abrirPickerFichasAbertas = async (fichaId: string | null, eventosRascunho: EventoOdontogramaParaOrc[] = []) => {
    setOrcError(null);
    setContextoClinicoPendente(false);
    setIsLoadingFichaParaOrc(true);
    try {
      const fichas = await carregarFichasAgregado();
      const idsJaOrcados = await carregarEventoIdsJaOrcados(fichas, eventosRascunho);
      setEventoIdsJaOrcados(idsJaOrcados);
      setFichasParaOrc(fichas);
      // R-85 — antes sempre null (o orçamento nascia órfão). Agora recebe o id real que o
      // chamador já garantiu existir quando há algo novo do rascunho pra orçar.
      setFichaOrcId(fichaId);
      setModoPersistencia({ tipo: 'novo' });

      if (eventosRascunho.length > 0) {
        const itens = eventosParaItens(eventosRascunho, idsJaOrcados);
        setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
        setResumoOrigemOrcamento(null);
        setBloqueioFicha(itens.length > 0 ? null : 'Não há procedimentos clínicos disponíveis para este orçamento.');
        setEtapaNovoOrc('itens');
      } else {
        setBloqueioFicha(null);
        setEtapaNovoOrc('selecionar');
      }
    } catch {
      setFichasParaOrc([]);
      setOrcError('Não deu pra carregar as fichas em aberto.');
    } finally {
      setIsLoadingFichaParaOrc(false);
    }
    setIsNovoOrcOpen(true);
  };

  const abrirMontagemManualMeuDia = () => {
    setOrcError(null);
    setFichaOrcId(null);
    setFichasParaOrc([]);
    setModoPersistencia({ tipo: 'novo' });
    setNovoOrcItens([ITEM_VAZIO]);
    setResumoOrigemOrcamento(null);
    setBloqueioFicha(null);
    setContextoClinicoPendente(true);
    setEtapaNovoOrc('itens');
    setIsNovoOrcOpen(true);
  };

  const selecionarFichaParaOrc = async (fichaId: string | null) => {
    setFichaOrcId(fichaId);
    if (!fichaId) {
      setModoPersistencia({ tipo: 'novo' });
      setNovoOrcItens([ITEM_VAZIO]);
      setResumoOrigemOrcamento(null);
    } else {
      const ficha = fichasParaOrc.find((f) => f.id === fichaId);
      try {
        setModoPersistencia(await carregarModoDaFicha(fichaId, alvoAtual()));
      } catch (error: unknown) {
        setModoPersistencia({ tipo: 'novo' });
        setOrcError(error instanceof Error ? error.message : 'Não foi possível localizar o orçamento desta ficha.');
        return;
      }
      const itens = ficha ? fichaParaItens(ficha, alvoAtual(), eventoIdsJaOrcados) : [];
      setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
      setResumoOrigemOrcamento(ficha ? resumoDaFichaParaOrcamento(ficha, alvoAtual(), eventoIdsJaOrcados) : null);
      setBloqueioFicha(bloqueioParaFichaSemItens(ficha ?? null, itens));
    }
    setEtapaNovoOrc('itens');
  };

  // #6 — gerar orçamento a partir de uma ficha é SÓ dela (decisão 07/08): nunca puxa outra
  // ficha nem outro dentista. Quem quer ver várias fichas juntas usa o picker (agrega).
  const abrirOrcamentoParaFicha = async (fichaId: string) => {
    setOrcError(null);
    setContextoClinicoPendente(false);
    setIsLoadingFichaParaOrc(true);
    try {
      const supabase = createClient();
      const query = supabase
        .from('fichas')
        .select(SELECT_FICHA_PARA_ORC)
        .eq('id', fichaId)
        .eq('clinica_id', clinicaId)
        .eq('paciente_id', pacienteId);
      const { data, error } = await query.single();
      if (error) throw new Error(error.message);
      const ficha = data as unknown as FichaParaOrc | null;
      const idsJaOrcados = await carregarEventoIdsJaOrcados(ficha ? [ficha] : []);
      setEventoIdsJaOrcados(idsJaOrcados);
      setFichaOrcId(fichaId);
      setFichasParaOrc(ficha ? [ficha] : []);
      setModoPersistencia(await carregarModoDaFicha(fichaId, alvoAtual()));
      const itens = ficha ? fichaParaItens(ficha, alvoAtual(), idsJaOrcados) : [];
      setNovoOrcItens(itens.length > 0 ? itens : [ITEM_VAZIO]);
      setResumoOrigemOrcamento(ficha ? resumoDaFichaParaOrcamento(ficha, alvoAtual(), idsJaOrcados) : null);
      setBloqueioFicha(bloqueioParaFichaSemItens(ficha, itens));
    } catch (error: unknown) {
      setFichaOrcId(fichaId);
      setFichasParaOrc([]);
      setModoPersistencia({ tipo: 'novo' });
      setNovoOrcItens([ITEM_VAZIO]);
      setResumoOrigemOrcamento(null);
      setBloqueioFicha(null);
      setOrcError(error instanceof Error ? error.message : 'Não foi possível localizar o orçamento desta ficha.');
    } finally {
      setEtapaNovoOrc('itens');
      setIsLoadingFichaParaOrc(false);
    }
    setIsNovoOrcOpen(true);
  };

  // Cadastra no catálogo um procedimento digitado que não bateu com nenhum item existente.
  const handleCadastrarProcedimento = async (idx: number) => {
    const item = novoOrcItens[idx];
    const nome = stripDenteDoNome(item.descricao);
    if (!nome) return;
    setRegisteringProcIdx(idx);
    const precoNum = parseValorBR(item.preco);
    const result = await criarProcedimentoRapido({
      nome,
      precoPadrao: precoNum > 0 ? precoNum : null,
      dentistaId: isSecretaria ? novoOrcDentistaAlvoId : undefined,
    });
    if (result.error || !result.id) {
      toast.error(result.error ?? 'Não foi possível cadastrar o procedimento.');
    } else {
      const novoId = result.id;
      const canonico = normalizarNomeProcedimento(nome);
      const precoCanonico = result.precoPadrao != null ? formatValorBR(result.precoPadrao) : '';
      setProcedimentosCadastradosAgora((prev) => [...prev, { id: novoId, nome, preco_padrao: result.precoPadrao ?? null }]);
      // Linhas iguais ainda estão apenas na montagem. Sincronizar aqui evita que o mesmo
      // procedimento siga com preço/ID divergente, sem tocar em orçamento já persistido.
      setNovoOrcItens((prev) => prev.map((it) => (
        normalizarNomeProcedimento(stripDenteDoNome(it.descricao)) === canonico
          ? { ...it, procedimentoId: novoId, preco: precoCanonico || it.preco }
          : it
      )));
      toast.success('Procedimento cadastrado no catálogo.');
    }
    setRegisteringProcIdx(null);
  };

  const carregarOrcamentoPersistido = async (orcamentoId: string): Promise<OrcamentoComItens> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orcamentos')
      .select('id, status, total, valor_acordado, plano_forma, desconto, created_at, validade_dias, condicoes_pagamento, mostrar_valor_por_item, dentista_id, orcamento_itens(id, descricao, preco_total, quantidade, aprovado, composicao)')
      .eq('id', orcamentoId)
      .eq('paciente_id', pacienteId)
      .eq('clinica_id', clinicaId)
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Orçamento não localizado após salvar.');

    const orcamento = data as unknown as Omit<OrcamentoComItens, 'itens' | 'pagamentos' | 'cobrancas' | 'aprovado_por' | 'aprovado_em' | 'aceite'> & {
      orcamento_itens: OrcamentoComItens['itens'] | null;
    };
    return {
      ...orcamento,
      itens: orcamento.orcamento_itens ?? [],
      pagamentos: [],
      cobrancas: [],
      aprovado_por: null,
      aprovado_em: null,
      aceite: null,
    };
  };

  const handleCriarOrcamento = async () => {
    if (erroCatalogo) {
      setOrcError(erroCatalogo);
      return;
    }
    if (bloqueioFicha) {
      setOrcError(bloqueioFicha);
      return;
    }
    const itensValidos = novoOrcItens.filter((i) => i.selecionado !== false && i.descricao.trim());
    if (itensValidos.length === 0) {
      setOrcError('Adicione ao menos um procedimento com descrição.');
      return;
    }
    const temSemPreco = itensValidos.some((i) => parseValorBR(i.preco) === 0);
    if (temSemPreco) {
      setOrcError('Atenção: alguns procedimentos estão sem valor. Defina o preço antes de continuar.');
      return;
    }
    if (isSecretaria && !novoOrcDentistaAlvoId) {
      setOrcError('Selecione o dentista responsável.');
      return;
    }
    const numeroParcelas = parseInt(novoOrcNumParcelas, 10);
    if (modoPersistencia.tipo === 'novo' && novoOrcPlanoForma === 'parcelado' && (!numeroParcelas || numeroParcelas < 2 || numeroParcelas > 24)) {
      setOrcError('Informe entre 2 e 24 parcelas.');
      return;
    }
    if (modoPersistencia.tipo === 'novo' && novoOrcPlanoForma === 'parcelado' && !novoOrcPrimeiroVencimento) {
      setOrcError('Informe o primeiro vencimento das parcelas.');
      return;
    }
    setOrcError(null);
    setOrcSaving(true);

    try {
      const subtotalValido = itensValidos.reduce((s, i) => s + i.quantidade * parseValorBR(i.preco), 0);
      const finalValido    = novoOrcValorFinal !== null ? Math.max(0, novoOrcValorFinal) : subtotalValido;
      const descontoValor  = Math.max(0, Math.round((subtotalValido - finalValido) * 100) / 100);

      let fichaParaSalvar = fichaOrcId;
      let itensParaSalvar = itensValidos.map((i) => ({
        procedimentoId: i.procedimentoId || null,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: parseValorBR(i.preco),
        eventoIds: i.eventoIds ?? [],
        composicao: composicaoParaSalvar(i),
      }));

      const itensManuais = novoOrcItens.flatMap((item, indice) => (
        item.selecionado !== false && item.descricao.trim() && (item.eventoIds?.length ?? 0) === 0
          ? [{ indice, procedimentoId: item.procedimentoId, descricao: item.descricao, quantidade: item.quantidade }]
          : []
      ));

      if (prepararItensClinicos && contextoClinicoPendente && itensManuais.length > 0) {
        if (itensManuais.some((item) => !item.procedimentoId)) {
          setOrcError('Escolha um procedimento do catálogo ou cadastre-o antes de gerar o orçamento.');
          setOrcSaving(false);
          return;
        }

        const checkpoint = await prepararItensClinicos(itensManuais);
        if (!checkpoint.ok) {
          setOrcError(checkpoint.erro);
          setOrcSaving(false);
          return;
        }

        const eventoIdsPorIndice = new Map(
          checkpoint.eventosPorIndice.map((item) => [item.indice, item.eventoIds]),
        );
        fichaParaSalvar = checkpoint.fichaId;
        setFichaOrcId(checkpoint.fichaId);
        setContextoClinicoPendente(false);
        setNovoOrcItens((prev) => prev.map((item, indice) => {
          const eventoIds = eventoIdsPorIndice.get(indice);
          return eventoIds ? { ...item, eventoIds, origem: 'evento' } : item;
        }));
        itensParaSalvar = novoOrcItens.flatMap((item, indice) => {
          if (item.selecionado === false || !item.descricao.trim()) return [];
          return [{
            procedimentoId: item.procedimentoId || null,
            descricao: item.descricao,
            quantidade: item.quantidade,
            precoUnitario: parseValorBR(item.preco),
            composicao: composicaoParaSalvar(item),
            eventoIds: item.eventoIds?.length
              ? item.eventoIds
              : eventoIdsPorIndice.get(indice) ?? [],
          }];
        });
      }

      if (contextoClinicoPendente && !fichaParaSalvar) {
        setOrcError('Registre ao menos um procedimento clínico antes de criar o orçamento.');
        setOrcSaving(false);
        return;
      }

      if (modoPersistencia.tipo === 'adicionar') {
        const result = await adicionarItensAoOrcamento({
          orcamentoId: modoPersistencia.orcamentoId,
          itens: itensParaSalvar,
        });
        if (result.error) {
          setOrcError(result.error);
        } else {
          setIsNovoOrcOpen(false);
          setNovoOrcItens([ITEM_VAZIO]);
          toast.success(`${itensValidos.length} procedimento${itensValidos.length === 1 ? '' : 's'} adicionado${itensValidos.length === 1 ? '' : 's'} ao orçamento.`);
          router.refresh();
        }
        setOrcSaving(false);
        return;
      }

      const result = await criarOrcamento({
        pacienteId,
        desconto: descontoValor,
        fichaId: fichaParaSalvar,
        dentistaId: isSecretaria ? novoOrcDentistaAlvoId : undefined,
        itens: itensParaSalvar,
      });

      if (result.error) {
        setOrcError(result.error);
      } else {
        const novoTotal = Math.max(0, subtotalValido - descontoValor);
        let novoOrc: OrcamentoComItens = {
          id: result.id ?? crypto.randomUUID(),
          status: 'rascunho',
          total: novoTotal,
          // R-114 — nasce null: sem plano de pagamento (R-34) ainda, o devido é derivado da
          // soma dos itens aprovados, não deste campo (I1).
          valor_acordado: null,
          desconto: descontoValor,
          created_at: new Date().toISOString(),
          validade_dias: 30,
          condicoes_pagamento: null,
          mostrar_valor_por_item: false,
          dentista_id: isSecretaria ? novoOrcDentistaAlvoId : meuDentistaId,
          itens: itensValidos.map((i, idx) => ({
            id: `temp-${idx}`,
            descricao: i.descricao,
            quantidade: i.quantidade,
            preco_total: i.quantidade * parseValorBR(i.preco),
            composicao: composicaoParaSalvar(i),
            // R-114 — orçamento nasce Proposto: nenhum item aprovado ainda (mesmo default da
            // coluna no banco). É o dentista/secretária que marca o que o paciente aceitou.
            aprovado: false,
          })),
          pagamentos: [],
          cobrancas: [],
          aprovado_por: null,
          aprovado_em: null,
          aceite: null,
        };
        let podeAbrirConfiguracao = false;
        if (result.id) {
          try {
            novoOrc = await carregarOrcamentoPersistido(result.id);
            podeAbrirConfiguracao = true;
          } catch {
            // A proposta já está no banco; não inventamos ids temporários para ações de aceite.
            // O refresh permite retomá-la pelo perfil sem risco de duplicação.
            router.refresh();
            toast.error('Proposta criada, mas não foi possível abrir a configuração agora. Recarregue o perfil para continuar.');
          }
        }
        setIsNovoOrcOpen(false);
        setNovoOrcItens([ITEM_VAZIO]);

        // R-34 — plano de pagamento definido junto da criação (opcional). Roda depois do
        // orçamento existir de verdade (precisa do id real, não do temp/otimista acima).
        let precisaAtualizar = false;
        if (result.id && novoOrcPlanoForma === 'parcelado') {
          const planoResult = await gerarParcelas({
            orcamentoId: result.id,
            numeroParcelas,
            primeiroVencimento: novoOrcPrimeiroVencimento,
            valorAcordado: novoTotal,
            parcelasForma: novoOrcParcelasForma || undefined,
          });
          if (planoResult.error) {
            toast.error(`Orçamento criado, mas o parcelamento falhou: ${planoResult.error}`);
          } else {
            precisaAtualizar = true;
          }
        } else if (result.id && novoOrcPlanoForma === 'avista') {
          const planoResult = await definirPlanoAvista({ orcamentoId: result.id, valorAcordado: novoTotal });
          if (planoResult.error) {
            toast.error(`Orçamento criado, mas a forma de pagamento falhou: ${planoResult.error}`);
          } else {
            precisaAtualizar = true;
          }
        }
        setNovoOrcPlanoForma(null);
        setNovoOrcNumParcelas('3');
        setNovoOrcPrimeiroVencimento('');
        setNovoOrcParcelasForma('');
        if (precisaAtualizar && result.id) {
          try {
            novoOrc = await carregarOrcamentoPersistido(result.id);
          } catch {
            router.refresh();
          }
        }
        onOrcamentoCriado?.(novoOrc);

        toast.success('Orçamento criado como rascunho', {
          description: 'Revise os itens e envie para o paciente quando estiver pronto.',
          duration: 4000,
        });
        if (result.id && podeAbrirConfiguracao) onContinuarConfiguracao?.(result.id);
      }
    } catch {
      setOrcError("Não foi possível confirmar a operação. Confira os orçamentos antes de tentar novamente.");
      toast.error("Não foi possível concluir a confirmação. Confira o perfil antes de repetir a operação.");
      router.refresh();
    } finally {
      setOrcSaving(false);
    }
  };

  const modalProps: NovoOrcamentoModalProps = {
    open: isNovoOrcOpen,
    onOpenChange: (open) => {
      setIsNovoOrcOpen(open);
      if (!open) {
        setEtapaNovoOrc('itens'); setFichasParaOrc([]); setOrcError(null); setNovoOrcValorFinal(null);
        setModoPersistencia({ tipo: 'novo' });
        setEventoIdsJaOrcados(new Set());
        setResumoOrigemOrcamento(null);
        setBloqueioFicha(null);
        setContextoClinicoPendente(false);
        setNovoOrcPlanoForma(null); setNovoOrcNumParcelas('3'); setNovoOrcPrimeiroVencimento(''); setNovoOrcParcelasForma('');
      }
    },
    etapaNovoOrc,
    setEtapaNovoOrc,
    fichasParaOrc,
    // R-84 §5.3 — o picker oferece trocar de ficha; o caminho por-ficha (`abrirOrcamentoParaFicha`)
    // é deliberadamente fechado (decisão 07/08: "orçamento de uma ficha é SÓ dela"). `fichaOrcId`
    // sozinho não basta como discriminador: `selecionarFichaParaOrc` (a própria tela de seleção do
    // picker) TAMBÉM o preenche ao escolher uma ficha da lista, o que apagava o botão depois de
    // escolher — regressão achada pelo typescript-reviewer no gate deste item. `fichasParaOrc.length
    // > 1` cobre esse caso (o array não encolhe ao selecionar, só `fichaOrcId` muda); o segundo termo
    // cobre o picker com exatamente 1 ficha (G6b) sem reabrir o caminho por-ficha (que nunca tem mais
    // de 1 ficha no array, então o primeiro termo nunca o alcança).
    podeTrocarFicha: fichasParaOrc.length > 1 || (fichaOrcId == null && fichasParaOrc.length > 0),
    orcError,
    bloqueioCriacao: erroCatalogo ?? bloqueioFicha,
    novoOrcItens,
    setNovoOrcItens,
    procedimentosClinica: procedimentosClinicaCompleto,
    novoOrcSubtotal,
    novoOrcTotal,
    novoOrcValorFinal,
    setNovoOrcValorFinal,
    orcSaving,
    modoPersistencia: modoPersistencia.tipo,
    contextoClinicoPendente,
    resumoOrigemOrcamento,
    onCriarOrcamento: () => void handleCriarOrcamento(),
    onSelecionarFicha: selecionarFichaParaOrc,
    onCadastrarProcedimento: (idx) => void handleCadastrarProcedimento(idx),
    registeringProcIdx,
    isSecretaria,
    dentistasClinica,
    dentistaAlvoId: novoOrcDentistaAlvoId,
    onDentistaAlvoChange: handleDentistaAlvoChange,
    planoForma: novoOrcPlanoForma,
    setPlanoForma: setNovoOrcPlanoForma,
    planoNumParcelas: novoOrcNumParcelas,
    setPlanoNumParcelas: setNovoOrcNumParcelas,
    planoPrimeiroVencimento: novoOrcPrimeiroVencimento,
    setPlanoPrimeiroVencimento: setNovoOrcPrimeiroVencimento,
    planoParcelasForma: novoOrcParcelasForma,
    setPlanoParcelasForma: setNovoOrcParcelasForma,
  };

  return {
    abrirNovoOrcamento,
    abrirOrcamentoParaFicha,
    abrirPickerFichasAbertas,
    abrirMontagemManualMeuDia,
    isLoadingFichaParaOrc,
    modalProps,
  };
}
