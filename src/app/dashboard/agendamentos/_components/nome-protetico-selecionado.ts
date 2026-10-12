export type ProteticoSelecionavel = {
  id: string;
  nome: string;
};

export function nomeProteticoSelecionado(
  proteticos: readonly ProteticoSelecionavel[],
  id: string | null,
): string {
  if (!id) return 'Selecione o protético...';
  return proteticos.find((protetico) => protetico.id === id)?.nome ?? 'Protético indisponível';
}
