import type { ComponenteGrupoOrcamento } from '@/lib/orcamentos/grupos';
import type { AceiteOrcamento } from '@/types/orcamento';
import type {
  TipoRegistroOdontograma, StatusRegistro, OrigemRegistro,
  NivelAncora, Arcada, QuadranteFDI, FaceDental, PapelNoGrupo,
} from '@/types/odontograma';

export type OrcamentoItem = {
  composicao?: ComponenteGrupoOrcamento[] | null;
  id: string;
  descricao: string | null;
  preco_total: number | null;
  quantidade: number;
  /** R-114 — o paciente aprovou este item? Item não aprovado continua na lista (visível,
   *  esmaecido); só não conta no devido nem sai no PDF. */
  aprovado: boolean;
};

export type Pagamento = {
  id: string;
  cobranca_id: string | null;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  parcela_numero: number | null;
  total_parcelas: number | null;
  marcado_por: { nome: string } | null;
};

export type CobrancaEtapa = {
  observacoes?: string | null;
  id: string;
  subtotal: number;
  desconto: number;
  valor_final: number;
  numero_parcelas: number;
  primeiro_vencimento: string;
  situacao: 'aberta' | 'cancelada';
  created_at: string;
  itens: { orcamento_item_id: string; preco_total_snapshot: number }[];
  pagamentos: Pagamento[];
};

export type OrcamentoComItens = {
  id: string;
  /** Legado (R-65 e anteriores) — a tela antiga de `/dashboard/orcamentos` ainda declara
   *  status por aqui; esta tela (perfil do paciente) usa `estado`, derivado (R-114). Não
   *  remover: `atualizarStatusOrcamento` (usado pela ponte da tela antiga) ainda escreve nele,
   *  e o campo alimenta o rótulo enquanto a tela antiga não migra. */
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  /** R-114/R-130 — quando definido, é o valor negociado e portanto o devido. */
  valor_acordado: number | null;
  /** Plano ativo trava a edição direta do valor negociado para parcelas não divergirem. */
  plano_forma?: string | null;
  desconto: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  /** R-38 — false esconde preço por item e Subtotal no PDF. Default true. */
  mostrar_valor_por_item: boolean;
  dentista_id: string | null;
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
  cobrancas: CobrancaEtapa[];
  aprovado_por: { nome: string } | null;
  aprovado_em: string | null;
  /** R-03c-1 — aceite assinado pelo paciente. null = ainda não coletado. */
  aceite: AceiteOrcamento | null;
};

/** R-30 Parte 4 — linha crua de `odontograma_eventos` embutida na query de `fichas` (a
 *  âncora vem achatada em colunas, não como objeto `AncoraClinica` — mesmo shape da tabela). */
export type EventoOdontogramaParaOrc = {
  id: string;
  tipo: TipoRegistroOdontograma;
  procedimento_id: string | null;
  procedimento_nome: string | null;
  status: StatusRegistro;
  origem: OrigemRegistro;
  nivel: NivelAncora;
  arcada: Arcada | null;
  quadrante: QuadranteFDI | null;
  dente: number | null;
  faces: FaceDental[] | null;
  papel_no_grupo: PapelNoGrupo | null;
  grupo_id: string | null;
  assinatura_id: string | null;
  /** Texto livre de `outro`; é a descrição clínica quando não há tipo canônico. */
  observacao: string | null;
  /** R-53 — destino do encaminhamento (R-04/R-52). NÃO exclui do orçamento: define o
   *  responsável exibido (`encaminhado_para ?? autor da ficha`, via filtro-responsavel.ts). */
  encaminhado_para: string | null;
  encaminhado_dentista: { nome: string } | null;
};

export type FichaParaOrc = {
  id: string;
  created_at: string;
  data_atendimento: string;
  queixa_principal: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  /** R-30 Parte 4 — fonte real do orçamento gerado (dentes_observacoes vira só descritivo). */
  odontograma_eventos: EventoOdontogramaParaOrc[];
  /** R-53 — autor da ficha = responsável default dos eventos não encaminhados
   *  (contrato de filtro-responsavel.ts: FichaResponsavel.autorId/autorNome). */
  dentista_id: string;
  dentista: { nome: string } | null;
};

export type ProcedimentoClinica = {
  id: string;
  nome: string;
  preco_padrao: number | null;
};

export type NovoOrcItem = {
  /** Apenas durante a montagem: preserva originais para desfazer sem perder preço ou eventos. */
  composicao?: NovoOrcItem[];
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  /** Texto decimal BR ("250" ou "250,50") — parsear com `parseValorBR` antes de usar como número. */
  preco: string;
  /** R-125b — fontes estruturadas que este item representa. Manual/legado ficam vazios. */
  eventoIds?: string[];
  origem?: 'evento' | 'manual' | 'legado';
  /** R-135 — o card pode ficar visível, mas só entra no orçamento quando selecionado. */
  selecionado?: boolean;
};

export type OrcEditItem = {
  id?: string;
  descricao: string;
  quantidade: number;
  /** Texto decimal BR ("250" ou "250,50") — parsear com `parseValorBR` antes de usar como número. */
  preco_unitario: string;
};
