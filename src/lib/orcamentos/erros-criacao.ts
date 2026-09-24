type ErroRpcOrcamento = {
  code?: string | null;
  message?: string | null;
};

/** Mensagens seguras para recusas atômicas de criação ou inclusão no orçamento. */
export function erroCriacaoOrcamento(
  erro: ErroRpcOrcamento | null,
  operacao: 'criar' | 'adicionar',
): string {
  const mensagem = erro?.message ?? '';
  const recarregar = operacao === 'criar' ? 'Recarregue a ficha e tente novamente.' : 'Recarregue a ficha antes de continuar.';

  if (erro?.code === '23505' || mensagem.includes('orcamento_evento_ja_orcado') || mensagem.includes('orcamento_evento_duplicado')) return `Um dos procedimentos já entrou em outro orçamento. ${recarregar}`;
  if (mensagem.includes('orcamento_evento_invalido')) return `Um dos procedimentos não está mais disponível para este orçamento. ${recarregar}`;
  if (mensagem.includes('orcamento_evento_ficha_invalido')) return operacao === 'criar'
    ? 'Os procedimentos precisam pertencer à ficha selecionada. Reabra a ficha e tente novamente.'
    : 'Os procedimentos adicionais precisam pertencer à mesma ficha do orçamento.';
  if (mensagem.includes('orcamento_evento_item_invalido')) return 'Um vínculo de procedimento está desatualizado. Recarregue a ficha antes de continuar.';
  if (mensagem.includes('orcamento_procedimento_de_outro_dentista')) return 'O procedimento escolhido pertence a outro dentista. Recarregue o catálogo antes de continuar.';
  if (mensagem.includes('orcamento_procedimento_invalido')) return 'Um procedimento do catálogo não está mais disponível. Recarregue o catálogo antes de continuar.';
  if (mensagem.includes('orcamento_sem_contexto') || mensagem.includes('orcamento_dentista_invalido') || mensagem.includes('orcamento_sem_permissao')) return 'Sua permissão para este orçamento mudou. Recarregue a página e entre novamente se necessário.';
  if (mensagem.includes('orcamento_ficha_invalida') || mensagem.includes('orcamento_paciente_invalido')) return 'A ficha ou o paciente deste orçamento não está mais disponível. Reabra o perfil antes de continuar.';
  if (mensagem.includes('orcamento_item_invalido') || mensagem.includes('orcamento_itens_invalidos') || mensagem.includes('orcamento_eventos_invalidos')) return 'Revise os procedimentos, quantidades e valores antes de continuar.';
  if (mensagem.includes('grupo_')) return 'Revise a composição do grupo antes de continuar.';

  return operacao === 'criar'
    ? 'Não foi possível criar o orçamento agora. Seus dados foram preservados; recarregue a ficha e tente novamente.'
    : 'Não foi possível adicionar os procedimentos agora. Nenhuma alteração foi salva; recarregue a ficha e tente novamente.';
}
