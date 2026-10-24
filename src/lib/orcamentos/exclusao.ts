export const MSG_ORCAMENTO_ASSINADO =
  'Este orçamento tem aceite assinado pelo paciente e não pode ser excluído. A assinatura é a prova do acordo. Para mudar valores, use Revisar orçamento.';

export const MSG_ERRO_EXCLUSAO = 'Não foi possível excluir o orçamento. Tente novamente.';

export function motivoBloqueioExclusao(contagens: {
  assinaturas: number;
  documentosAceite: number;
}): string | null {
  return contagens.assinaturas + contagens.documentosAceite > 0 ? MSG_ORCAMENTO_ASSINADO : null;
}

export function mensagemErroExclusao(error: { code?: string } | null): string | null {
  if (!error) return null;
  return error.code === '23503' ? MSG_ORCAMENTO_ASSINADO : MSG_ERRO_EXCLUSAO;
}
