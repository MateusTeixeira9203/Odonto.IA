"use client";
import * as React from "react";
import {
  Plus,
  Trash2,
  FileText,
  Download,
  Check,
  Loader2,
  PenLine,
  Pencil,
  Clock,
  Circle,
  ChevronRight,
  Forward,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DexLoader } from "@/components/ui/dex-loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { toast } from 'sonner';
import type { PlanoId } from "@/lib/planos";
import { Odontograma, computeToothState, type ToothStatus } from "@/components/odontograma/Odontograma";
import { ToothDetailPanel } from "@/components/odontograma/ToothDetailPanel";
import { OdontogramaComPainel } from "@/components/odontograma/OdontogramaComPainel";
import { FaixaLote } from "@/components/odontograma/faixa-lote";
import { FaixaEscopoRegional } from "@/components/odontograma/faixa-escopo-regional";
import { ARCH_LABELS } from "@/lib/arcadas";
import dynamic from 'next/dynamic';
import type SignaturePadLib from 'signature_pad';
import { formatarDataFicha } from '@/lib/format-data-ficha';
import { CapturaLivreCard, type CapturaDexState } from '@/components/fichas/captura-livre-card';
import { ColarDoWordDialog } from '@/components/pacientes/colar-do-word-dialog';
import { OrtoCard } from '@/components/fichas/orto-card';
import { OrtoForm, ORTO_VAZIO } from '@/components/fichas/orto-form';
import { normalizarOrtoManutencao } from '@/lib/especialidades/orto';
import { RegistroCard, type RegistroCardData } from '@/components/fichas/registro-card';
import { DenteGrupoHeader } from '@/components/fichas/dente-grupo-header';
import { corpoEspecialidade, corpoEspecialidadeEditavel } from '@/components/fichas/corpo-especialidade';
import { eventosParaCards } from '@/lib/odontograma/eventos-para-cards';
import type { EscopoRegional } from '@/lib/odontograma/escopo-regional';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';
import { TIPO_LABEL } from '@/types/odontograma';
import type {
  OrtoManutencaoInfo, ModoLancamento, OdontogramaEventoDraft,
  TipoRegistroOdontograma, StatusRegistro, OrigemRegistro, AncoraClinica,
  NivelAncora, Arcada, FaceDental, PapelNoGrupo, MomentoPlanejado,
} from '@/types/odontograma';
import type { FichaEvolucao } from '@/types/ficha';
import { nomeTratamentoDerivado } from '@/lib/ficha/nome-tratamento';
import { alternarStatusRegistro, alternarMomentoRegistro, encaminharProcedimento, atualizarStatusEncaminhado, preencherDetalheEncaminhado, assinarProcedimentos, assinarTodosRealizadosDaFicha } from '@/server/patients/registro-actions';
import { salvarFicha, deletarFicha, contarVinculosFicha, type VinculosFicha } from '@/server/patients/salvar-ficha';
import { derivarResponsaveis, eventosVisiveis, fichaVisivel, filtroAindaValido } from '@/lib/fichas/filtro-responsavel';
import { ChipsResponsavel } from '@/components/fichas/chips-responsavel';
import { EncaminharBar } from '@/components/fichas/encaminhar-bar';
import { AssinarBar } from '@/components/fichas/assinar-bar';
import { agruparRegistros } from '@/lib/odontograma/agrupar-registros';
import { agruparPorDente, type SecaoRegistros } from '@/lib/odontograma/agrupar-por-dente';
import { derivarV2DosEventos } from '@/lib/odontograma/derivar-campos-legado';
import { agregarGruposAbertos } from '@/lib/odontograma/grupos-abertos';
import { dedupEventosDraft, mesclarEventosSemPerda } from '@/lib/odontograma/dedup-eventos-draft';
import { extrairEndoDeterministico } from '@/lib/especialidades/extrair-endo-deterministico';
import { mesclarDetalheEndo } from '@/lib/especialidades/mesclar-endo-extracao';
import type { EndoDetalhe } from '@/lib/especialidades/endo';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
const SignaturePad = dynamic(
  () => import('@/components/fichas/SignaturePad').then(m => m.SignaturePad),
  { ssr: false }
);

interface ToothNote {
  tooth: number;
  notes: string[];
}



type ProcStatus = ToothStatus;

/**
 * R-03b — alvo do Dialog de assinatura. 'legado' é o caminho antigo (ficha sem evento,
 * fichas.assinado_em); 'todos'/'subset' são os dois caminhos granulares (R-03a) — a
 * diferença é só QUEM resolve os eventoIds (o servidor, no gesto padrão de 1 clique, ou o
 * client, quando o dentista selecionou um subconjunto via AssinarBar).
 */
type SigningTarget =
  | { kind: 'legado'; fichaId: string }
  | { kind: 'todos'; fichaId: string; pacienteId: string }
  | { kind: 'subset'; fichaId: string; eventoIds: string[]; pacienteId: string };

// #16 D3 — ciclo de status (clique avança) e metadados visuais (cinza → âmbar → teal).
const STATUS_CYCLE: Record<ProcStatus, ProcStatus> = {
  nao_iniciado: 'em_andamento',
  em_andamento: 'concluido',
  concluido: 'nao_iniciado',
};

