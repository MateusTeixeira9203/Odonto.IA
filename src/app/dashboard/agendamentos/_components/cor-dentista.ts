// Cor por dentista — a mesma faixa nas visões de Dia e Semana (spec R-13 §3.2/§5.2).
//
// Por que por SLOT e não por nome ou por hash do id: nome reordena quando alguém é
// renomeado ou quando um dentista entra no meio do alfabeto — a recepção decorou a cor
// errada da noite pro dia. Hash do id colide fácil com 8 slots e poucos dentistas.
// Slot = posição de entrada na clínica (`created_at`) é a única regra estável: dentista
// novo pega o próximo slot livre, e ninguém que já estava lá muda de cor.

export interface DentistaAgenda {
  id: string;
  nome: string;
  /** Posição por `created_at` na clínica — não é ordem alfabética. */
  slot: number;
}

/**
 * Paleta de 8 hexes, medida em 22/07 no artefato `R-13-agenda.html` contra
 * `--color-surface` nos dois temas (#ffffff / #111112). Piso: 3:1 (WCAG 1.4.11).
 *
 * A ORDEM é o contrato, não estética: os 4 primeiros são os matizes mais distantes
 * entre si, porque quase toda clínica para em 4 dentistas. Os pares mais próximos em
 * matiz (azul/índigo, fúcsia/rosa) ficam nos extremos e só coexistem com 8 no ar.
 *
 * `#4338ca` foi o índigo original e REPROVOU — 2.39:1 no escuro. Não voltar a ele.
 */
const PALETA_DENTISTA = [
  '#2563eb', // 0 azul
  '#c2410c', // 1 laranja
  '#15803d', // 2 verde
  '#c026d3', // 3 fúcsia
  '#0e7490', // 4 ciano
  '#4d7c0f', // 5 lima
  '#db2777', // 6 rosa
  '#6366f1', // 7 índigo
] as const;

/** Faixa esquerda do card (4px). Estável: mesmo slot sempre devolve a mesma cor. */
export function corDoDentista(slot: number): string {
  return PALETA_DENTISTA[slot % PALETA_DENTISTA.length];
}
