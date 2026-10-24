type FichaDaSessao = { id: string; nome: string };
type SessaoComFichas = { id: string; fichas: readonly FichaDaSessao[] };

export function outrasFichasDaSessao(
  visitaId: string,
  fichaAtualId: string,
  atendimentos: readonly SessaoComFichas[],
): FichaDaSessao[] {
  const visita = atendimentos.find((atendimento) => atendimento.id === visitaId);
  return visita?.fichas
    .filter((ficha) => ficha.id !== fichaAtualId)
    .map(({ id, nome }) => ({ id, nome })) ?? [];
}
