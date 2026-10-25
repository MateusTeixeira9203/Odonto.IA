import type { ResumoExclusaoFicha } from '@/server/patients/salvar-ficha';

export const MOTIVOS_EXCLUSAO = [
  { valor: 'paciente_errado', rotulo: 'Paciente errado' },
  { valor: 'ficha_duplicada', rotulo: 'Ficha duplicada' },
  { valor: 'aberta_por_engano', rotulo: 'Aberta por engano' },
  { valor: 'registro_incompleto', rotulo: 'Registro incompleto' },
  { valor: 'outro', rotulo: 'Outro (descreva)' },
] as const;

export interface ConfirmacaoExclusaoFicha {
  motivo: string;
  detalhe?: string;
  nomePaciente: string;
  confirmaOrcamentoAceito: boolean;
}

export function nomeConfere(digitado: string, nome: string): boolean {
  const normalizar = (valor: string) => valor.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalizar(digitado) === normalizar(nome);
}

export function podeApagar(input: {
  motivo: string;
  detalhe?: string;
  nomeConfere: boolean;
  orcamentosMantidos: number;
  caixaMarcada: boolean;
}): boolean {
  const tamanho = [...(input.detalhe?.trim() ?? '')].length;
  return MOTIVOS_EXCLUSAO.some((motivo) => motivo.valor === input.motivo)
    && (input.motivo !== 'outro' || (tamanho >= 5 && tamanho <= 200))
    && input.nomeConfere
    && (input.orcamentosMantidos === 0 || input.caixaMarcada);
}

export function mensagemErroExclusao(codigo: string): string {
  const mensagens: Record<string, string> = {
    sem_permissao: 'Sem permissão para apagar esta ficha. Você só pode apagar a própria ficha.',
    ficha_nao_encontrada: 'Ficha não encontrada.',
    ficha_assinada: 'Esta ficha tem assinatura ou documento clínico e não pode ser apagada.',
    ficha_com_orcamento: 'Não foi possível apagar a ficha. Tente novamente.',
    motivo_invalido: 'Selecione um motivo válido. Para Outro, descreva entre 5 e 200 caracteres.',
    confirmacao_invalida: 'Digite o nome do paciente para confirmar a exclusão.',
    cobranca_bloqueada: 'A clínica está com alterações bloqueadas por cobrança. Verifique o plano.',
    confirmar_orcamento_aceito: 'Marque a caixa de confirmação do orçamento aceito para apagar esta ficha.',
    ficha_com_retirado: 'Esta ficha tem procedimento retirado guardado no histórico e não pode ser apagada.',
    ficha_com_encaminhamento: 'Esta ficha tem procedimento encaminhado a outro dentista e não pode ser apagada.',
  };
  return mensagens[codigo] ?? 'Não foi possível apagar a ficha. Tente novamente.';
}

/** A RPC pode enxergar movimento financeiro que a prévia não consegue ler por RLS. */
export function recuperarConfirmacaoOrcamento(
  resumo: ResumoExclusaoFicha,
  codigo?: string,
): ResumoExclusaoFicha {
  if (codigo !== 'confirmar_orcamento_aceito' || resumo.orcamentosMantidos > 0) return resumo;
  return { ...resumo, orcamentosMantidos: 1, avisoOrcamentoPreservado: true };
}