const STATUS_META: Record<ProcStatus, { label: string; icon: typeof Check; className: string }> = {
  nao_iniciado: { label: 'A fazer', icon: Circle, className: 'bg-surface border-border text-text-secondary hover:border-teal hover:text-teal' },
  em_andamento: { label: 'Em andamento', icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20' },
  concluido: { label: 'Concluído', icon: Check, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' },
};


/** Evento de odontograma de uma ficha, forma enxuta pra render dos cards §11 (camada 2). */
interface EventoView {
  id: string;
  grupoId: string | null;
  /** R-06: papel na ponte (pilar/pôntico) — antes descartado na leitura, o que perderia
   *  os papéis ao editar uma ficha com ponte. */
  papelNoGrupo: PapelNoGrupo | null;
  tipo: TipoRegistroOdontograma;
  procedimentoId: string | null;
  procedimentoNome: string | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momentoPlanejado: MomentoPlanejado;
  ancora: AncoraClinica;
  observacao: string | null;
  realizadoEm: string | null;
  registradoEm: string;
  createdAt: string;
  /** Dado clínico da especialidade (migration 106) — cru, ainda não validado. */
  detalhe: unknown | null;
  /** Destino do encaminhamento (R-04) — null = não encaminhado. */
  encaminhadoPara: { id: string; nome: string } | null;
  /** Assinatura que congelou este registro (R-03a/b) — null = ainda editável. Trava por
   *  REGISTRO, não mais por ficha inteira (evo.assinadoEm segue existindo, mas só rege o
   *  caminho legado sem evento — ver spec R-03b). */
  assinaturaId: string | null;
}

/**
 * Linha crua da tabela odontograma_eventos. A âncora NÃO é uma coluna composta — o schema
 * (migration 101) achata em nivel/arcada/quadrante/dente/faces, exatamente como a escrita
 * grava (`montarRowsEventos` em consulta/actions.ts). Ler pedindo uma coluna `ancora` que
 * não existe falha silenciosamente sem checagem de erro — foi um bug real desta sessão,
 * invisível enquanto o banco não tinha eventos pra expô-lo.
 */
type EventoRow = {
  id: string;
  ficha_id: string | null;
  grupo_id: string | null;
  papel_no_grupo: PapelNoGrupo | null;
  tipo: TipoRegistroOdontograma;
  procedimento_id: string | null;
  procedimento_nome: string | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** R-101 — ver corDoRegistro. Default 'sessao_atual'. */
  momento_planejado: MomentoPlanejado;
  nivel: NivelAncora;
  arcada: Arcada | null;
  quadrante: number | null;
  dente: number | null;
  faces: FaceDental[] | null;
  observacao: string | null;
  /** Dado clínico da especialidade (migration 106) — cru, ainda não validado. */
  detalhe: unknown | null;
  realizado_em: string | null;
  registrado_em: string;
  created_at: string;
  /** Destino do encaminhamento (R-04, migration 106/109) — null = não encaminhado. */
  encaminhado_para: string | null;
  encaminhado_dentista: { id: string; nome: string } | null;
  /** Assinatura por registro (R-03a, migration 111) — null = ainda editável. */
  assinatura_id: string | null;
};

interface Evolution {
  id: string;
  date: string;
  /** Data CLÍNICA do atendimento (pode ser retroativa) — migration 100. ISO 'YYYY-MM-DD'. */
  dataAtendimento: string;
  type: string;
  observation: string;
  teethNotes: ToothNote[];
  professional: string;
  files: string[];
  procedimentosConcluidos: string[];
  procedimentosStatus: Record<string, ProcStatus>;
  procedimentos: string[];
  conduta: string | null;
  assinaturaUrl: string | null;
  assinadoEm: string | null;
  tratamentoId: string | null;
  /** Manutenção ortodôntica da consulta (Roadmap A / A0) — registro de arcada, não pinta dente. */
  ortoManutencao: OrtoManutencaoInfo | null;
  /** Autor da ficha. A ficha é lida por toda a clínica; só o autor escreve (migration 099). */
  dentistaId: string;
  /** CRO do autor — pro card §11 (fiscalização). */
  autorCro: string | null;
  /** Eventos do odontograma desta ficha (camada 2). Vazio nas fichas v2 antigas (sem backfill). */
  eventos: EventoView[];
  /** R-108 — nome do tratamento gravado no banco. `null` = usa o derivado (nomeTratamentoDerivado),
   *  nunca mostrado vazio (§4.3). */
  nome: string | null;
  /** R-108 — evolução por visita (migration 141). Todas as fichas têm ≥1 pelo backfill. */
  evolucoes: FichaEvolucao[];
}

type FichaDB = {
  id: string;
  created_at: string;
  data_atendimento: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  status: string;
  dentista_id: string;
  dentista?: { nome: string; cro: string | null } | null;
  procedimentos_concluidos: string[];
  procedimentos_status: Record<string, ProcStatus> | null;
  procedimentos: string[] | null;
  conduta: string | null;
  assinatura_url: string | null;
  assinado_em: string | null;
  tratamento_id: string | null;
  orto_manutencao: OrtoManutencaoInfo | null;
  /** R-108 — nullable: fichas existentes nasceram sem nome, leitura cai no derivado. */
  nome: string | null;
};

/** R-129e — snapshot estreito do que a edição de uma ficha pode alterar. Ele não inclui
 * estado visual (dente aberto, filtros, cards expandidos), para que uma interação de leitura
 * nunca habilite "Salvar alterações" por engano. */
type EstadoEditavelFicha = {
  formData: {
    dataAtendimento: string;
    type: string;
    observation: string;
    teethNotes: ToothNote[];
    procedimentos: string[];
    conduta: string;
    ortoManutencao: OrtoManutencaoInfo | null;
  };
  selectedTeeth: number[];
  sharedTeeth: number[];
  sharedNotes: string[];
  eventosDraft: OdontogramaEventoDraft[];
};

/** Contador legível, por área clínica alterada — não tenta contar cada caractere digitado. */
function contarAlteracoesFicha(inicial: EstadoEditavelFicha, atual: EstadoEditavelFicha): number {
  const campos: Array<keyof EstadoEditavelFicha> = [
    'formData', 'selectedTeeth', 'sharedTeeth', 'sharedNotes', 'eventosDraft',
  ];
  return campos.reduce(
    (total, campo) => total + (JSON.stringify(inicial[campo]) === JSON.stringify(atual[campo]) ? 0 : 1),
    0,
  );
}

/**
 * Exibição da data (§7.1): se `data_atendimento` cai no mesmo dia do `created_at`
 * (fuso da clínica), mantém `DD/MM/AAAA às HH:MM`; se é retroativa, só a data —
 * hora falsa (meia-noite) mentiria. Formata `data_atendimento` na mão (não via
 * `new Date()`) pra não sofrer o shift de fuso de um 'YYYY-MM-DD' parseado como UTC.
 */
/** Hoje no fuso da clínica, ISO 'YYYY-MM-DD' — default e teto do campo de data (invariante #5). */
function hojeBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * R-05b (D2) — janela do atalho "+ Manutenção". Manutenção orto é ~mensal; 4 meses absorve
 * férias/falta sem ressuscitar tratamento já encerrado. Não existe alta nem fim de tratamento
 * em `fichas`, e criar essa marcação geraria dado morto (o dentista não marca) — a janela erra
 * barato dos dois lados: some cedo = o botão do R-05 continua lá; some tarde = botão sem clique.
 */
const JANELA_ORTO_DIAS = 120;

/** 'YYYY-MM-DD' → 'DD/MM/YYYY'. Sem `new Date()`: um 'YYYY-MM-DD' é parseado como UTC e
 *  volta um dia atrás no fuso da clínica (mesmo cuidado do formatarDataFicha). */
const dataBR = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const mapFichaToEvolution = (f: FichaDB): Evolution => ({
  id: f.id,
  date: formatarDataFicha(f.data_atendimento, f.created_at),
  dataAtendimento: f.data_atendimento,
  type: f.queixa_principal ?? "Evolução",
  observation: f.anotacoes ?? "",
  teethNotes: (f.dentes_afetados ?? []).map((t) => {
    const raw = f.dentes_observacoes?.[String(t)] ?? "";
    const parts = raw.split('\n').filter(Boolean);
    return { tooth: t, notes: parts.length > 0 ? parts : [''] };
  }),
  professional: f.dentista?.nome ?? "Profissional",
  dentistaId: f.dentista_id,
  files: [],
  procedimentosConcluidos: f.procedimentos_concluidos ?? [],
  procedimentosStatus: (() => {
    if (f.procedimentos_status && Object.keys(f.procedimentos_status).length > 0) {
      return f.procedimentos_status;
    }
    // Migra modelo antigo: procedimentos_concluidos → concluido
    const s: Record<string, ProcStatus> = {};
    (f.procedimentos_concluidos ?? []).forEach((k) => { s[k] = 'concluido'; });
    return s;
  })(),
  procedimentos: f.procedimentos ?? [],
  conduta: f.conduta || null,
  assinaturaUrl: f.assinatura_url ?? null,
  assinadoEm: f.assinado_em ?? null,
  tratamentoId: f.tratamento_id ?? null,
  ortoManutencao: f.orto_manutencao ?? null,
  autorCro: f.dentista?.cro ?? null,
  eventos: [], // anexados em fetchFichas após buscar a tabela odontograma_eventos
  nome: f.nome,
  evolucoes: [], // anexadas em fetchFichas após buscar ficha_evolucoes
});

/**
 * Agrupa o RASCUNHO (OdontogramaEventoDraft[]) do mesmo jeito que a ficha salva — mesma
 * função (agruparRegistros), mesmo card-fonte (RegistroCard, R-02 I1). Adapta grupo_id
 * (snake_case no draft) pra grupoId antes de chamar; recupera os índices originais por id
 * pra atualizarObsGrupo/removerGrupoDraft/atualizarDetalheDraft continuarem mutando o
 * array certo. Autor/CRO: reaproveita de qualquer ficha já carregada deste dentista
 * (fallback: query em dentistas — ver useEffect de destinosDisponiveis).
 */
function draftsParaCards(
  eventosDraft: OdontogramaEventoDraft[], autorNome: string, autorCro: string | null,
): Array<{ key: string; idxs: number[]; data: RegistroCardData }> {
  const indicePorId = new Map(eventosDraft.map((ev, i) => [ev.id, i]));
  const adaptados = eventosDraft.map((ev) => ({ ...ev, grupoId: ev.grupo_id }));
  const agora = new Date().toISOString();
  return agruparRegistros(adaptados).map(({ chave, itens }) => {
    const primeiro = itens[0];
    return {
      key: chave,
      idxs: itens.map((it) => indicePorId.get(it.id)!),
      data: {
        tipo: primeiro.tipo,
        procedimentoNome: primeiro.procedimentoNome,
        status: primeiro.status,
        origem: primeiro.origem,
        momentoPlanejado: primeiro.momento_planejado,
        ancoras: itens.map((it) => it.ancora),
        observacao: primeiro.observacao,
        detalhe: primeiro.detalhe,
        realizadoEm: primeiro.realizado_em,
        // Draft ainda não foi "registrado" — timestamp de agora (spec R-02 Fase 1, ação 5).
        registradoEm: agora,
        autorNome,
        autorCro,
        assinada: false,
        encaminhadoPara: null, // rascunho nunca foi encaminhado
        revisarStatus: primeiro.revisar_status,
      },
    };
  });
}

/**
 * R-04b — corpo de especialidade pro DESTINO de um encaminhamento: form editável (reusa
 * corpoEspecialidadeEditavel) + botão "Salvar tabela" que grava no servidor pela RPC do destino.
 * Diferente do card comum (I2), aparece MESMO com detalhe vazio — é onde o destino começa a
 * preencher. A observação do autor já é mostrada read-only pelo próprio RegistroCard.
 */
function corpoEspecialidadeDestino(
  tipo: TipoRegistroOdontograma,
  valor: unknown,
  onChange: (v: unknown) => void,
  onSalvar: () => void,
  salvando: boolean,
): React.ReactNode {
  const form = corpoEspecialidadeEditavel(tipo, valor, onChange);
  if (!form) return null;
  return (
    <div className="flex flex-col gap-2">
      {form}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-surface bg-teal-ink hover:opacity-90 disabled:opacity-60 px-3 py-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal transition-opacity"
        >
          {salvando ? 'Salvando…' : 'Salvar tabela'}
        </button>
      </div>
    </div>
  );
}

/**
 * R-21 — render de uma lista de registros AGRUPADA por dente (agruparPorDente). Genérico sobre o
 * card de cada site (Site A tem idxs, Site B tem ids; os dois têm key + data). Dente com 1
 * procedimento renderiza o card direto; 2+ colapsa num DenteGrupoHeader controlado pelo Set de
 * abertos do chamador. "Vários dentes"/"Geral" nunca colapsam — rótulo de seção + cards diretos.
 * Só a apresentação: o renderCard de cada site vem de fora, intocado. `forcarAbertos` mantém tudo
 * expandido (Site B em modo seleção, pra nenhum encaminhável ficar escondido num grupo fechado).
 * `siteId` prefixa as chaves de ref/destaque (Fase 3) pra não colidir entre os dois sites.
 */
interface RenderSecoesOpts<T extends { key: string; data: RegistroCardData }> {
  secoes: SecaoRegistros<T>[];
  renderCard: (card: T) => React.ReactNode;
  dentesAbertos: Set<number>;
  onToggleDente: (dente: number) => void;
  registrarRefDente: (refKey: string, el: HTMLDivElement | null) => void;
  forcarAbertos: boolean;
  denteComTabela: number | null;
  tabelaRef: (el: HTMLElement | null) => void;
  siteId: string;
  denteDestacado: string | null;
}

function renderSecoesPorDente<T extends { key: string; data: RegistroCardData }>({
  secoes, renderCard, dentesAbertos, onToggleDente, registrarRefDente, forcarAbertos,
  denteComTabela, tabelaRef, siteId, denteDestacado,
}: RenderSecoesOpts<T>): React.ReactNode {
  // R-21 Fase 2 — slot do portal da tabela de especialidade DENTRO da seção do dente aberto no
  // painel (antes era faixa fixa abaixo do odontograma). O filho injetado pelo portal do
  // ToothDetailPanel entra com fade/slide leve. Só existe na seção que casa com denteComTabela;
  // fora disso o ToothDetailPanel cai no fallback inline (tabelaContainer null).
  const tabelaSlot = (dente: number) =>
    dente === denteComTabela ? (
      <div
        key="tabela-slot"
        ref={tabelaRef}
        className="empty:hidden [&>*]:animate-in [&>*]:fade-in [&>*]:slide-in-from-top-1 [&>*]:duration-200"
      />
    ) : null;

  return secoes.map((secao) => {
    if (secao.tipo === 'dente') {
      const { dente, cards } = secao;
      const refKey = `${siteId}:${dente}`;
      // wrapper em flex-col gap-2: no dente solo, espaça o card do slot da tabela igual ao grupo.
      // ring quando denteDestacado casa (Fase 3 — clique no odontograma acende a seção por 1,6s).
      return (
        <div
          key={`dente-${dente}`}
          ref={(el) => registrarRefDente(refKey, el)}
          className={`flex flex-col gap-2 ${denteDestacado === refKey ? 'rounded-xl ring-2 ring-teal ring-offset-2 ring-offset-background transition-shadow duration-300' : ''}`}
        >
          {cards.length === 1 ? (
            <>
              {renderCard(cards[0])}
              {tabelaSlot(dente)}
            </>
          ) : (
            <DenteGrupoHeader
              dente={dente}
              total={cards.length}
              aFazer={cards.filter((c) => c.data.status === 'indicado').length}
              aberto={forcarAbertos || dentesAbertos.has(dente)}
              onToggle={() => onToggleDente(dente)}
            >
              {cards.map(renderCard)}
              {tabelaSlot(dente)}
            </DenteGrupoHeader>
          )}
        </div>
      );
    }
    return (
      <div key={secao.tipo} className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary px-1 pt-1">
          {secao.tipo === 'multi' ? 'Vários dentes' : 'Geral'}
        </p>
        {secao.cards.map(renderCard)}
      </div>
    );
  });
}

/** EventoView (salvo) -> Draft: o shape que Odontograma/ToothDetailPanel consomem. */
function eventoViewParaDraft(e: EventoView): OdontogramaEventoDraft {
  return {
    id: e.id, // já existe no banco — o draft de EDIÇÃO reusa o id, nunca gera outro (R-01)
    tipo: e.tipo, procedimentoId: e.procedimentoId, procedimentoNome: e.procedimentoNome,
    status: e.status, origem: e.origem, momento_planejado: e.momentoPlanejado, ancora: e.ancora,
    grupo_id: e.grupoId, papel_no_grupo: e.papelNoGrupo, observacao: e.observacao ?? '',
    detalhe: e.detalhe, realizado_em: e.realizadoEm,
    registrado_em: e.registradoEm, created_at: e.createdAt,
    assinaturaId: e.assinaturaId, // R-30 Parte 2 — dedup nunca colapsa evento assinado
    encaminhadoParaId: e.encaminhadoPara?.id,
    fonteFluxo: 'planejado',
  };
}

/**
 * R-30 Parte 3 — une duas notas do mesmo dente em vez de uma substituir a outra: derivada
 * primeiro, texto do formulário depois, sem duplicar linha idêntica.
 */
function unirObservacoes(derivada: string, doFormulario: string): string {
  const linhas = [...derivada.split('\n'), ...doFormulario.split('\n')]
    .map((l) => l.trim())
    .filter(Boolean);
  return [...new Set(linhas)].join('\n');
}

// Ficha enlatada do perfil demo (K · spec 3.3) — coerente com o seed da consulta demo (João Silva, dente 46).
// `dentistaId` fica de fora: é injetado no uso com o dentista real logado, pra a demo continuar
// editável (professional: 'Você'). Sem isso ela cairia no caminho de "ficha de outro dentista".
const DEMO_EVOLUTION: Omit<Evolution, 'dentistaId'> = {
  id: 'demo-ficha',
  date: new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).replace(',', ' às'),
  dataAtendimento: hojeBRT(),
  type: 'Dor ao mastigar no lado direito inferior',
  observation:
    'Paciente relata dor à mastigação no lado inferior direito há cerca de duas semanas, ' +
    'com sensibilidade ao frio. Sem histórico de trauma. Higiene satisfatória.',
  teethNotes: [{ tooth: 46, notes: ['Restauração antiga com infiltração', 'Sensibilidade ao frio'] }],
  professional: 'Você',
  files: [],
  procedimentosConcluidos: [],
  procedimentosStatus: { 'Restauração de compósito (dente 46)': 'nao_iniciado', 'Profilaxia': 'nao_iniciado' },
  procedimentos: ['Restauração de compósito (dente 46)', 'Profilaxia'],
  conduta: 'Substituir a restauração do dente 46 e realizar profilaxia. Reavaliar sensibilidade em 30 dias.',
  assinaturaUrl: null,
  assinadoEm: null,
  tratamentoId: null,
  ortoManutencao: null,
  autorCro: null,
  eventos: [],
  nome: null,
  evolucoes: [],
};

interface FichasTabProps {
  patientId: string;
  clinicaId: string;
  dentistaId: string;
  plano?: PlanoId;
  patientName?: string;
  canWrite?: boolean;
  /** #6 — abre o modal de orçamento no pai, já mirado nesta ficha. */
  onGerarOrcamento?: (fichaId: string) => void;
  /** R-107b — catálogo do dentista, repassado pros `ToothDetailPanel` daqui (busca livre do
   *  painel do dente). Ausente = a busca casa só os tipos estruturais, sem catálogo. */
  catalogoProcedimentos?: MeuDiaCatalogoProcedimento[];
  /** R-140c: tratamento a abrir ao entrar pelo prontuário longitudinal. */
  initialFichaId?: string;
  /** R-140c: leitura e edição são entradas exclusivas; leitura nunca abre formulário vazio. */
  initialIntent?: 'ler' | 'editar';
  /** R-140c: retorna ao prontuário sem alterar a lógica do editor legado. */
  onVoltarAoProntuario?: () => void;
  /** R-140c v8: usa somente o compositor compatível, sem reexibir a antiga lista de Fichas. */
  modoEditorEmbutido?: boolean;
}

export function FichasTab({
  patientId,
  clinicaId,
  dentistaId,
  patientName,
  canWrite = true,
  onGerarOrcamento,
  catalogoProcedimentos,
  initialFichaId,
  initialIntent = 'ler',
  onVoltarAoProntuario,
  modoEditorEmbutido = false,
}: FichasTabProps) {
  // O histórico é da CLÍNICA (todo dentista lê), o trabalho é do AUTOR (só ele escreve) —
  // migration 099. `canWrite` cobre papel/plano; a autoria é uma segunda condição, não a
  // mesma. Esconder o controle é conveniência: quem barra de verdade é a RLS (invariante #9).
  const podeEditarFicha = React.useCallback(
    (evo: Evolution) => canWrite && evo.dentistaId === dentistaId,
    [canWrite, dentistaId],
  );

  const [evolutions, setEvolutions] = React.useState<Evolution[]>([]);
  const fichaInicialAbertaRef = React.useRef<string | null>(null);
  // R-46c — colar histórico do Word, mesmo dialog do Meu dia.
  const [colarAberto, setColarAberto] = React.useState(false);
  // R-04b — rascunho do detalhe que o DESTINO está preenchendo (chave = key do card = id do evento;
  // endo/implante nunca agrupam) + qual card está salvando no momento.
  const [detalheRascunho, setDetalheRascunho] = React.useState<Record<string, unknown>>({});
  const [salvandoDetalheKey, setSalvandoDetalheKey] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  // R-30 Parte 5 — fail-closed: se odontograma_eventos falhar ao carregar, toda ficha
  // recebia eventos:[] em silêncio; editar e salvar apagava por omissão o que já existia
  // (a RPC delete-by-omission trata "não veio no payload" como "apague"). Bloqueia editar/
  // salvar enquanto isto for true, em vez de arriscar apagar dado clínico.
  const [eventosFalharamAoCarregar, setEventosFalharamAoCarregar] = React.useState(false);
  // R-59 Parte 4 — mesmo espírito da Parte 5 do R-30 acima, agora pro caso de falha ao
  // SALVAR (não carregar): a ficha grava, mas a RPC de eventos falha. Sem isto o painel
  // fechava e o rascunho sumia como se tivesse dado certo — só um toast fácil de perder
  // avisava. Mantém o painel aberto com o rascunho intacto pra permitir retry.
  const [eventosFalharamAoSalvar, setEventosFalharamAoSalvar] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = React.useState<EstadoEditavelFicha | null>(null);
  const [fichaParaReabrirAposSave, setFichaParaReabrirAposSave] = React.useState<string | null>(null);
  const scrollAntesDeEditarRef = React.useRef<number | null>(null);
  const [selectedTeeth, setSelectedTeeth] = React.useState<number[]>([]);
  const [sharedTeeth, setSharedTeeth] = React.useState<number[]>([]);
  const [sharedNotes, setSharedNotes] = React.useState<string[]>(['']);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  /**
   * R-122 — seleção de ações rápidas, estado próprio e separado do `selectedTeeth`.
   *
   * Não reusa `selectedTeeth` de propósito, e isso é o oposto do que eu tinha suposto antes de
   * ler o código. Três motivos, cada um verificado aqui:
   * 1. `selectedTeeth` pode carregar **sentinela de região** (91–99, de fichas legadas). Passar isso pro
   *    lote criaria evento ancorado no "dente 97" — que o odontograma não desenha e o
   *    `derivarV2DosEventos` não emite.
   * 2. Editar ficha legada **pré-carrega** `selectedTeeth` com os dentes da ficha antiga. A faixa
   *    nasceria já cheia, e um clique de chip lançaria procedimento em N dentes que o dentista
   *    nunca selecionou.
   * 3. `selectedTeeth` é fonte de escrita de `dentes_afetados`. Reusar juntaria de novo os dois
   *    trilhos exatamente onde o R-109 quer separá-los.
   *
   * Mesmo modelo do Meu dia: tocar seleciona; a faixa de ações decide o que criar.
   */
  const [dentesLote, setDentesLote] = React.useState<number[]>([]);
  const [escopoRegional, setEscopoRegional] = React.useState<EscopoRegional | null>(null);
  const [modoLancamento, setModoLancamento] = React.useState<ModoLancamento>('a_fazer');
  const complementosDetailsRef = React.useRef<HTMLDetailsElement>(null);

  // R-35 item 2 — conta orçamentos/pagamentos que a ficha leva junto (ON DELETE CASCADE)
  // antes de deixar confirmar, em vez de apagar em silêncio.
  const [vinculosFicha, setVinculosFicha] = React.useState<VinculosFicha | null>(null);
  const [vinculosLoading, setVinculosLoading] = React.useState(false);
  const [exclusaoConfirmada, setExclusaoConfirmada] = React.useState(false);
  const [signingTarget, setSigningTarget] = React.useState<SigningTarget | null>(null);
  const [assinadoPorInput, setAssinadoPorInput] = React.useState('');
  const [orientacoesAssinatura, setOrientacoesAssinatura] = React.useState('');
  const [isSavingSignature, setIsSavingSignature] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadLib | null>(null);

  // ── Modo de visualização da ficha ─────────────────────────────────────────
  const [viewingEvo, setViewingEvo] = React.useState<Evolution | null>(null);

  // ── R-16: filtro por responsável ──────────────────────────────────────────
  // Display puro: esconde os cards cujo responsável (encaminhado_para ?? autor)
  // não bate. Nunca escreve, nunca vaza pro PDF (server-side). null = Todos ·
  // 'me' = Meus · senão um dentista.id.
  const [filtroResponsavel, setFiltroResponsavel] = React.useState<string | null>(null);

  // ── R-04 Fase 3 / R-03b: modo seleção (encaminhar OU assinar em lote), escopado à
  // CONSULTA aberta. Só uma consulta em modo por vez, e só um tipo por vez (não dá pra
  // selecionar pra encaminhar e assinar ao mesmo tempo na mesma ficha — mesma restrição de
  // "só uma consulta em modo" já valia antes). selecionados = chaves de card (grupo);
  // destino = 1 dentista pro lote inteiro (só faz sentido em modoSelecaoTipo='encaminhar').
  const [modoSelecaoFichaId, setModoSelecaoFichaId] = React.useState<string | null>(null);
  const [modoSelecaoTipo, setModoSelecaoTipo] = React.useState<'encaminhar' | 'assinar' | null>(null);
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set());
  const [destinoEncaminhar, setDestinoEncaminhar] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    dataAtendimento: hojeBRT(),
    type: "Evolução",
    observation: "",
    teethNotes: [] as ToothNote[],
    procedimentos: [] as string[],
    conduta: "",
    ortoManutencao: null as OrtoManutencaoInfo | null,
  } as { dataAtendimento: string; type: string; observation: string; teethNotes: ToothNote[]; procedimentos: string[]; conduta: string; ortoManutencao: OrtoManutencaoInfo | null });

  // Eventos de odontograma propostos pelo "Organizar com Dex" (camada 2). Só o campo
  // mágico os preenche na ficha rápida; persistem no save via `salvarFicha` (R-11), que
  // reusa a mesma RPC atômica da consulta por baixo. Vazio = save não toca a tabela de
  // eventos (edição sem reorganizar preserva os eventos existentes — no-opa em lista vazia).
  const [eventosDraft, setEventosDraft] = React.useState<OdontogramaEventoDraft[]>([]);
  const [capturaDex, setCapturaDex] = React.useState<CapturaDexState>({
    fase: 'idle', busy: false, impedeSalvar: false, audioParaRetry: false,
  });

  const estadoEditavelAtual = React.useMemo<EstadoEditavelFicha>(() => ({
    formData,
    selectedTeeth,
    sharedTeeth,
    sharedNotes,
    eventosDraft,
  }), [eventosDraft, formData, selectedTeeth, sharedNotes, sharedTeeth]);
  const alteracoesPendentes = React.useMemo(
    () => editingSnapshot ? contarAlteracoesFicha(editingSnapshot, estadoEditavelAtual) : 0,
    [editingSnapshot, estadoEditavelAtual],
  );
  const temAlteracoesPendentes = editingId !== null && alteracoesPendentes > 0;

  React.useEffect(() => {
    if (!temAlteracoesPendentes) return;
    const avisarSaida = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avisarSaida);
    return () => window.removeEventListener('beforeunload', avisarSaida);
  }, [temAlteracoesPendentes]);

  React.useEffect(() => {
    if (!fichaParaReabrirAposSave) return;
    const ficha = evolutions.find((evo) => evo.id === fichaParaReabrirAposSave);
    if (!ficha) return;
    setViewingEvo(ficha);
    setFichaParaReabrirAposSave(null);
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`ficha-${ficha.id}`);
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (scrollAntesDeEditarRef.current != null) {
        window.scrollTo({ top: scrollAntesDeEditarRef.current, behavior: 'smooth' });
      }
      scrollAntesDeEditarRef.current = null;
    });
  }, [evolutions, fichaParaReabrirAposSave]);

  // R-47 (achado 6, 31/07) — alerta_novo detectado pelo Organizar com Dex nesta sessão.
  // null = nada detectado agora, omite do payload do save; o servidor preserva o que já
  // estava salvo em vez de sobrescrever com null (era o bug: reeditar apagava o alerta real).
  const [alertaNovoDetectado, setAlertaNovoDetectado] = React.useState<string | null>(null);

  // R-05b (D3) — origem do bloco orto quando veio do atalho. Quem salva assina, então o autor
  // e a data da manutenção herdada aparecem ANTES do save, não depois. null = digitado agora.
  const [ortoHerdadaDe, setOrtoHerdadaDe] = React.useState<{ data: string; autorNome: string } | null>(null);

  // Camada 1: dente aberto no painel de revisão do odontograma (rascunho do Dex).
  const [denteAberto, setDenteAberto] = React.useState<number | null>(null);
  /** R-130 — pedido transitório consumido pelo ToothDetailPanel ao abrir a ponte. */
  const [iniciarPonteDente, setIniciarPonteDente] = React.useState<number | null>(null);
  // R-20 Fase 2 — destino da tabela de especialidade (endo/implante) abaixo do bloco, full-width.
  // Um por site (criação vs. ficha salva), já que cada um tem seu OdontogramaComPainel.
  const [tabelaElA, setTabelaElA] = React.useState<HTMLElement | null>(null);

  // Perfil do dente na ficha SALVA (readOnly) — um por vez, preso à ficha dona.
  const [denteSalvoAberto, setDenteSalvoAberto] = React.useState<{ fichaId: string; dente: number } | null>(null);
  const [tabelaElB, setTabelaElB] = React.useState<HTMLElement | null>(null);
  // G11 — tocar um dente rola até o card do registro correspondente e destaca (some sozinho).
  const registroCardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const [grupoDestacado, setGrupoDestacado] = React.useState<string | null>(null);

  // R-21 — dentes com grupo ABERTO na lista (2+ procedimentos). Site A (rascunho) e Site B
  // (ficha salva) têm sets separados; dentesAbertosB reseta ao trocar de ficha (só uma
  // expandida por vez — mesmo padrão de denteSalvoAberto em alternarExpansaoFicha).
  const [dentesAbertosA, setDentesAbertosA] = React.useState<Set<number>>(new Set());
  const [dentesAbertosB, setDentesAbertosB] = React.useState<Set<number>>(new Set());
  // R-21 — um ref por SEÇÃO de dente (solo ou colapsável), pra clicar o dente no odontograma abrir
  // o grupo e rolar até ele (Fase 3). Chave = `${siteId}:${dente}` (siteId='A' no rascunho, evo.id
  // na ficha salva) — desambigua quando o mesmo dente aparece nos dois sites ao mesmo tempo.
  const denteGrupoRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const registrarRefDente = React.useCallback((refKey: string, el: HTMLDivElement | null) => {
    if (el) denteGrupoRefs.current.set(refKey, el);
    else denteGrupoRefs.current.delete(refKey);
  }, []);
  // Seção de dente acesa por 1,6s ao clicar o dente no odontograma (Fase 3). Chave = `${siteId}:${dente}`.
  const [denteDestacado, setDenteDestacado] = React.useState<string | null>(null);
  const toggleDenteA = React.useCallback((dente: number) => {
    setDentesAbertosA((prev) => {
      const next = new Set(prev);
      if (next.has(dente)) next.delete(dente); else next.add(dente);
      return next;
    });
  }, []);
  const toggleDenteB = React.useCallback((dente: number) => {
    setDentesAbertosB((prev) => {
      const next = new Set(prev);
      if (next.has(dente)) next.delete(dente); else next.add(dente);
      return next;
    });
  }, []);
  // Dente aberto na FICHA SALVA (leitura) — estado separado do de criação, sempre readOnly.
  // (R-02 Fase 1: grupoDetalheAberto/setGrupoDetalheAberto removidos — o "aberto" agora é
  // interno de cada RegistroCard; múltiplos cards podem abrir ao mesmo tempo, igual à leitura.)

  // ── R-02 Fase 1: autor do card do RASCUNHO ──────────────────────────────────────
  // Reaproveita nome/CRO de qualquer ficha já carregada deste dentistaId (barato, já
  // está em memória); só cai pro fallback de query se este dentista ainda não tem
  // nenhuma ficha lida nesta sessão (mesmo padrão da busca de destinosDisponiveis).
  const autorDeEvolutions = React.useMemo(
    () => evolutions.find((e) => e.dentistaId === dentistaId) ?? null,
    [evolutions, dentistaId],
  );
  const [autorFallback, setAutorFallback] = React.useState<{ nome: string; cro: string | null } | null>(null);
  React.useEffect(() => {
    if (autorDeEvolutions || !dentistaId || patientId === 'demo') return;
    const supabase = createClient();
    supabase.from('dentistas').select('nome, cro').eq('id', dentistaId).maybeSingle()
      .then(({ data }) => { if (data) setAutorFallback({ nome: data.nome as string, cro: (data.cro as string | null) ?? null }); });
  }, [autorDeEvolutions, dentistaId, patientId]);
  const autorNomeDraft = autorDeEvolutions?.professional ?? autorFallback?.nome ?? 'Você';
  const autorCroDraft = autorDeEvolutions?.autorCro ?? autorFallback?.cro ?? null;

  /**
   * R-02 Fase 1: card do rascunho e card salvo vêm do MESMO componente-fonte (I1) — os
   * dois passam por agruparRegistros (I2). draftsParaCards adapta OdontogramaEventoDraft[]
   * pro mesmo formato { key, data: RegistroCardData } que eventosParaCards já produz pra
   * ficha salva; idxs substitui ids (mutação é local, por índice, não por chamada ao banco).
   */
  const cardsDraft = React.useMemo(
    () => draftsParaCards(eventosDraft, autorNomeDraft, autorCroDraft),
    [eventosDraft, autorNomeDraft, autorCroDraft],
  );

  /**
   * G11 — abre o painel do dente (como sempre) E rola até o card do registro correspondente,
   * destacando por 1,6s. Não abre tabela nenhuma sozinho — só direciona a atenção (P1: o
   * corpo da especialidade só aparece se o usuário tocar "Detalhes" em uma das duas entradas).
   */
  // R-20 Fase 3 — destaque compartilhado: rola até o card e acende por 1,6s. Uma função só
  // pro rascunho (Site A) E pra ficha salva (Site B) — antes só o Site A tinha isso.
  const destacarCard = React.useCallback((key: string) => {
    registroCardRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setGrupoDestacado(key);
    window.setTimeout(() => setGrupoDestacado((cur) => (cur === key ? null : cur)), 1600);
  }, []);

  // R-21 Fase 3 — clicar o dente no odontograma ABRE a seção dele na lista e rola até ela (acende
  // por 1,6s). Se o dente só existe num card multi-dente (sem seção própria), cai no fallback do
  // R-20: realça esse card na seção "Vários dentes" via destacarCard/registroCardRefs (preservado).
  const destacarDente = React.useCallback((
    dente: number,
    siteId: string,
    setDentesAbertos: React.Dispatch<React.SetStateAction<Set<number>>>,
    cards: Array<{ key: string; data: RegistroCardData }>,
  ) => {
    const temSecaoPropria = agruparPorDente(cards).some((s) => s.tipo === 'dente' && s.dente === dente);
    if (!temSecaoPropria) {
      const cardMulti = cards.find((c) => {
        const dentes = new Set(c.data.ancoras.map((a) => a.dente).filter((d): d is number => d != null));
        return dentes.size >= 2 && dentes.has(dente);
      });
      if (cardMulti) destacarCard(cardMulti.key);
      return;
    }
    const refKey = `${siteId}:${dente}`;
    // Abre a seção ANTES de rolar (senão scrollIntoView mede a altura errada com o acordeão fechado).
    setDentesAbertos((prev) => (prev.has(dente) ? prev : new Set(prev).add(dente)));
    setDenteDestacado(refKey);
    window.setTimeout(() => setDenteDestacado((cur) => (cur === refKey ? null : cur)), 1600);
    // Espera 1 frame pro acordeão assentar antes de medir/rolar (risco documentado na spec §Fase 3).
    requestAnimationFrame(() => {
      denteGrupoRefs.current.get(refKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [destacarCard]);

  /** R-122 — tocar no mapa só seleciona/desseleciona para as ações rápidas. Nunca abre
   * histórico ou perfil sozinho e nunca altera a seleção legada da ficha. */
  const selecionarDenteParaAcoes = React.useCallback((dente: number) => {
    setEscopoRegional(null);
    setDentesLote((prev) => (prev.includes(dente) ? prev.filter((item) => item !== dente) : [...prev, dente]));
  }, []);

  /** Único gesto explícito que abre o perfil dental na criação. */
  const abrirDetalheDental = React.useCallback((dente: number) => {
    setDenteAberto(dente);
    setIniciarPonteDente(null);
    destacarDente(dente, 'A', setDentesAbertosA, cardsDraft);
  }, [cardsDraft, destacarDente]);

  const iniciarPonte = React.useCallback((dente: number) => {
    setDenteAberto(dente);
    setIniciarPonteDente(dente);
    destacarDente(dente, 'A', setDentesAbertosA, cardsDraft);
  }, [cardsDraft, destacarDente]);

  /** Observação por procedimento (§03 do definitivo) — aplica a todo o grupo. */
  const atualizarObsGrupo = (idxs: number[], obs: string) => {
    setEventosDraft((prev) => prev.map((ev, i) => (idxs.includes(i) ? { ...ev, observacao: obs } : ev)));
  };

  /** Remove o registro (grupo inteiro) do rascunho antes de salvar. */
  const removerGrupoDraft = (idxs: number[]) => {
    setEventosDraft((prev) => prev.filter((_, i) => !idxs.includes(i)));
  };

  /** Atualiza o `detalhe` (tabela de especialidade) de UM evento do rascunho por índice. */
  const atualizarDetalheDraft = (idx: number, detalhe: unknown) => {
    setEventosDraft((prev) => prev.map((ev, i) => (i === idx ? { ...ev, detalhe } : ev)));
  };

  /**
   * R-02 Fase 1: alterna planejado ⇄ realizado no RASCUNHO — flip local, sem chamada ao
   * servidor (só grava no save). O card salvo usa toggleStatusRegistro (RPC); este é o
   * equivalente pro card ainda não persistido.
   */
  const toggleStatusDraft = (idxs: number[]) => {
    setEventosDraft((prev) => prev.map((ev, i) => (idxs.includes(i)
      ? { ...ev, status: ev.status === 'realizado' ? 'indicado' : 'realizado' }
      : ev)));
  };

  /** R-101 — irmã de toggleStatusDraft. Rascunho ainda não foi salvo — sem chamada ao servidor. */
  const toggleMomentoDraft = (idxs: number[]) => {
    setEventosDraft((prev) => prev.map((ev, i) => (idxs.includes(i)
      ? { ...ev, momento_planejado: ev.momento_planejado === 'proxima_sessao' ? 'sessao_atual' : 'proxima_sessao' }
      : ev)));
  };

  // R-21 — render de UM card do rascunho (Site A). Extraído do .map anterior sem mudança: mesma
  // ref (registroCardRefs), mesmo realce (grupoDestacado), mesmo RegistroCard editável. Agora é
  // chamado por dente (direto se solo, dentro do grupo se 2+) via renderSecoesPorDente.
  const renderCardDraft = (card: { key: string; idxs: number[]; data: RegistroCardData }) => {
    const { key, idxs, data } = card;
    // Só registro de UM evento tem tabela de especialidade — grupo multi-dente não tem "o"
    // detalhe pra editar (mesma regra do ToothDetailPanel).
    const temDetalhe = idxs.length === 1
      && (data.tipo === 'endodontia' || data.tipo === 'implante' || data.tipo === 'exame_periodontal');
    const destacado = grupoDestacado === key;
    return (
      <div
        key={key}
        ref={(el) => {
          if (el) registroCardRefs.current.set(key, el);
          else registroCardRefs.current.delete(key);
        }}
        className={destacado ? 'rounded-xl ring-2 ring-teal ring-offset-2 ring-offset-background transition-shadow duration-300' : ''}
      >
        <RegistroCard
          data={data}
          editavel
          onObservacaoChange={(v) => atualizarObsGrupo(idxs, v)}
          onRemover={() => removerGrupoDraft(idxs)}
          onToggleStatus={() => toggleStatusDraft(idxs)}
          onToggleMomento={() => toggleMomentoDraft(idxs)}
        >
          {temDetalhe
            ? corpoEspecialidadeEditavel(
                data.tipo,
                data.detalhe,
                (v) => atualizarDetalheDraft(idxs[0], v),
                eventosDraft[idxs[0]]?.endo_revisao?.duvidas,
              )
            : undefined}
        </RegistroCard>
      </div>
    );
  };

  // Busca fichas do Supabase
  const fetchFichas = React.useCallback(async () => {
    // Perfil demo: ficha enlatada, sem tocar no banco (K · spec 3.3).
    if (patientId === 'demo') {
      setEvolutions([{ ...DEMO_EVOLUTION, dentistaId }]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("fichas")
        .select("id, created_at, data_atendimento, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, procedimentos_status, procedimentos, conduta, assinatura_url, assinado_em, tratamento_id, orto_manutencao, nome, dentista_id, dentista:dentistas(nome, cro)")
        .eq("paciente_id", patientId)
        .eq("clinica_id", clinicaId)
        .order("data_atendimento", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const fichas = (data as unknown as FichaDB[]).map(mapFichaToEvolution);

      // Camada 2: eventos do odontograma (event-log) agrupados por ficha. Fichas v2
      // antigas não têm eventos → recebem [] e seguem no display legado (fonte híbrida).
      const { data: evData, error: evError } = await supabase
        .from("odontograma_eventos")
        .select("id, ficha_id, grupo_id, papel_no_grupo, tipo, procedimento_id, procedimento_nome, status, origem, momento_planejado, nivel, arcada, quadrante, dente, faces, observacao, detalhe, realizado_em, registrado_em, created_at, encaminhado_para, encaminhado_dentista:dentistas!odontograma_eventos_encaminhado_para_fkey(id, nome), assinatura_id")
        .eq("paciente_id", patientId)
        .eq("clinica_id", clinicaId);

      // R-30 Parte 5 — fail-closed: falha na busca de eventos NUNCA pode ficar silenciosa.
      // Já esteve (bug real desta sessão): erro engolido = camada 2 sempre vazia, sem sinal
      // nenhum de que algo quebrou — editar e salvar apagaria eventos reais por omissão.
      if (evError) {
        console.error("Erro ao buscar odontograma_eventos:", evError);
        setEventosFalharamAoCarregar(true);
      } else {
        setEventosFalharamAoCarregar(false);
      }

      const eventosPorFicha = new Map<string, EventoView[]>();
      for (const e of (evData ?? []) as unknown as EventoRow[]) {
        if (!e.ficha_id) continue;
        // Reconstrói a âncora a partir das colunas achatadas (espelha montarRowsEventos).
        const ancora: AncoraClinica = {
          nivel: e.nivel,
          ...(e.arcada != null && { arcada: e.arcada }),
          ...(e.quadrante != null && { quadrante: e.quadrante as AncoraClinica['quadrante'] }),
          ...(e.dente != null && { dente: e.dente }),
          ...(e.faces && e.faces.length > 0 && { faces: e.faces }),
        };
        const view: EventoView = {
          id: e.id, grupoId: e.grupo_id, papelNoGrupo: e.papel_no_grupo ?? null,
          tipo: e.tipo, procedimentoId: e.procedimento_id, procedimentoNome: e.procedimento_nome,
          status: e.status,
          origem: e.origem, momentoPlanejado: e.momento_planejado, ancora, observacao: e.observacao ?? null,
          realizadoEm: e.realizado_em, registradoEm: e.registrado_em, createdAt: e.created_at,
          detalhe: e.detalhe ?? null,
          encaminhadoPara: e.encaminhado_para ? (e.encaminhado_dentista ?? null) : null,
          assinaturaId: e.assinatura_id ?? null,
        };
        const arr = eventosPorFicha.get(e.ficha_id);
        if (arr) arr.push(view); else eventosPorFicha.set(e.ficha_id, [view]);
      }

      // R-108 — evolução por visita (migration 141). Toda ficha tem ≥1 pelo backfill; falha
      // aqui não é fail-closed como odontograma_eventos (não é dado de escrita/orçamento) —
      // degrada pra timeline vazia, mesmo padrão de "erro engolido só quando é seguro".
      const { data: evoData, error: evoError } = await supabase
        .from("ficha_evolucoes")
        .select("id, ficha_id, dentista_id, data, texto, automatica, dentista:dentistas(nome)")
        .eq("clinica_id", clinicaId)
        .in("ficha_id", (data as unknown as FichaDB[]).map((f) => f.id));

      if (evoError) console.error("Erro ao buscar ficha_evolucoes:", evoError);

      const evolucoesPorFicha = new Map<string, FichaEvolucao[]>();
      for (const e of (evoData ?? []) as unknown as {
        id: string; ficha_id: string; dentista_id: string; data: string; texto: string | null;
        automatica: boolean; dentista: { nome: string } | null;
      }[]) {
        const view: FichaEvolucao = {
          id: e.id, fichaId: e.ficha_id, dentistaId: e.dentista_id,
          dentistaNome: e.dentista?.nome ?? "Profissional",
          data: e.data, texto: e.texto, automatica: e.automatica,
        };
        const arr = evolucoesPorFicha.get(e.ficha_id);
        if (arr) arr.push(view); else evolucoesPorFicha.set(e.ficha_id, [view]);
      }
      // Mais recente primeiro — mesma ordem da timeline do artefato (blocos 1-6).
      for (const arr of evolucoesPorFicha.values()) arr.sort((a, b) => (a.data < b.data ? 1 : -1));

      const proximasEvolucoes = fichas.map((f) => ({
        ...f,
        eventos: eventosPorFicha.get(f.id) ?? [],
        evolucoes: evolucoesPorFicha.get(f.id) ?? [],
      }));
      setEvolutions(proximasEvolucoes);

      if (initialIntent === 'ler' && initialFichaId && fichaInicialAbertaRef.current !== initialFichaId) {
        const fichaInicial = proximasEvolucoes.find((ficha) => ficha.id === initialFichaId);
        if (fichaInicial) {
          fichaInicialAbertaRef.current = initialFichaId;
          setViewingEvo(fichaInicial);
          setIsPanelOpen(false);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar fichas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, clinicaId, dentistaId, initialFichaId, initialIntent]);

  React.useEffect(() => {
    if (patientId && clinicaId) {
      void fetchFichas();
    }
  }, [patientId, clinicaId, fetchFichas]);

  // Destinos elegíveis pra encaminhar (R-04): dentistas ativos da clínica, exceto
  // secretária e o próprio autor. Mesmo filtro de agendamentos/page.tsx. Busca 1x —
  // não muda durante a sessão da ficha.
  const [destinosDisponiveis, setDestinosDisponiveis] = React.useState<{ id: string; nome: string }[]>([]);
  React.useEffect(() => {
    if (!clinicaId || patientId === 'demo') return;
    const supabase = createClient();
    supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' virar destino
      // de encaminhamento clínico; ele não atende paciente.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .neq('id', dentistaId)
      .order('nome', { ascending: true })
      .then(({ data }) => setDestinosDisponiveis(data ?? []));
  }, [clinicaId, dentistaId, patientId]);

  // ── R-16: filtro por responsável (lógica pura em lib/fichas/filtro-responsavel) ──
  // Responsável de um registro = encaminhado_para ?? autor da ficha. Todo evento de
  // um grupo herda o mesmo destino (a action move o grupo inteiro), então filtrar
  // evento a evento nunca parte um card. Ficha na ótica do filtro = { autor, eventos }.
  const fichasResp = React.useMemo(
    () => evolutions.map((evo) => ({ autorId: evo.dentistaId, autorNome: evo.professional, eventos: evo.eventos })),
    [evolutions],
  );

  // Responsáveis distintos → chips. Solo (< 2) não renderiza a barra (sem chrome).
  const responsaveis = React.useMemo(() => derivarResponsaveis(fichasResp), [fichasResp]);

  // ── R-02 Fase 3: trabalhos abertos do paciente (deriva dos eventos JÁ salvos, sem fetch
  // novo — a busca de fichas acima já traz grupo_id/tipo/dente/status). Alimenta a
  // confirmação de amarração no ToothDetailPanel de criação.
  const gruposAbertos = React.useMemo(
    () =>
      agregarGruposAbertos(
        evolutions.flatMap((e) => e.eventos).map((ev) => ({
          grupo_id: ev.grupoId,
          tipo: ev.tipo,
          dente: ev.ancora.dente ?? null,
          status: ev.status,
          registrado_em: ev.registradoEm,
        })),
      ),
    [evolutions],
  );

  // ── R-05b: última manutenção ortodôntica dentro da janela, pro atalho "+ Manutenção".
  // Deriva de `evolutions` (o fetch já traz orto_manutencao de TODAS as fichas do paciente, já
  // ordenado por data_atendimento desc) — zero query nova, mesmo padrão do gruposAbertos acima.
  // D2: janela de 120 dias — não existe alta/fim de tratamento no schema, e criar essa marcação
  // geraria dado morto (o dentista não marca). D3: herda de qualquer autor da clínica, com autor
  // e data visíveis antes do save — a lista já inclui fichas de toda a clínica por RLS, então
  // isso é decisão explícita, não consequência acidental.
  const ultimaOrto = React.useMemo(() => {
    // 'YYYY-MM-DD' compara lexicograficamente — sem date lib e sem o shift de fuso que
    // `new Date('YYYY-MM-DD')` (parseado como UTC) introduziria, mesmo motivo do hojeBRT.
    const limite = new Date(Date.now() - JANELA_ORTO_DIAS * 864e5)
      .toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    for (const e of evolutions) {
      if (!e.ortoManutencao) continue;
      if (e.dataAtendimento < limite) return null; // desc: a 1ª fora da janela encerra a busca
      return { valor: e.ortoManutencao, data: e.dataAtendimento, autorNome: e.professional };
    }
    return null;
  }, [evolutions]);

  // R-18 (achado na auditoria 24/07): reseta pra "Todos" assim que o responsável
  // selecionado deixa de existir — sem isto o filtro travava preso num id inválido
  // e a tela ficava vazia sem nenhum controle pra voltar (ver filtroAindaValido).
  React.useEffect(() => {
    if (!filtroAindaValido(filtroResponsavel, responsaveis, dentistaId)) {
      setFiltroResponsavel(null);
    }
  }, [responsaveis, filtroResponsavel, dentistaId]);

  // Eventos de uma ficha que sobrevivem ao filtro — mantém contador, odontograma e
  // cards no MESMO conjunto (senão o header mente numa ficha mista). A assinatura
  // NÃO usa isto: cobre o estado real da ficha, não a visão filtrada.
  const eventosFiltrados = React.useCallback(
    (evo: Evolution) => eventosVisiveis(evo.eventos, evo.dentistaId, filtroResponsavel, dentistaId),
    [filtroResponsavel, dentistaId],
  );

  // Fichas visíveis: some da timeline quando nenhum registro seu passa o filtro (#8).
  // Também some a ficha em edição — o painel de edição já é essa ficha inteira, aberta no
  // topo; manter o card de leitura embaixo mostrava a mesma ficha duas vezes na tela ao
  // mesmo tempo (achado relatado 30/07). Card volta assim que salvar ou cancelar.
  const evolutionsVisiveis = React.useMemo(
    () => evolutions.filter((evo) =>
      evo.id !== editingId &&
      fichaVisivel({ autorId: evo.dentistaId, autorNome: evo.professional, eventos: evo.eventos }, filtroResponsavel, dentistaId),
    ),
    [evolutions, filtroResponsavel, dentistaId, editingId],
  );

  // ── R-04 Fase 3 / R-03b: ficha em modo seleção + seus cards elegíveis VISÍVEIS ──
  // Encaminhável = indicado · autor = eu · ficha (legado) não assinada · não já encaminhado.
  // Assinável = realizado · autor = eu · ainda não assinado (por REGISTRO, não por ficha —
  // R-03b). Sobre os visíveis (compõe com o filtro do R-16: seleciona só o que se vê).
  const fichaEmModo = React.useMemo(
    () => evolutions.find((e) => e.id === modoSelecaoFichaId) ?? null,
    [evolutions, modoSelecaoFichaId],
  );
  const cardsSelecionaveis = React.useMemo(() => {
    if (!fichaEmModo || !podeEditarFicha(fichaEmModo) || !modoSelecaoTipo) return [];
    const cards = eventosParaCards(eventosFiltrados(fichaEmModo), fichaEmModo.professional, fichaEmModo.autorCro);
    if (modoSelecaoTipo === 'encaminhar') {
      if (fichaEmModo.assinadoEm) return [];
      return cards
        .filter((c) => c.data.status === 'indicado' && !c.data.encaminhadoPara)
        .map((c) => ({ key: c.key, ids: c.ids }));
    }
    return cards
      .filter((c) => c.data.status === 'realizado' && !c.data.assinada)
      .map((c) => ({ key: c.key, ids: c.ids }));
  }, [fichaEmModo, podeEditarFicha, eventosFiltrados, modoSelecaoTipo]);
  // Selecionados que ainda são elegíveis válidos (uma key pode virar órfã se o filtro
  // esconder o card) — é o que a barra conta e o confirmar envia.
  const idsSelecionados = React.useMemo(
    () => cardsSelecionaveis.filter((c) => selecionados.has(c.key)),
    [cardsSelecionaveis, selecionados],
  );


  // Dentes mencionados em fichas anteriores — usados pelo odontograma premium
  const historicalTeeth = React.useMemo(() => {
    const set = new Set<number>();
    evolutions.forEach((e) =>
      e.teethNotes.forEach((tn) => {
        if (tn.tooth < 90) set.add(tn.tooth); // exclui constantes de arcada (97,98,99)
      })
    );
    return set;
  }, [evolutions]);



  /**
   * R-109 — o que o odontograma PINTA: união do trilho legado com o lote. União, não troca:
   * trocar faria a pintura da ficha legada sumir ao ligar o modo, e faria o lote deixar de ser
   * visível assim que a faixa desliga o modo (ela desliga ao aplicar, mas a seleção continua —
   * mesmo comportamento do Meu dia, onde `onde` segue pintado depois de aplicar).
   *
   * O anel de seleção é desenhado independente de `state`/`clinico` (C5/P13 do `Odontograma`),
   * então continua aparecendo mesmo com o rascunho já cheio de eventos.
   */
  const dentesPintados = React.useMemo(
    () => (dentesLote.length > 0 ? [...new Set([...selectedTeeth, ...dentesLote])] : selectedTeeth),
    [selectedTeeth, dentesLote],
  );

  /** "✕ limpar" da faixa — esvazia somente a seleção, nunca o rascunho já criado. */
  const limparLote = React.useCallback(() => {
    setDentesLote([]);
    setEscopoRegional(null);
  }, []);

  const selecionarEscopoRegional = React.useCallback((escopo: EscopoRegional | null) => {
    setDentesLote([]);
    setDenteAberto(null);
    setEscopoRegional(escopo);
  }, []);

  // Job A Fatia B (§5) — form já preenchido pede confirmação antes do "Organizar"
  // sobrescrever (o CapturaLivreCard checa isto ANTES de disparar formatar-evolucao).
  const formDirty = Boolean(
    formData.observation.trim() ||
    selectedTeeth.length > 0 ||
    sharedTeeth.length > 0 ||
    formData.procedimentos.length > 0 ||
    formData.conduta.trim() ||
    // R-05b: sem isto, o form aberto pelo atalho é considerado limpo e o guard de saída
    // o descarta em silêncio — o bloco orto herdado É conteúdo.
    normalizarOrtoManutencao(formData.ortoManutencao) != null ||
    // R-47 (achado 2, 31/07) — lançamento manual no odontograma (clique no dente, chip de
    // rotina) não passava por nenhum campo acima: o Organizar sobrescrevia sem confirmar.
    eventosDraft.length > 0
  );

  // Mapeamento IA → form (§5): "Organizar com Dex" preenche o form existente — o
  // form É a tela de revisão (invariante #8), nada entra na ficha sem passar por ele.
  // Dentes preenchidos = dentes SELECIONADOS; o dentista remove o que não confirma
  // (mesmo princípio da auto-confirmação do consulta, invertido pro idioma do form).
  const complementarEndoNaFicha = async (relato: string, dentes: number[]) => {
    if (dentes.length === 0) return;
    try {
      const resposta = await fetch('/api/dex/extrair-especialidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialidade: 'endodontia', texto: relato, contexto: { dentes } }),
      });
      const data = await resposta.json() as { ok: boolean; itens?: Array<{ dente: number; detalhe: EndoDetalhe }> };
      if (!resposta.ok || !data.ok || !data.itens?.length) return;

      const porDente = new Map(data.itens.map((item) => [item.dente, item.detalhe]));
      setEventosDraft((prev) => prev.map((evento) => {
        if (evento.tipo !== 'endodontia' || evento.ancora.dente == null) return evento;
        const recebido = porDente.get(evento.ancora.dente);
        if (!recebido) return evento;
        const mesclado = mesclarDetalheEndo(
          (evento.detalhe ?? null) as EndoDetalhe | null,
          recebido,
          evento.endo_revisao,
          'ia',
        );
        return { ...evento, detalhe: mesclado.detalhe, endo_revisao: mesclado.revisao };
      }));
      const primeiroDente = data.itens[0]?.dente;
      if (primeiroDente != null) setDenteAberto(primeiroDente);
    } catch (error) {
      console.warn('[ficha] complemento endodôntico indisponível:', error);
    }
  };

  const aplicarEvolucaoDoOrganizar = (data: EvolucaoFormatada, relato: string) => {
    setFormData((f) => ({
      ...f,
      type: data.queixa_principal || f.type,
      observation: data.alerta_novo
        ? `${data.anotacoes}\n\n⚠️ Novo alerta detectado: ${data.alerta_novo}`
        : data.anotacoes,
      teethNotes: data.dentes_afetados.map((t) => {
        const raw = data.dentes_observacoes[String(t)] ?? '';
        const parts = raw.split('\n').filter(Boolean);
        return { tooth: t, notes: parts.length > 0 ? parts : [''] };
      }),
      procedimentos: data.procedimentos,
      conduta: data.conduta,
      ortoManutencao: data.orto_manutencao,
    }));
    // R-47 (achado 6, 31/07) — só grava no campo estruturado; a linha de observation acima
    // segue mostrando o aviso em texto também (não removida — é o que já era visível).
    // Verificação adversarial 31/07: `data.alerta_novo` vazio numa 2ª chamada do Organizar
    // (sem repetir o alerta) não pode apagar o que a 1ª já detectou nesta sessão — só
    // atualiza quando vem algo novo, nunca limpa por omissão (mesmo princípio do achado 6).
    if (data.alerta_novo) setAlertaNovoDetectado(data.alerta_novo);
    // Camada 2: os eventos viram rascunho, com realizado_em pela mesma regra da consulta
    // (§1.10, invariante #13: só realizado+clínica ganha a data; IA nunca preenche data).
    // R-47 (achado 1, 31/07) + R-46d D0 (extraído pra src/lib/, mesmo comportamento) —
    // `mesclarEventosSemPerda` nunca deixa o que já existe perder pra uma reextração: se a
    // chave já está no draft atual, o novo é ignorado (reextrair algo já lançado é no-op).
    // Trade-off aceito e documentado: se o Dex extrai o MESMO procedimento com status
    // diferente (ex.: indicado → realizado), a chave muda (status entra na chave) e os dois
    // convivem como cards visíveis — duplicata visível antes de salvar, não perda silenciosa.
    const eventosBase = mesclarEventosSemPerda(eventosDraft, data.odontograma_eventos ?? [], formData.dataAtendimento);
    const dentesEndo = eventosBase
      .filter((evento) => evento.tipo === 'endodontia' && evento.ancora.dente != null)
      .map((evento) => evento.ancora.dente as number);
    const extracaoEndo = extrairEndoDeterministico(relato, dentesEndo);
    const porDente = new Map(extracaoEndo.ok ? extracaoEndo.extracoes.map((extracao) => [extracao.dente, extracao]) : []);
    const comDetalhe = eventosBase.map((evento) => {
      if (evento.tipo !== 'endodontia' || evento.ancora.dente == null || evento.detalhe != null) return evento;
      const extracao = porDente.get(evento.ancora.dente);
      return extracao
        ? { ...evento, detalhe: extracao.detalhe, endo_revisao: { origemPorCampo: extracao.origemPorCampo, duvidas: extracao.duvidas } }
        : evento;
    });
    setEventosDraft(comDetalhe);
    const primeiroComDetalhe = comDetalhe.find((evento) => evento.tipo === 'endodontia' && evento.ancora.dente != null && evento.detalhe != null);
    if (primeiroComDetalhe?.ancora.dente != null) setDenteAberto(primeiroComDetalhe.ancora.dente);
    // Mesmo critério do handleEdit (linha 666): sentinela de arcada entre os dentes
    // afetados põe o modo em 'arch' — mantém os botões de seleção coerentes com o
    // que a IA de fato preencheu.
    setSharedTeeth([]);
    setSharedNotes(['']);
    setSelectedTeeth(data.dentes_afetados);
    void complementarEndoNaFicha(relato, dentesEndo);
  };

  /**
   * Alterna planejado ⇄ realizado de um registro da ficha SALVA (bug 21/07: não havia
   * caminho pra marcar o que foi feito). Otimista com rollback — a RLS/action barra o
   * não-autor e a ficha assinada, e aí a UI volta ao estado real (invariante #9: update
   * barrado por RLS volta sucesso com 0 linhas, então nunca confiamos sem confirmação).
   */
  const toggleStatusRegistro = async (
    evo: Evolution, ids: string[], statusAtual: StatusRegistro,
  ) => {
    const novoStatus: StatusRegistro = statusAtual === 'realizado' ? 'indicado' : 'realizado';
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id)
        ? { ...ev, status: novoStatus, realizadoEm: novoStatus === 'realizado' ? hojeBRT() : null }
        : ev),
    }));

    const res = await alternarStatusRegistro({ eventoIds: ids, novoStatus });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível atualizar o registro.');
    }
  };

  /** R-101 — irmã de toggleStatusRegistro, mesmo padrão otimista+rollback. */
  const toggleMomentoRegistro = async (
    evo: Evolution, ids: string[], momentoAtual: MomentoPlanejado,
  ) => {
    const novoMomento: MomentoPlanejado = momentoAtual === 'proxima_sessao' ? 'sessao_atual' : 'proxima_sessao';
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id) ? { ...ev, momentoPlanejado: novoMomento } : ev),
    }));

    const res = await alternarMomentoRegistro({ eventoIds: ids, novoMomento });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível atualizar o registro.');
    }
  };

  /**
   * Autor encaminha (ou remove o encaminhamento de) um registro planejado seu a outro
   * dentista da clínica (R-04). Otimista com rollback — mesmo padrão de toggleStatusRegistro.
   */
  const encaminharRegistro = async (
    evo: Evolution, ids: string[], dentistaDestinoId: string | null,
  ) => {
    const destino = dentistaDestinoId
      ? destinosDisponiveis.find((d) => d.id === dentistaDestinoId) ?? null
      : null;
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id) ? { ...ev, encaminhadoPara: destino } : ev),
    }));

    const res = await encaminharProcedimento({ eventoIds: ids, dentistaDestinoId });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível encaminhar o registro.');
    }
  };

  // ── R-04 Fase 3 / R-03b: handlers do modo seleção (lote na consulta aberta) ──
  const sairModoSelecao = React.useCallback(() => {
    setModoSelecaoFichaId(null);
    setModoSelecaoTipo(null);
    setSelecionados(new Set());
    setDestinoEncaminhar(null);
  }, []);
  const ligarModoSelecao = (fichaId: string, tipo: 'encaminhar' | 'assinar') => {
    setSelecionados(new Set());
    setDestinoEncaminhar(null);
    setModoSelecaoTipo(tipo);
    setModoSelecaoFichaId(fichaId);
  };
  const toggleSelecao = (key: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  /** Confirma o lote: união dos ids selecionados → 1 destino → 1 chamada batch. */
  const confirmarEncaminhamentoLote = async () => {
    if (!fichaEmModo || destinoEncaminhar == null) return;
    const ids = idsSelecionados.flatMap((c) => c.ids);
    if (ids.length === 0) return;
    const evo = fichaEmModo;
    const destino = destinoEncaminhar;
    sairModoSelecao();
    await encaminharRegistro(evo, ids, destino);
  };
  /**
   * R-03b — sai do modo seleção e abre o pad de assinatura pro subconjunto escolhido.
   * Quem grava é handleSaveSignature (signingTarget.kind === 'subset'), não esta função —
   * ela só decide QUAIS ids entram no lote.
   */
  const confirmarAssinaturaLote = () => {
    if (!fichaEmModo) return;
    const ids = idsSelecionados.flatMap((c) => c.ids);
    if (ids.length === 0) return;
    const orientacoes = fichaEmModo.conduta?.trim() || fichaEmModo.observation.trim();
    const fichaId = fichaEmModo.id;
    sairModoSelecao();
    setAssinadoPorInput(patientName ?? '');
    setOrientacoesAssinatura(orientacoes);
    setSigningTarget({ kind: 'subset', fichaId, eventoIds: ids, pacienteId: patientId });
  };
  /** Abre/fecha a consulta. Colapsar a que está em modo seleção sai do modo (a barra
   *  não pode ficar órfã sem os cards na tela). */
  const alternarExpansaoFicha = (evo: Evolution) => {
    setDenteSalvoAberto(null);
    setDentesAbertosB(new Set()); // R-21 — grupos abertos são por ficha; troca de ficha zera
    const vaiColapsar = viewingEvo?.id === evo.id;
    if (vaiColapsar && modoSelecaoFichaId === evo.id) sairModoSelecao();
    setViewingEvo(vaiColapsar ? null : evo);
  };

  /**
   * DESTINO alterna indicado ⇄ realizado de um registro encaminhado a ele (R-04, Fase 4).
   * Mesmo padrão otimista de toggleStatusRegistro, mas via a RPC estreita do destino
   * (concluir_evento_encaminhado) — nunca toca detalhe/tipo/âncora/autoria.
   */
  const concluirEncaminhado = async (
    evo: Evolution, ids: string[], statusAtual: StatusRegistro,
  ) => {
    const novoStatus: StatusRegistro = statusAtual === 'realizado' ? 'indicado' : 'realizado';
    const realizadoEm = novoStatus === 'realizado' ? hojeBRT() : null;
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id)
        ? { ...ev, status: novoStatus, realizadoEm }
        : ev),
    }));

    const res = await atualizarStatusEncaminhado({ eventoIds: ids, novoStatus });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível atualizar o registro.');
    }
  };

  /**
   * R-04b — DESTINO salva o detalhe (tabela clínica) que preencheu. Otimista com rollback, mesmo
   * padrão de concluirEncaminhado, via a RPC estreita preencher_detalhe_encaminhado (só `detalhe`,
   * nunca a observação do autor). key = id do card = id do evento (endo/implante nunca agrupam).
   */
  const salvarDetalheEncaminhado = async (evo: Evolution, ids: string[], key: string) => {
    const detalhe = detalheRascunho[key];
    if (detalhe === undefined) return; // nada editado ainda
    setSalvandoDetalheKey(key);
    const antes = evolutions;
    setEvolutions((prev) => prev.map((e) => e.id !== evo.id ? e : {
      ...e,
      eventos: e.eventos.map((ev) => ids.includes(ev.id) ? { ...ev, detalhe } : ev),
    }));

    const res = await preencherDetalheEncaminhado({ eventoId: ids[0], detalhe });
    if (!res.ok) {
      setEvolutions(antes);
      toast.error(res.error ?? 'Não foi possível salvar a tabela.');
    } else {
      setDetalheRascunho((r) => { const n = { ...r }; delete n[key]; return n; });
      toast.success('Tabela salva.');
    }
    setSalvandoDetalheKey(null);
  };

  const handleSave = async () => {
    if (capturaDex.impedeSalvar) {
      toast.error(capturaDex.audioParaRetry
        ? 'Há um áudio aguardando transcrição. Tente novamente ou descarte o áudio antes de salvar.'
        : 'A captura do Dex ainda está em andamento. Aguarde antes de salvar.');
      return;
    }
    // R-30 Parte 5 — fail-closed: editar ficha existente sem os eventos reais carregados
    // apagaria tudo por omissão no save. Ficha nova (sem editingId) não tem nada a perder.
    if (editingId && eventosFalharamAoCarregar) {
      toast.error('Não foi possível carregar os registros do odontograma. Recarregue a página antes de salvar — salvar agora apagaria dado clínico já salvo.');
      return;
    }
    setIsSaving(true);

    try {
      const validSharedNotes = sharedNotes.filter((n) => n.trim()).join('\n');

      // R-30 Parte 2 — colapsa duplicata ANTES de derivar, pra derivado/payload concordarem.
      const eventosParaSalvar = dedupEventosDraft(eventosDraft);

      // Design definitivo (21/07): o lançamento manual virou EVENTO (perfil do dente).
      // Derivamos os campos v2 pra que orçamento / PDF / progresso continuem alimentados.
      const derivado = derivarV2DosEventos(eventosParaSalvar);

      // União: seleção de região (sentinelas de arcada/quadrante) + dentes dos eventos.
      const dentesAfetados = [...new Set([...selectedTeeth, ...sharedTeeth, ...derivado.dentes])];

      // R-30 Parte 3 — por dente, o valor final é a UNIÃO das fontes (derivada dos eventos +
      // texto do formulário), nunca uma sobrescrevendo a outra. Antes, o form apagava a nota
      // derivada do mesmo dente (achado real: dente 15 tinha 2 eventos e sobrava 1 linha).
      const dentesObservacoes: Record<string, string> = { ...derivado.observacoes };

      for (const tn of formData.teethNotes) {
        const doForm = tn.notes.filter((n) => n.trim()).join('\n');
        if (!doForm) continue;
        const key = String(tn.tooth);
        dentesObservacoes[key] = dentesObservacoes[key]
          ? unirObservacoes(dentesObservacoes[key], doForm)
          : doForm;
      }

      if (validSharedNotes) {
        for (const t of sharedTeeth) {
          const key = String(t);
          dentesObservacoes[key] = dentesObservacoes[key]
            ? unirObservacoes(dentesObservacoes[key], validSharedNotes)
            : validSharedNotes;
        }
      }

      // Procedimentos: os do form primeiro; a derivação só acrescenta o que faltou.
      const procedimentosFinais = [
        ...formData.procedimentos,
        ...derivado.procedimentos.filter((p) => !formData.procedimentos.includes(p)),
      ];

      // R-11 — contrato único (create+update, eventos inclusos): origem NUNCA entra no
      // update (invariante #9); data_atendimento é editável (o dentista pode corrigir na
      // edição). Lista de eventos vazia (edição sem reorganizar) = no-op, preserva.
      const result = await salvarFicha({
        ...(editingId && { fichaId: editingId }),
        pacienteId:         patientId,
        origem:             'manual',
        dataAtendimento:    formData.dataAtendimento,
        queixaPrincipal:    formData.type,
        anotacoes:          formData.observation,
        dentesAfetados,
        dentesObservacoes,
        procedimentos:      procedimentosFinais,
        conduta:            formData.conduta,
        // R-47 (achado 6) — só manda a chave se o Organizar detectou algo NESTA sessão;
        // omitir preserva o que já estava salvo (fix espelhado em salvar-ficha.ts).
        ...(alertaNovoDetectado !== null && { alertaNovo: alertaNovoDetectado }),
        ortoManutencao:     normalizarOrtoManutencao(formData.ortoManutencao),
        odontogramaEventos: eventosParaSalvar,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.eventosFalharam) {
        // R-59 Parte 4 — painel fica aberto, rascunho intacto: fechar aqui apagaria da tela
        // o que a RPC não conseguiu gravar, como se tivesse dado certo (I4).
        setEventosFalharamAoSalvar(true);
        toast.error("A ficha salvou, mas o odontograma não foi gravado. Tente salvar de novo.");
        await fetchFichas();
        return;
      }
      setEventosFalharamAoSalvar(false);

      const fichaSalvaId = editingId;
      if (fichaSalvaId) setFichaParaReabrirAposSave(fichaSalvaId);
      await fetchFichas();
      closePanel(true);
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
      toast.error("Erro ao salvar a ficha. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * R-03b — 3 caminhos por trás de 1 diálogo: 'legado' é o antigo (ficha sem evento,
   * fichas.assinado_em, inalterado); 'todos'/'subset' são o granular do R-03a — só muda
   * quem resolve os eventoIds (servidor no gesto padrão, client quando veio da AssinarBar).
   */
  const handleSaveSignature = async () => {
    if (!signingTarget || !signaturePadRef.current) return;
    if (signaturePadRef.current.isEmpty()) {
      toast.error('Nenhuma assinatura detectada. Por favor assine antes de confirmar.');
      return;
    }
    if (signingTarget.kind !== 'legado' && assinadoPorInput.trim().length < 2) {
      toast.error('Informe o nome de quem está assinando.');
      return;
    }
    if (signingTarget.kind !== 'legado' && orientacoesAssinatura.trim().length < 3) {
      toast.error('Registre as orientações entregues ao paciente.');
      return;
    }

    setIsSavingSignature(true);
    try {
      const dataUrl = signaturePadRef.current.toDataURL('image/png');

      if (signingTarget.kind === 'legado') {
        const fichaId = signingTarget.fichaId;
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const supabase = createClient();
        const storagePath = `${clinicaId}/${patientId}/assinatura_${fichaId}.png`;

        const { error: storageErr } = await supabase.storage
          .from('fichas')
          .upload(storagePath, blob, { upsert: true, contentType: 'image/png' });
        if (storageErr) throw storageErr;

        const assinadoEm = new Date().toISOString();

        const { data: signed, error: dbErr } = await supabase
          .from('fichas')
          .update({ assinatura_url: storagePath, assinado_em: assinadoEm })
          .eq('id', fichaId)
          .eq('clinica_id', clinicaId)
          .select('id');
        if (dbErr) throw dbErr;
        // .select() vazio = RLS barrou (ficha de outro autor). O botão já é gated (defesa em
        // profundidade), mas se chegar aqui: remove o PNG órfão que subiu antes do update e
        // falha alto — nunca o "Assinatura salva com sucesso" falso (invariante #9).
        if (!signed?.length) {
          await supabase.storage.from('fichas').remove([storagePath]);
          toast.error('Só o dentista autor pode assinar esta ficha.');
          return;
        }

        setEvolutions((prev) =>
          prev.map((e) =>
            e.id === fichaId
              ? { ...e, assinaturaUrl: storagePath, assinadoEm: assinadoEm }
              : e
          )
        );
        setSigningTarget(null);
        toast.success('Assinatura salva com sucesso.');
        return;
      }

      // Granular (R-03a/b) — sempre passa pela RPC assinar_procedimentos (trigger de
      // imutabilidade no banco). Refetch em vez de merge otimista: o sucesso pode tocar
      // N eventos espalhados em cards diferentes, mais barato reler que reconciliar local.
      const res = signingTarget.kind === 'todos'
        ? await assinarTodosRealizadosDaFicha({
            fichaId: signingTarget.fichaId,
            pacienteId: signingTarget.pacienteId,
            assinadoPor: assinadoPorInput.trim(),
            assinaturaDataUrl: dataUrl,
            conclusao: { orientacoes: orientacoesAssinatura.trim() },
          })
        : await assinarProcedimentos({
            eventoIds: signingTarget.eventoIds,
            assinadoPor: assinadoPorInput.trim(),
            assinaturaDataUrl: dataUrl,
            conclusao: { orientacoes: orientacoesAssinatura.trim() },
          });

      if (!res.ok) {
        toast.error(res.error ?? 'Não foi possível registrar a assinatura.');
        return;
      }

      await fetchFichas();
      setSigningTarget(null);
      setOrientacoesAssinatura('');
      if (res.documentWarning) {
        toast.warning(`Assinatura salva. Documento pendente: ${res.documentWarning}`);
      } else {
        toast.success('Assinatura e documento salvos em Arquivos.');
      }
    } catch (err) {
      console.error('[assinatura] Erro ao salvar:', err);
      toast.error('Erro ao salvar assinatura. Tente novamente.');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const closePanel = (forcar = false) => {
    if (!forcar && temAlteracoesPendentes) {
      const confirmar = window.confirm('Descartar as alterações desta ficha? Elas ainda não foram salvas.');
      if (!confirmar) return;
    }
    setIsPanelOpen(false);
    setEditingId(null);
    setEditingSnapshot(null);
    setSelectedTeeth([]);
    limparLote(); // R-109 — seleção de lote não sobrevive ao fechamento do painel
    setSharedTeeth([]);
    setSharedNotes(['']);
    setFormData({ dataAtendimento: hojeBRT(), type: "Evolução", observation: "", teethNotes: [], procedimentos: [], conduta: "", ortoManutencao: null });
    setEventosDraft([]);
    setDenteAberto(null);
    setOrtoHerdadaDe(null);
    setAlertaNovoDetectado(null);
    setEventosFalharamAoSalvar(false);
  };

  const updateProcStatus = async (fichaId: string, currentStatus: Record<string, ProcStatus>, procKey: string, newStatus: ProcStatus) => {
    const updatedStatus = { ...currentStatus, [procKey]: newStatus };
    setEvolutions((prev) => prev.map((e) => e.id === fichaId ? { ...e, procedimentosStatus: updatedStatus } : e));
    setViewingEvo((prev) => prev?.id === fichaId ? { ...prev, procedimentosStatus: updatedStatus } : prev);
    const supabase = createClient();
    // .select() é obrigatório: a ficha agora é LIDA por toda a clínica mas só o autor
    // escreve (migration 099), e um UPDATE barrado por RLS não retorna erro — devolve
    // sucesso com 0 linhas. Sem isso a tela afirmaria o que o banco negou (invariante #9).
    const { data: afetadas, error } = await supabase
      .from('fichas')
      .update({ procedimentos_status: updatedStatus })
      .eq('id', fichaId)
      .eq('clinica_id', clinicaId)
      .select('id');
    if (error ?? !afetadas?.length) {
      console.error('[proc-status] recusado — revertendo', error);
      setEvolutions((prev) => prev.map((e) => e.id === fichaId ? { ...e, procedimentosStatus: currentStatus } : e));
      setViewingEvo((prev) => prev?.id === fichaId ? { ...prev, procedimentosStatus: currentStatus } : prev);
    }
  };

  const handleEdit = (evolution: Evolution) => {
    // R-30 Parte 5 — fail-closed: sem os eventos reais carregados, abrir pra editar e salvar
    // apagaria tudo que já existe (delete-by-omissão da RPC). Bloqueia até recarregar.
    if (eventosFalharamAoCarregar) {
      toast.error('Não foi possível carregar os registros do odontograma. Recarregue a página antes de editar — editar agora poderia apagar dado clínico já salvo.');
      return;
    }
    // Detecta grupo compartilhado: dentes com exatamente as mesmas notas (≥2 dentes)
    const realTeeth = evolution.teethNotes.filter((tn) => !(tn.tooth in ARCH_LABELS));
    const byNotes = new Map<string, number[]>();
    for (const tn of realTeeth) {
      const key = tn.notes.filter(Boolean).join('\n');
      if (key) byNotes.set(key, [...(byNotes.get(key) ?? []), tn.tooth]);
    }
    // Grupo com mais dentes (mín. 2) é o grupo compartilhado
    let detectedSharedGroup: { notes: string; teeth: number[] } | null = null;
    for (const [notes, teeth] of byNotes) {
      if (teeth.length > 1 && (!detectedSharedGroup || teeth.length > detectedSharedGroup.teeth.length)) {
        detectedSharedGroup = { notes, teeth };
      }
    }

    const sharedTeethSet = new Set(detectedSharedGroup?.teeth ?? []);
    const individualNotes = evolution.teethNotes.filter((tn) => !sharedTeethSet.has(tn.tooth));
    const proximosSharedTeeth = detectedSharedGroup?.teeth ?? [];
    const proximosSharedNotes = detectedSharedGroup ? detectedSharedGroup.notes.split('\n').filter(Boolean) : [''];
    const proximoFormData = {
      dataAtendimento: evolution.dataAtendimento,
      type: evolution.type,
      observation: evolution.observation,
      teethNotes: individualNotes.map((tn) => ({
        tooth: tn.tooth,
        notes: tn.notes.length > 0 ? [...tn.notes] : [''],
      })),
      procedimentos: evolution.procedimentos,
      conduta: evolution.conduta ?? '',
      ortoManutencao: evolution.ortoManutencao,
    };
    const proximosEventos = evolution.eventos.map(eventoViewParaDraft);
    const proximosDentesSelecionados = individualNotes.map((tn) => tn.tooth);
    scrollAntesDeEditarRef.current = window.scrollY;
    setSharedTeeth(proximosSharedTeeth);
    setSharedNotes(proximosSharedNotes);
    setEditingId(evolution.id);
    setEventosFalharamAoSalvar(false); // ficha diferente — resíduo da anterior não se aplica
    setOrtoHerdadaDe(null); // editar ficha salva: o orto é o dela, não herdado (R-05b)
    setAlertaNovoDetectado(null); // idem — nada detectado nesta sessão até reorganizar
    setFormData(proximoFormData);
    // Edição RECARREGA os eventos salvos como rascunho (mesmo id, via eventoViewParaDraft):
    // senão o registro do dente some ao editar e não dá pra mexer no canal/detalhe. Salvar
    // faz upsert por id (R-01), não duplica nem renumera. Bug achado 23/07.
    setEventosDraft(proximosEventos);
    setSelectedTeeth(proximosDentesSelecionados);
    setEditingSnapshot({
      formData: proximoFormData,
      selectedTeeth: proximosDentesSelecionados,
      sharedTeeth: proximosSharedTeeth,
      sharedNotes: proximosSharedNotes,
      eventosDraft: proximosEventos,
    });
    limparLote(); // R-109 — abrir outra ficha pra editar não herda o lote da anterior
    setIsPanelOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const iniciarEdicaoInicial = React.useEffectEvent((ficha: Evolution) => handleEdit(ficha));

  React.useEffect(() => {
    if (initialIntent !== 'editar' || !initialFichaId || fichaInicialAbertaRef.current === initialFichaId) return;
    const fichaInicial = evolutions.find((ficha) => ficha.id === initialFichaId);
    if (!fichaInicial) return;
    fichaInicialAbertaRef.current = initialFichaId;
    setViewingEvo(null);
    iniciarEdicaoInicial(fichaInicial);
  }, [evolutions, initialFichaId, initialIntent]);

  /** R-60 — manutenção nova abre limpa: copiar dados da consulta anterior cria ato clínico falso. */
  const abrirNovaComOrto = () => {
    if (!ultimaOrto) return;
    setEditingId(null);
    setEditingSnapshot(null);
    setSharedTeeth([]);
    setSharedNotes(['']);
    setSelectedTeeth([]);
    limparLote(); // R-109
    setEventosDraft([]);
    setAlertaNovoDetectado(null);
    setFormData({
      dataAtendimento: hojeBRT(),
      type: 'Evolução',
      observation: '',
      teethNotes: [],
      procedimentos: [],
      conduta: '',
      ortoManutencao: { ...ORTO_VAZIO },
    });
    setOrtoHerdadaDe(null);
    setIsPanelOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    try {
      if (!exclusaoConfirmada) return;
      const result = await deletarFicha(id, true);
      if (!result.ok) {
        toast.error(result.error ?? "Erro ao apagar ficha.");
        return;
      }
      setEvolutions((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
      toast.error("Erro ao apagar ficha. Tente novamente.");
    } finally {
      setShowDeleteConfirm(null);
      setVinculosFicha(null);
      setExclusaoConfirmada(false);
    }
  };

  if (isLoading) {
    return (
      <DexLoader className="p-20" />
    );
  }

  return (
    <div className="space-y-6">
      <ColarDoWordDialog
        pacienteId={patientId}
        pacienteNome={patientName ?? ''}
        open={colarAberto}
        onOpenChange={setColarAberto}
        onImportado={() => void fetchFichas()}
      />
      {/* R-30 Parte 5 — fail-closed visível: eventos não carregaram, edição bloqueada até
          recarregar. Sem isto o único sinal seria um toast que passou e ninguém viu. */}
      {eventosFalharamAoCarregar && (
        <div className="flex items-center gap-3 bg-coral/5 border border-coral/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-coral shrink-0" />
          <p className="text-sm font-medium text-coral">
            Não foi possível carregar o histórico do odontograma. Editar ou salvar fichas está
            bloqueado até recarregar a página, pra não apagar dado clínico já salvo.
          </p>
        </div>
      )}
      {/* R-111 — no celular o título e os botões empilham, e os botões quebram linha entre si.
          Medido em 14/08: os 3 botões somam 474px e nasciam a 98px da borda (depois do título),
          chegando a 571px numa faixa de 343px — 228px cortados, o maior corte do Prontuário.
          Eles têm `shrink-0` no `Button`, então não tinha como o `justify-between` acomodar. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {onVoltarAoProntuario && (
            <Button variant="ghost" size="sm" onClick={onVoltarAoProntuario}>
              Voltar ao prontuário
            </Button>
          )}
          <h2 className="font-heading text-2xl text-text-primary">
            {onVoltarAoProntuario
              ? `Prontuário / ${editingId ? 'Editar ficha' : (viewingEvo?.nome ?? 'Tratamento')}`
              : 'Histórico Clínico'}
          </h2>
        </div>
        {!isPanelOpen && canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {/* R-05b (D4) — atalho secundário: "Nova Evolução" segue o único CTA sólido teal.
                Só aparece com manutenção dentro da janela; fora dela o caminho do R-05 (botão
                dentro do form) continua intacto. */}
            {ultimaOrto && (
              <Button
                variant="outline"
                onClick={abrirNovaComOrto}
                title={`Abre uma evolução nova com a manutenção de ${dataBR(ultimaOrto.data)} pré-preenchida`}
                className="min-h-11 rounded-xl px-4 py-5 font-bold text-sm flex items-center gap-2 border-border text-text-secondary hover:text-teal hover:border-teal/50 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Manutenção
              </Button>
            )}
            {/* R-46c — colar/subir histórico do Word, mesmo dialog do Meu dia. */}
            <Button
              variant="outline"
              onClick={() => setColarAberto(true)}
              className="min-h-11 rounded-xl px-4 py-5 font-bold text-sm flex items-center gap-2 border-border text-text-secondary hover:text-teal hover:border-teal/50 transition-all active:scale-95"
            >
              <FileText className="w-4 h-4" />
              Colar do Word
            </Button>
            <Button
              onClick={() => setIsPanelOpen(true)}
              className="min-h-11 bg-teal hover:bg-teal-lt text-white rounded-xl px-6 py-5 font-bold text-sm flex items-center gap-2 shadow-[0_0_15px_rgba(47,156,133,0.3)] transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nova Evolução
            </Button>
          </div>
        )}
      </div>

      {/* R-16: filtro por responsável — só quando há ≥2 responsáveis distintos no paciente
          (ChipsResponsavel esconde sozinho quando solo). */}
      {!modoEditorEmbutido && (
        <ChipsResponsavel
          responsaveis={responsaveis}
          meuId={dentistaId}
          filtro={filtroResponsavel}
          onFiltroChange={setFiltroResponsavel}
        />
      )}

      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4">
            {/* ═══════ FICHA ÚNICA (design definitivo 21/07, feedback da 1ª rodada) ═══════
                UM organismo, não três balões: campo mágico → meta → odontograma (esq) +
                perfil do dente (dir) → registros agrupados → anotações/conduta → ações.
                Divisores sutis separam as zonas; nada de cards soltos competindo. */}
            <div className="bg-surface border border-border rounded-2xl p-4 md:p-6 flex flex-col gap-5">

              {/* R-122 — contexto do rascunho visível antes da captura. Não altera
                  tipo/data/autoria; só dá início claro à ficha. */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="font-heading text-xl text-text-primary">
                    {editingId ? 'Editando ficha clínica' : 'Nova ficha clínica'}
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {formData.type} · {dataBR(formData.dataAtendimento)} · {autorNomeDraft}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/5 px-2.5 py-1 text-[11px] font-bold text-teal-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" /> {editingId ? 'Edição' : 'Rascunho'}
                </span>
              </div>

              {/* R-129e — a edição histórica não pode terminar no rodapé de uma ficha longa.
                  A mesma action atômica continua sendo usada; a barra só a mantém no contexto. */}
              {editingId && (
                <div className="sticky top-3 z-20 flex flex-col gap-3 rounded-2xl border border-teal/30 bg-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary">Editando ficha de {dataBR(formData.dataAtendimento)}</p>
                    <p className="text-xs text-text-secondary" aria-live="polite">
                      {temAlteracoesPendentes
                        ? `${alteracoesPendentes} alteraç${alteracoesPendentes === 1 ? 'ão pendente' : 'ões pendentes'}`
                        : 'Nenhuma alteração'}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => closePanel()}
                      disabled={isSaving}
                      className="min-h-11 flex-1 rounded-xl border border-border px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary disabled:opacity-50 sm:flex-none"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={isSaving || !temAlteracoesPendentes || capturaDex.impedeSalvar}
                      className="min-h-11 flex-1 rounded-xl bg-teal px-4 text-sm font-bold text-white transition-colors hover:bg-teal-lt disabled:opacity-50 sm:flex-none"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>
              )}

              {/* Campo mágico (Job A Fatia B) — não renderiza no perfil demo (§8: sem clínica real). */}
              {patientId !== 'demo' && (
                <CapturaLivreCard
                  pacienteNome={patientName ?? ''}
                  formDirty={formDirty}
                  onOrganizado={aplicarEvolucaoDoOrganizar}
                  onCapturaStateChange={setCapturaDex}
                />
              )}

              {/* Meta — tipo + data, compactos no topo (artefato §02) */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Tipo de Registro
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  >
                    <option value="Avaliação">Avaliação</option>
                    <option value="Evolução">Evolução</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Urgência">Urgência</option>
                    <option value="Procedimento">Procedimento</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5 flex items-center">
                    Data do atendimento
                    <HelpTooltip content="Pode ser retroativa — útil pra lançar histórico de outro sistema. A ficha ordena por esta data, não pela data de digitação." />
                  </label>
                  <input
                    type="date"
                    value={formData.dataAtendimento}
                    max={hojeBRT()}
                    onChange={(e) => setFormData((f) => ({ ...f, dataAtendimento: e.target.value || hojeBRT() }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  />
                </div>
              </div>

              <div className="border-t border-border/60" />

              {/* R-122 — odontograma é uma bancada clínica própria: mapa, região e ações vivem
                  no mesmo contorno, em vez de parecerem campos soltos do formulário. */}
              <article className="overflow-hidden rounded-2xl border border-border bg-surface-alt/30">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div>
                    <h3 className="font-heading text-lg text-text-primary">Odontograma e região</h3>
                    <p className="mt-0.5 text-[11px] text-text-secondary">Clique para selecionar; as ações acompanham a seleção.</p>
                  </div>
                  {dentesLote.length > 0 && (
                    <span className="rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal-ink">
                      {dentesLote.length} selecionado{dentesLote.length > 1 ? 's' : ''}
                    </span>
                  )}
                </header>
                <div className="p-4">
              {/* R-20: odontograma + perfil do dente lado-a-lado — encolhe ao abrir um dente */}
              <OdontogramaComPainel
                odontograma={
                  <>
                    {/* R-30 Parte 7 (contrato 2) — edição sempre mostra TODOS os registros,
                        mesmo com filtro de responsável ativo na visualização (esconder
                        registro de colega na edição arrisca apagá-lo por omissão no save,
                        mesma classe de risco da Parte 5). Diferença fica explícita. */}
                    {filtroResponsavel !== null && (
                      <p className="text-[10px] text-text-secondary/70 -mb-1">
                        Editando: mostrando os registros de todos os dentistas, mesmo com o
                        filtro de responsável ativo na lista.
                      </p>
                    )}
                    <Odontograma
                      eventos={eventosDraft.length > 0 ? eventosDraft : undefined}
                      selectedTeeth={dentesPintados}
                      sharedTeeth={sharedTeeth}
                      historicalTeeth={editingId ? historicalTeeth : new Set<number>()}
                      onToothToggle={selecionarDenteParaAcoes}
                      hideFilters
                    />
                  </>
                }
                painel={
                  denteAberto != null ? (
                    <ToothDetailPanel
                      dente={denteAberto}
                      eventos={eventosDraft}
                      onChange={setEventosDraft}
                      onClose={() => { setDenteAberto(null); setIniciarPonteDente(null); }}
                      dataPadrao={formData.dataAtendimento}
                      iniciarPonte={iniciarPonteDente === denteAberto}
                      onPonteIniciada={() => setIniciarPonteDente(null)}
                      gruposAbertos={gruposAbertos}
                      tabelaContainer={tabelaElA}
                      catalogoProcedimentos={catalogoProcedimentos}
                      // R-30 Parte 7 (contrato 3) — mesmo estado que a arcada calcularia
                      // pra este dente, não mais 'default' fixo.
                      state={computeToothState(denteAberto, {
                        clinico: eventosDraft.length > 0,
                        sharedTeeth,
                        selectedTeeth: dentesPintados,
                        historicalTeeth: editingId ? historicalTeeth : new Set<number>(),
                      })}
                    />
                  ) : null
                }
              />

              <FaixaEscopoRegional
                escopo={escopoRegional}
                onEscopoChange={selecionarEscopoRegional}
                eventosDraft={eventosDraft}
                onEventosDraftChange={setEventosDraft}
                catalogoProcedimentos={catalogoProcedimentos ?? []}
                dataPadrao={formData.dataAtendimento}
                modoLancamento={modoLancamento}
                onModoLancamentoChange={setModoLancamento}
                manutencaoOrtodonticaAtiva={formData.ortoManutencao != null}
                onManutencaoOrtodontica={() => {
                  setFormData((atual) => ({
                    ...atual,
                    ortoManutencao: atual.ortoManutencao ?? { ...ORTO_VAZIO },
                  }));
                  if (complementosDetailsRef.current) {
                    complementosDetailsRef.current.open = true;
                    requestAnimationFrame(() => {
                      complementosDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    });
                  }
                }}
              />

              {/* R-122 — a mesma faixa do Meu Dia: seleção vale para 1+ dentes; detalhe dental
                  só abre pelo gesto explícito dentro dela. */}
              <FaixaLote
                dentes={dentesLote}
                eventosDraft={eventosDraft}
                onEventosDraftChange={setEventosDraft}
                catalogoProcedimentos={catalogoProcedimentos ?? []}
                dataPadrao={formData.dataAtendimento}
                modoLancamento={modoLancamento}
                onModoLancamentoChange={setModoLancamento}
                onLimpar={limparLote}
                onModoMultidenteChange={() => {}}
                onAbrirDetalheDental={abrirDetalheDental}
                onIniciarPonte={iniciarPonte}
              />
                </div>
              </article>
              {/* R-21 Fase 2: a tabela de especialidade (endo/implante) NÃO abre mais aqui — agora
                  monta DENTRO da seção do dente na lista (tabelaContainer via renderSecoesPorDente).
                  Fallback do ToothDetailPanel (tabelaContainer null) = inline no painel. */}

              <div className="border-t border-border/60" />

              {/* Registros — R-02 Fase 1: mesmo componente-fonte da ficha salva (RegistroCard,
                  I1). agruparRegistros (I2) já entrega abertos-primeiro (Fase 2). */}
              <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-alt/30 p-4">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="font-heading text-lg text-text-primary">Registros desta consulta</h3>
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {cardsDraft.length > 0 ? `${cardsDraft.length} registro${cardsDraft.length > 1 ? 's' : ''}` : 'nenhum ainda'}
                  </span>
                </div>

                {cardsDraft.length === 0 ? (
                  <div className="border border-dashed border-border rounded-2xl px-6 py-7 text-center">
                    <p className="font-heading text-base text-text-primary mb-1">Nenhum registro ainda</p>
                    <p className="text-xs text-text-secondary max-w-sm mx-auto">
                      Narre no campo mágico e toque &ldquo;Organizar&rdquo;, ou toque um dente no odontograma
                      para lançar à mão. Os registros aparecem aqui.
                    </p>
                  </div>
                ) : (
                  // R-21 — lista agrupada por dente (Site A). Solo = card direto; 2+ = grupo colapsável.
                  // Fase 2: a tabela do dente aberto (denteAberto) monta dentro da seção. Fase 3: clique
                  // no odontograma abre a seção e rola até ela (siteId 'A').
                  renderSecoesPorDente({
                    secoes: agruparPorDente(cardsDraft),
                    renderCard: renderCardDraft,
                    dentesAbertos: dentesAbertosA,
                    onToggleDente: toggleDenteA,
                    registrarRefDente,
                    forcarAbertos: false,
                    denteComTabela: denteAberto,
                    tabelaRef: setTabelaElA,
                    siteId: 'A',
                    denteDestacado,
                  })
                )}
              </article>
              <div className="border-t border-border/60" />
              {/* R-122 — secundários não disputam a primeira leitura da ficha. Os campos e a
                  persistência são os mesmos; só entram progressivamente quando o dentista
                  precisa deles ou quando já há conteúdo. */}
              <section className="flex flex-col gap-3">
                <div className="px-1">
                  <h3 className="font-heading text-lg text-text-primary">Complementos da ficha</h3>
                  <p className="mt-0.5 text-[11px] text-text-secondary">Só abra o que precisar nesta consulta.</p>
                </div>
              <details
                ref={complementosDetailsRef}
                className="group rounded-2xl border border-border bg-surface"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left marker:content-none">
                  <span>
                    <span className="block font-semibold text-sm text-text-primary">Anotações e ortodontia</span>
                    <span className="block text-[11px] text-text-secondary">Abra para complementar o registro clínico.</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-open:rotate-90" />
                </summary>
                <div className="flex flex-col gap-4 border-t border-border/60 p-4">
              {/* Anotações gerais + conduta + ações (zona 5 do definitivo, sem o bloco Procedimentos) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Anotações gerais
                  </label>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Evolução clínica em texto — o que não é procedimento estruturado."
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[80px] resize-y"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Conduta
                  </label>
                  <textarea
                    value={formData.conduta}
                    onChange={(e) => setFormData((f) => ({ ...f, conduta: e.target.value }))}
                    placeholder="Orientações ao paciente, cuidados pós-procedimento, prescrições..."
                    className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[80px] resize-y"
                  />
                </div>
              </div>

              {/* R-05 — manutenção ortodôntica manual: monta o OrtoForm (que já existia mas nunca
                  era renderizado). Caminho SEM voz — o dentista lança ou corrige a arcada/fio na mão.
                  orto é por-ficha (não por-dente), então mora aqui e não no ToothDetailPanel. */}
              <div className="border-t border-border/60 pt-4">
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
                  Manutenção ortodôntica
                </label>
                {formData.ortoManutencao == null ? (
                  <button
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, ortoManutencao: { ...ORTO_VAZIO } }))}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-border text-sm font-semibold text-text-secondary hover:border-teal hover:text-teal transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar manutenção ortodôntica
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* R-05b (D1/D3) — proveniência do bloco herdado. Sem isto o dentista não
                        distingue o que digitou hoje do que veio de outra consulta, e é aí que
                        "copiado sem olhar" vira assinatura em cima de dado alheio. */}
                    {ortoHerdadaDe && (
                      <p className="text-[11px] text-text-secondary bg-surface-alt border border-border rounded-lg px-3 py-2">
                        Pré-preenchido com a manutenção de{' '}
                        <span className="font-semibold text-text-primary">{dataBR(ortoHerdadaDe.data)}</span>
                        {' · '}{ortoHerdadaDe.autorNome} — <span className="font-semibold">confira antes de salvar</span>.
                        {' '}A ativação de hoje não é herdada.
                      </p>
                    )}
                    <OrtoForm
                      valor={formData.ortoManutencao}
                      onChange={(v) => setFormData((f) => ({ ...f, ortoManutencao: v }))}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, ortoManutencao: null }))}
                      className="self-start flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-coral transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover manutenção
                    </button>
                  </div>
                )}
              </div>
                </div>
              </details>
              </section>

              {/* R-59 Parte 4 — mesmo padrão do banner de falha ao CARREGAR (acima, fora do
                  painel): a ficha salvou, mas o odontograma não. Painel fica aberto de
                  propósito pra isto ficar visível junto do botão de retry. */}
              {eventosFalharamAoSalvar && (
                <div className="flex items-center gap-3 bg-coral/5 border border-coral/20 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-coral shrink-0" />
                  <p className="text-sm font-medium text-coral">
                    A ficha salvou, mas o odontograma não foi gravado. Tente salvar de novo
                    antes de sair — cancelar agora perde as mudanças no odontograma.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => closePanel()}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving || capturaDex.impedeSalvar || (editingId !== null && !temAlteracoesPendentes)}
                  className="bg-teal hover:bg-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] disabled:opacity-50"
                >
                  {isSaving ? (<Loader2 className="w-4 h-4 animate-spin" />) : (<Check className="w-4 h-4" />)}
                  {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar Evolução"}
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!modoEditorEmbutido && <>
      {/* Timeline */}
      {evolutions.length === 0 && !isPanelOpen && (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <FileText className="w-10 h-10 text-text-secondary/30 mx-auto mb-3" />
          <p className="text-text-secondary text-sm">
            Nenhuma evolução registrada. Clique em &ldquo;Nova Evolução&rdquo; para começar.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Lista cronológica plana — todas as fichas (modelo 1 ficha = 1 tratamento) */}
        {evolutionsVisiveis.length > 0 && (
          <div className="space-y-5">
            {evolutionsVisiveis.map((evo, idx) => {
              const isExpanded = viewingEvo?.id === evo.id;
              // R-16: eventos que sobrevivem ao filtro — usados em contador/pills/
              // odontograma/cards pra o header não mentir numa ficha mista. Sem filtro
              // === evo.eventos.
              const eventosVis = eventosFiltrados(evo);
              // R-20 Fase 3 — cards da ficha salva computados aqui (não só no bloco de registros)
              // pra o onToothToggle do odontograma achar o card por dente e destacar (como o Site A).
              const cardsVis = eventosParaCards(eventosVis, evo.professional, evo.autorCro);
              const validKeys = evo.teethNotes.flatMap((tn) =>
                tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`)
              );
              const totalProcs = validKeys.length;
              const doneProcs = validKeys.filter((k) => evo.procedimentosStatus[k] === 'concluido').length;
              const allDone = totalProcs > 0 && doneProcs === totalProcs;

              // R-108 §4.3 — nome gravado vence; sem nome, deriva dos eventos (nunca vazio).
              // Só existe pra ficha do modelo novo (com evento) — legado não tem tratamento.
              const nomeTratamento = eventosVis.length > 0
                ? (evo.nome ?? nomeTratamentoDerivado(eventosVis.map(eventoViewParaDraft)))
                : null;
              const feitosTratamento = eventosVis.filter((e) => e.status === 'realizado').length;
              const totalTratamento = eventosVis.length;
              const progressoPct = totalTratamento > 0 ? Math.round((feitosTratamento / totalTratamento) * 100) : 0;

              return (
              <motion.div
                key={evo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              >
                {/* ═══ Ficha salva — design definitivo (artefato §05, 21/07). Header 1 linha:
                    tipo · data · autor/CRO · contagem · pills · ações. Expandido: odontograma-
                    índice + registros (eventos OU derivação v2 no MESMO visual) + orto + textos. */}
                <div id={`ficha-${evo.id}`} className={`bg-surface rounded-2xl border transition-all duration-200 overflow-hidden ${isExpanded ? 'border-teal/50 shadow-lg' : 'border-border/60 shadow-sm'}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => alternarExpansaoFicha(evo)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarExpansaoFicha(evo); } }}
                    className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      {/* R-108 §6 bloco 1 — cabeçalho do tratamento: nome + progresso. Só nasce
                          com evento (ficha do modelo novo); legado fica exatamente como era. */}
                      {nomeTratamento && (
                        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-teal-ink mb-0.5">
                          <span className="truncate">{nomeTratamento}</span>
                          <span className="shrink-0 font-mono normal-case tracking-normal text-text-secondary">
                            {feitosTratamento} de {totalTratamento}
                          </span>
                        </p>
                      )}
                      <p className="font-heading text-lg text-text-primary truncate">
                        {evo.type} · <span className="font-mono text-base">{evo.date}</span>
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 truncate">
                        {evo.professional}
                        {evo.autorCro && <span className="font-mono"> — {evo.autorCro}</span>}
                        {' · '}
                        {eventosVis.length > 0
                          ? `${eventosVis.length} registro${eventosVis.length > 1 ? 's' : ''}`
                          : `${totalProcs} procedimento${totalProcs !== 1 ? 's' : ''}`}
                        {evo.assinadoEm && <span className="text-teal-ink font-semibold"> · ✓ assinada</span>}
                      </p>
                      {nomeTratamento && (
                        <div className="mt-1.5 h-1 max-w-[220px] overflow-hidden rounded-full bg-surface-alt">
                          <div className="h-full rounded-full bg-teal" style={{ width: `${progressoPct}%` }} />
                        </div>
                      )}
                    </div>

                    {eventosVis.length > 0 ? (
                      (() => {
                        const feitos = eventosVis.filter((e) => e.status === 'realizado').length;
                        const plan = eventosVis.length - feitos;
                        return (
                          <span className="flex items-center gap-1.5 shrink-0">
                            {feitos > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-teal-pale text-teal-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal" />{feitos} feito{feitos > 1 ? 's' : ''}
                              </span>
                            )}
                            {plan > 0 && (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-coral-pale text-coral-ink">
                                <span className="w-1.5 h-1.5 rounded-full bg-coral" />{plan} planejado{plan > 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                        );
                      })()
                    ) : totalProcs > 0 ? (
                      <span className={`inline-flex items-center gap-1.5 shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full ${allDone ? 'bg-teal-pale text-teal-ink' : 'bg-surface-alt text-text-secondary'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${allDone ? 'bg-teal' : 'bg-border-strong'}`} style={!allDone ? { background: 'var(--color-border)' } : undefined} />
                        {doneProcs}/{totalProcs} realizados
                      </span>
                    ) : null}

                    <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onGerarOrcamento && (
                        <button
                          onClick={() => onGerarOrcamento(evo.id)}
                          title="Gerar orçamento"
                          className="min-h-11 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-teal-ink hover:bg-teal-pale transition-colors"
                        >
                          Gerar orçamento
                        </button>
                      )}
                      {podeEditarFicha(evo) && (
                        <button
                          onClick={() => handleEdit(evo)}
                          title="Editar ficha"
                          aria-label="Editar ficha"
                          className="min-h-11 rounded-lg px-3 text-[11px] font-bold text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary inline-flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-4 h-4" />
                          <span>Editar ficha</span>
                        </button>
                      )}
                        <button
                          onClick={() => window.open(`/api/fichas/${evo.id}/pdf`, '_blank')}
                          title="Baixar"
                          aria-label="Baixar ficha em PDF"
                        className="h-11 w-11 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary inline-flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {podeEditarFicha(evo) && (
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(evo.id);
                            setVinculosFicha(null);
                            setExclusaoConfirmada(false);
                            setVinculosLoading(true);
                            void contarVinculosFicha(evo.id)
                              .then(setVinculosFicha)
                              .finally(() => setVinculosLoading(false));
                          }}
                          title="Excluir"
                          aria-label="Excluir ficha"
                          className="h-11 w-11 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-coral inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <span className={`p-1 text-text-secondary/40 transition-transform duration-300 inline-flex ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronRight className="w-4 h-4 -rotate-90" />
                      </span>
                    </span>
                  </div>

                  {/* Colapsada: 1 linha de resumo — o detalhe mora no expandido (feedback 21/07) */}
                  {!isExpanded && (
                    <div className="px-5 pb-4 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-text-secondary">
                      {(() => {
                        const dentes = eventosVis.length > 0
                          ? [...new Set(eventosVis.map((e) => e.ancora.dente).filter((d): d is number => d != null))]
                          : [...new Set(evo.teethNotes.map((tn) => tn.tooth).filter((t) => !(t in ARCH_LABELS)))];
                        const regioes = eventosVis.length === 0
                          ? evo.teethNotes.map((tn) => tn.tooth).filter((t) => t in ARCH_LABELS).map((t) => ARCH_LABELS[t])
                          : [];
                        return (
                          <>
                            {dentes.sort((a, b) => a - b).length > 0 && (
                              <span className="font-mono">{dentes.map((d) => `D${d}`).join(' · ')}</span>
                            )}
                            {regioes.map((r) => <span key={r}>{r}</span>)}
                            {evo.ortoManutencao && <span className="text-slate-ink">· orto</span>}
                            <span className="text-text-secondary/50 font-normal">— toque para abrir</span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="aberta"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="border-t border-border/60 px-5 py-5 flex flex-col gap-4">

                          {/* R-20: odontograma-índice + perfil lado-a-lado (readOnly), encolhe ao abrir */}
                          <OdontogramaComPainel
                            odontograma={
                              <div className="bg-surface-alt/40 border border-border/60 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <p className="font-heading text-base text-text-primary">Odontograma — índice</p>
                                  <p className="text-[10.5px] text-text-secondary italic">toque um dente para ver o perfil</p>
                                </div>
                                <Odontograma
                                  eventos={eventosVis.length > 0 ? eventosVis.map(eventoViewParaDraft) : undefined}
                                  // C5 — anel de seleção agora é aditivo (não depende mais de
                                  // `clinico`), então o `[]` defensivo saiu: um dente com evento
                                  // já mostra o anel corretamente ao ser selecionado.
                                  selectedTeeth={evo.teethNotes.map((tn) => tn.tooth)}
                                  onToothToggle={(d) => {
                                    const jaAberto = denteSalvoAberto?.fichaId === evo.id && denteSalvoAberto.dente === d;
                                    setDenteSalvoAberto(jaAberto ? null : { fichaId: evo.id, dente: d });
                                    if (jaAberto) return;
                                    // R-21 Fase 3: abre a seção do dente na lista e rola até ela (siteId = evo.id).
                                    destacarDente(d, evo.id, setDentesAbertosB, cardsVis);
                                  }}
                                  compact
                                  hideFilters
                                />
                              </div>
                            }
                            painel={
                              denteSalvoAberto?.fichaId === evo.id ? (
                                <ToothDetailPanel
                                  dente={denteSalvoAberto.dente}
                                  eventos={eventosVis.map(eventoViewParaDraft)}
                                  onChange={() => {}}
                                  onClose={() => setDenteSalvoAberto(null)}
                                  dataPadrao={evo.dataAtendimento}
                                  readOnly
                                  tabelaContainer={tabelaElB}
                                  // R-30 Parte 7 (contrato 3) — mesmo cálculo do <Odontograma>
                                  // logo acima nesta mesma visualização.
                                  state={computeToothState(denteSalvoAberto.dente, {
                                    clinico: eventosVis.length > 0,
                                    sharedTeeth: [],
                                    selectedTeeth: eventosVis.length > 0 ? [] : evo.teethNotes.map((tn) => tn.tooth),
                                    historicalTeeth: new Set<number>(),
                                  })}
                                />
                              ) : null
                            }
                          />
                          {/* R-21 Fase 2: a tabela de especialidade agora monta DENTRO da seção do dente na
                              lista (não mais numa faixa aqui). Fallback inline no painel se o alvo não existe. */}

                          {/* Registros — eventos (novo modelo) OU derivação v2 no MESMO visual.
                              R-16: eventosVis já aplicou o filtro por responsável.
                              R-04 Fase 3: modo seleção (variante B) liga o botão "Encaminhar". */}
                          {eventosVis.length > 0 ? (() => {
                            const cards = cardsVis;
                            const emModo = modoSelecaoFichaId === evo.id;
                            const modoAtual = emModo ? modoSelecaoTipo : null;
                            const podeEncaminhar = podeEditarFicha(evo) && !evo.assinadoEm;
                            const temEncaminhavel = cards.some((c) => c.data.status === 'indicado' && !c.data.encaminhadoPara);
                            // R-03b — assinável é por REGISTRO (data.assinada), não mais por ficha
                            // (evo.assinadoEm continua existindo, mas só governa o caminho legado).
                            const podeAssinarLote = podeEditarFicha(evo) && !evo.assinadoEm;
                            const temAssinavel = cards.some((c) => c.data.status === 'realizado' && !c.data.assinada);
                            // R-21 — render de UM card da ficha salva (Site B). Idêntico ao .map anterior
                            // (modo seleção R-04/R-03b, dimming do inelegível, realce, encaminhamento); só foi
                            // extraído pra ser chamado por dente via renderSecoesPorDente.
                            const renderCardVis = ({ key, ids, data }: { key: string; ids: string[]; data: RegistroCardData }) => {
                              const encaminhavel = podeEncaminhar && data.status === 'indicado' && !data.encaminhadoPara;
                              const assinavel = podeAssinarLote && data.status === 'realizado' && !data.assinada;
                              const elegivel = modoAtual === 'encaminhar' ? encaminhavel : modoAtual === 'assinar' ? assinavel : false;
                              // No modo, o que não é elegível pra esse tipo de lote apaga e fica inerte (#8).
                              if (emModo && !elegivel) {
                                return (
                                  <div key={key} className="opacity-40 pointer-events-none">
                                    <RegistroCard data={data}>{corpoEspecialidade(data.tipo, data.detalhe)}</RegistroCard>
                                  </div>
                                );
                              }
                              const destacado = grupoDestacado === key;
                              return (
                                <div
                                  key={key}
                                  ref={(el) => {
                                    if (el) registroCardRefs.current.set(key, el);
                                    else registroCardRefs.current.delete(key);
                                  }}
                                  className={destacado ? 'rounded-xl ring-2 ring-teal ring-offset-2 ring-offset-background transition-shadow duration-300' : ''}
                                >
                                  <RegistroCard
                                    data={data}
                                    selecionavel={emModo && elegivel}
                                    selecionado={selecionados.has(key)}
                                    onToggleSelecao={emModo && elegivel ? () => toggleSelecao(key) : undefined}
                                    onToggleStatus={
                                      emModo
                                        ? undefined
                                        : podeEditarFicha(evo) && !data.encaminhadoPara && !data.assinada
                                          ? () => void toggleStatusRegistro(evo, ids, data.status)
                                          : data.encaminhadoPara?.id === dentistaId && !data.assinada
                                            ? () => void concluirEncaminhado(evo, ids, data.status)
                                            : undefined
                                    }
                                    onToggleMomento={
                                      !emModo && podeEditarFicha(evo) && !data.encaminhadoPara && !data.assinada
                                        ? () => void toggleMomentoRegistro(evo, ids, data.momentoPlanejado)
                                        : undefined
                                    }
                                  >
                                    {/* R-04b — destino do encaminhamento edita a tabela; os demais veem read-only.
                                        Aparece MESMO com detalhe vazio (oposto do card comum, I2). */}
                                    {(data.encaminhadoPara?.id === dentistaId
                                      && (data.tipo === 'endodontia' || data.tipo === 'implante')
                                      && !data.assinada)
                                      ? corpoEspecialidadeDestino(
                                          data.tipo,
                                          detalheRascunho[key] !== undefined ? detalheRascunho[key] : data.detalhe,
                                          (v) => setDetalheRascunho((r) => ({ ...r, [key]: v })),
                                          () => void salvarDetalheEncaminhado(evo, ids, key),
                                          salvandoDetalheKey === key,
                                        )
                                      : corpoEspecialidade(data.tipo, data.detalhe)}
                                  </RegistroCard>
                                </div>
                              );
                            };
                            return (
                            <div className="flex flex-col gap-2">
                              {/* Cabeçalho da consulta: liga o modo seleção NESTA consulta */}
                              {!emModo && (podeEncaminhar && temEncaminhavel && destinosDisponiveis.length > 0
                                || podeAssinarLote && temAssinavel) && (
                                <div className="flex justify-end gap-2 -mb-1">
                                  {podeAssinarLote && temAssinavel && (
                                    <button
                                      type="button"
                                      onClick={() => ligarModoSelecao(evo.id, 'assinar')}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-ink hover:bg-teal-pale px-2.5 py-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal transition-colors"
                                    >
                                      <PenLine className="w-3.5 h-3.5" />
                                      Selecionar quais assinar
                                    </button>
                                  )}
                                  {podeEncaminhar && temEncaminhavel && destinosDisponiveis.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => ligarModoSelecao(evo.id, 'encaminhar')}
                                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-ink hover:bg-teal-pale px-2.5 py-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal transition-colors"
                                    >
                                      <Forward className="w-3.5 h-3.5" />
                                      Encaminhar
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* R-21 — lista agrupada por dente (Site B). Em modo seleção força tudo aberto
                                  pra nenhum encaminhável ficar escondido dentro de um grupo fechado.
                                  Fase 2: a tabela do dente aberto NESTA ficha monta dentro da seção.
                                  Fase 3: clique no odontograma abre a seção (siteId = evo.id, único por ficha). */}
                              {renderSecoesPorDente({
                                secoes: agruparPorDente(cards),
                                renderCard: renderCardVis,
                                dentesAbertos: dentesAbertosB,
                                onToggleDente: toggleDenteB,
                                registrarRefDente,
                                forcarAbertos: emModo,
                                denteComTabela: denteSalvoAberto?.fichaId === evo.id ? denteSalvoAberto.dente : null,
                                tabelaRef: setTabelaElB,
                                siteId: evo.id,
                                denteDestacado,
                              })}
                            </div>
                            );
                          })() : evo.teethNotes.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {evo.teethNotes.flatMap((tn) =>
                                tn.notes.filter(Boolean).map((nota, i) => {
                                  const k = `${tn.tooth}_${i}`;
                                  const st: ProcStatus = evo.procedimentosStatus[k] ?? 'nao_iniciado';
                                  const meta = STATUS_META[st];
                                  const StatusIcon = meta.icon;
                                  const editavel = podeEditarFicha(evo);
                                  return (
                                    <div key={k} className="bg-surface border border-border rounded-xl flex items-center gap-3 px-4 py-2.5 flex-wrap">
                                      <span className="shrink-0 min-w-[30px] h-[30px] px-2 rounded-lg bg-surface-alt border border-border flex items-center justify-center font-mono text-[11px] font-bold text-text-primary">
                                        {tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : tn.tooth}
                                      </span>
                                      <p className="min-w-0 flex-1 text-sm font-medium text-text-primary">{nota}</p>
                                      <button
                                        type="button"
                                        disabled={!editavel}
                                        onClick={() => editavel && void updateProcStatus(evo.id, evo.procedimentosStatus, k, STATUS_CYCLE[st])}
                                        className={`inline-flex items-center gap-1.5 shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-full border transition-colors ${meta.className} ${!editavel ? 'cursor-default opacity-70' : ''}`}
                                      >
                                        <StatusIcon className="w-3 h-3" />
                                        {meta.label}
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}

                          {evo.ortoManutencao && (
                            <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                              <OrtoCard valor={evo.ortoManutencao} />
                            </div>
                          )}

                          {/* Assinatura por procedimento (artefato §07) — sai do topo, vem
                              pro rodapé mostrando O QUE ela cobre. Planejado não assina.
                              R-03b: "realizados" aqui já exclui os que ESTE evento (não a
                              ficha) já tem assinaturaId — o bloco some quando não sobra
                              nada a assinar, mesmo com a ficha ainda "aberta". */}
                          {podeEditarFicha(evo) && !evo.assinadoEm && (() => {
                            const realizados = evo.eventos.filter((e) => e.status === 'realizado' && e.assinaturaId == null);
                            const legado = evo.eventos.length === 0 && totalProcs > 0;
                            if (realizados.length === 0 && !legado) return null;
                            return (
                              <div className="border border-teal/40 bg-teal-pale/40 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold uppercase tracking-widest text-teal-ink mb-0.5">
                                    Assinatura do paciente
                                  </p>
                                  <p className="text-xs text-text-secondary">
                                    {legado
                                      ? `Cobre os ${doneProcs} procedimento${doneProcs !== 1 ? 's' : ''} concluído${doneProcs !== 1 ? 's' : ''} desta ficha.`
                                      : `Cobre ${realizados.length} procedimento${realizados.length > 1 ? 's' : ''} realizado${realizados.length > 1 ? 's' : ''}: ${realizados.map((e) => `${TIPO_LABEL[e.tipo]}${e.ancora.dente ? ` ${e.ancora.dente}` : ''}`).join(' · ')}`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setAssinadoPorInput(patientName ?? '');
                                    setOrientacoesAssinatura(evo.conduta?.trim() || evo.observation.trim());
                                    setSigningTarget(
                                      legado
                                        ? { kind: 'legado', fichaId: evo.id }
                                        : { kind: 'todos', fichaId: evo.id, pacienteId: patientId },
                                    );
                                  }}
                                  className="shrink-0 bg-teal hover:bg-teal-lt text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors"
                                >
                                  <PenLine className="w-3.5 h-3.5" />
                                  Coletar assinatura
                                </button>
                              </div>
                            );
                          })()}

                          {(evo.observation || evo.conduta) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {evo.observation && (
                                <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Anotações gerais</p>
                                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{evo.observation}</p>
                                </div>
                              )}
                              {evo.conduta && (
                                <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Conduta</p>
                                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{evo.conduta}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* R-108 §6 bloco 5 — evoluções, uma por visita. Só ficha do modelo
                              novo (com tratamento) tem mais de 1; legado nunca chega aqui
                              porque nomeTratamento é null sem evento (§4.3). */}
                          {nomeTratamento && evo.evolucoes.length > 0 && (
                            <div className="bg-surface-alt/40 border border-border/60 rounded-2xl px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-3">
                                Evoluções — uma por visita
                              </p>
                              <div className="relative pl-[22px] before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-border before:content-['']">
                                {evo.evolucoes.map((e) => (
                                  <div
                                    key={e.id}
                                    className="relative pb-4 last:pb-0 before:absolute before:-left-[21px] before:top-1 before:h-3 before:w-3 before:rounded-full before:bg-teal before:shadow-[0_0_0_3px_var(--color-surface-alt)] before:content-['']"
                                  >
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <span className="font-mono text-xs font-medium text-text-primary">{dataBR(e.data)}</span>
                                      <span className="text-[11px] text-text-secondary">{e.dentistaNome}</span>
                                      {e.automatica && (
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary/70">
                                          · automática
                                        </span>
                                      )}
                                    </div>
                                    {e.texto && (
                                      <p className="mt-1 max-w-[72ch] whitespace-pre-line text-xs leading-relaxed text-text-secondary">
                                        {e.texto}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              );
            })}
          </div>
        )}

      </div>
      </>}

      {/* R-04 Fase 3 / R-03b: barra de ação do modo seleção — fixa, escopada à consulta em modo */}
      <AnimatePresence>
        {modoSelecaoFichaId && modoSelecaoTipo === 'encaminhar' && (
          <EncaminharBar
            totalSelecionado={idsSelecionados.length}
            totalEncaminhavel={cardsSelecionaveis.length}
            destinosDisponiveis={destinosDisponiveis}
            destino={destinoEncaminhar}
            onDestino={setDestinoEncaminhar}
            onSelecionarTudo={() => setSelecionados(new Set(cardsSelecionaveis.map((c) => c.key)))}
            onLimpar={() => setSelecionados(new Set())}
            onConfirmar={() => void confirmarEncaminhamentoLote()}
            onSair={sairModoSelecao}
          />
        )}
        {modoSelecaoFichaId && modoSelecaoTipo === 'assinar' && (
          <AssinarBar
            totalSelecionado={idsSelecionados.length}
            totalAssinavel={cardsSelecionaveis.length}
            onConfirmar={confirmarAssinaturaLote}
            onSelecionarTudo={() => setSelecionados(new Set(cardsSelecionaveis.map((c) => c.key)))}
            onLimpar={() => setSelecionados(new Set())}
            onSair={sairModoSelecao}
          />
        )}
      </AnimatePresence>

      {/* Dialog: Assinatura do Paciente */}
      <Dialog open={!!signingTarget} onOpenChange={(open) => { if (!open) { setSigningTarget(null); setOrientacoesAssinatura(''); } }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border-border bg-surface">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl text-text-primary flex items-center gap-2">
              <PenLine className="w-5 h-5 text-teal" />
              Assinatura do Paciente
            </DialogTitle>
            <DialogDescription className="text-text-secondary text-sm">
              Vire a tela para o paciente e peça que assine com o dedo ou mouse.
            </DialogDescription>
          </DialogHeader>

          {signingTarget?.kind !== 'legado' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="assinatura-nome" className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Nome de quem assina
                </label>
                <input
                  id="assinatura-nome"
                  type="text"
                  value={assinadoPorInput}
                  onChange={(e) => setAssinadoPorInput(e.target.value)}
                  placeholder="Nome do paciente ou responsável"
                  className="w-full bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="assinatura-orientacoes" className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Orientações entregues
                </label>
                <textarea
                  id="assinatura-orientacoes"
                  value={orientacoesAssinatura}
                  onChange={(e) => setOrientacoesAssinatura(e.target.value)}
                  rows={3}
                  placeholder="Cuidados pós-procedimento e orientação de retorno"
                  className="w-full resize-none bg-surface-alt border border-border rounded-xl px-3.5 py-2 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                />
              </div>
            </div>
          )}

          <SignaturePad padRef={signaturePadRef} />

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setSigningTarget(null); setOrientacoesAssinatura(''); }}
              disabled={isSavingSignature}
              className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveSignature()}
              disabled={isSavingSignature}
              className="bg-teal text-white hover:bg-teal-lt rounded-xl"
            >
              {isSavingSignature ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Confirmar assinatura</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteConfirm(null); setVinculosFicha(null); setExclusaoConfirmada(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center border border-border/40"
            >
              <div className="w-16 h-16 bg-coral/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-coral" />
              </div>
              <h3 className="font-heading text-2xl text-text-primary mb-2">Excluir Evolução?</h3>
              <p className="text-text-secondary text-sm mb-4">
                Esta ação não pode ser desfeita. O registro será removido permanentemente.
              </p>
              {/* R-35 item 2 — orçamento e pagamento vinculados vão junto (cascade); mostra
                  a consequência real antes de deixar confirmar, em vez de apagar em silêncio. */}
              {vinculosLoading ? (
                <p className="text-xs text-text-secondary/60 mb-8">Conferindo orçamentos vinculados...</p>
              ) : vinculosFicha && vinculosFicha.orcamentos > 0 ? (
                <div className="bg-coral/5 border border-coral/20 rounded-xl px-4 py-3 mb-8 text-left">
                  <p className="text-xs font-medium text-coral">
                    Vai junto: {vinculosFicha.orcamentos} orçamento{vinculosFicha.orcamentos > 1 ? 's' : ''}
                    {vinculosFicha.pagamentos > 0 && (
                      <> e {vinculosFicha.pagamentos} pagamento{vinculosFicha.pagamentos > 1 ? 's' : ''}</>
                    )} vinculado{vinculosFicha.orcamentos > 1 ? 's' : ''} a esta ficha.
                  </p>
                </div>
              ) : (
                <div className="mb-8" />
              )}
              <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-coral/30 bg-coral/5 px-4 py-3 text-left text-xs text-text-primary">
                <input
                  type="checkbox"
                  checked={exclusaoConfirmada}
                  onChange={(event) => setExclusaoConfirmada(event.target.checked)}
                  className="mt-0.5 size-4 accent-coral"
                />
                <span>Estou ciente de que a exclusão é permanente e pode remover orçamento, recebimentos e documentos relacionados.</span>
              </label>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowDeleteConfirm(null); setVinculosFicha(null); setExclusaoConfirmada(false); }}
                  className="flex-1 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleDelete(showDeleteConfirm)}
                  disabled={vinculosLoading || !exclusaoConfirmada}
                  className="flex-1 bg-coral text-white hover:bg-coral/90 rounded-xl disabled:opacity-60"
                >
                  Excluir
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
