import type { ComponenteGrupoOrcamento } from '@/lib/orcamentos/grupos';
// R-03c-1 — aceite assinado do orçamento (prova comercial, distinta da assinatura
// clínica do R-03a). Ver plans/_arquivo/specs/R-03c-1-aceite-assinado-orcamento.md.

type TermosItem = {
  composicao?: ComponenteGrupoOrcamento[] | null;
  descricao: string | null;
  dente: string | null;
  quantidade: number;
  precoUnitario: number | null;
  precoTotal: number | null;
};

/** Aceites assinados antes do R-114 (migration 146) — `status` ainda existia, itens não
 *  distinguiam aprovado. Nenhuma tela lê estes campos hoje; a forma fica só pra registro
 *  histórico honesto do que a RPC gravava naquele momento. */
interface TermosSnapshotV1 {
  versao: 1;
  subtotal: number;
  desconto: number;
  total: number;
  validadeDias: number;
  condicoesPagamento: string | null;
  mostrarValorPorItem: boolean;
  statusNoAto: 'rascunho' | 'enviado' | 'aprovado';
  itens: TermosItem[];
}

/** R-114 — `itens` já vem filtrado pra só os aprovados (I2): o snapshot assinado é o que o
 *  paciente de fato aceitou, não a proposta inteira. `total` é o devido (valor_acordado ??
 *  soma dos aprovados), `subtotal` continua a proposta inteira (I3), pra quem quiser comparar. */
interface TermosSnapshotV2 {
  versao: 2;
  subtotal: number;
  valorAprovado: number;
  desconto: number;
  total: number;
  validadeDias: number;
  condicoesPagamento: string | null;
  mostrarValorPorItem: boolean;
  estadoNoAto: 'aceito';
  itens: TermosItem[];
}

/** Termos congelados no ato do aceite. Montado no servidor (RPC aceitar_orcamento), nunca pelo client. */
export type TermosSnapshot = TermosSnapshotV1 | TermosSnapshotV2;

export interface AceiteOrcamento {
  id: string;
  assinadoPor: string;
  croNoAto: string | null;
  assinadoEm: string;
  assinaturaRef: string;
  termos: TermosSnapshot;
}
