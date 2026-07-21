// Layout de agendamentos sobrepostos — repartição da coluna em faixas.
//
// Fonte ÚNICA do algoritmo: a visão de Dia já o tinha, a de Semana não (bug 21/07: cards
// sobrepostos desenhados no mesmo retângulo, texto por cima de texto). Em vez de copiar,
// extraí — as duas visões passam a compartilhar o mesmo comportamento.
//
// Por que agrupa por CAIXA (pixels) e não por tempo: as duas visões aplicam um piso de
// altura (uma consulta de 15min não pode virar uma tira de 8px). Esse piso infla a caixa
// além da duração real, então dois agendamentos podem não se cruzar no relógio e ainda
// assim colidir na tela. O que o olho vê é a caixa — é ela que decide.

export interface CaixaAgendamento {
  id: string;
  /** Topo em px dentro da coluna do dia. */
  top: number;
  /** Altura em px já com o piso mínimo aplicado. */
  height: number;
}

export interface FaixaLayout {
  /** Deslocamento da esquerda, em % da largura da coluna. */
  leftPct: number;
  /** Largura, em % da largura da coluna. */
  widthPct: number;
  /** Índice da faixa (0 = mais à esquerda) — serve pro empilhamento (z-index). */
  faixa: number;
  /** Quantas faixas o cluster deste agendamento tem. 1 = está sozinho, largura cheia. */
  faixas: number;
}

/** Tolerância em px: encostar não é sobrepor (fim de um == começo do outro). */
const FOLGA = 0.5;

/**
 * Reparte a largura entre caixas que colidem. Espera `caixas` **já ordenadas por `top`**.
 *
 * Dois passos:
 *  1. **Cluster** — corrida de caixas encadeadas por colisão. Se A colide com B e B com C,
 *     as três dividem a mesma largura, mesmo que A não toque C. Sem isso, A e C ficariam
 *     na mesma faixa e B pareceria flutuar sozinho.
 *  2. **Faixa** — cada caixa cai na primeira faixa cuja última caixa já terminou. Reusar
 *     faixa é o que impede um bloco longo com várias consultas curtas dentro de virar N
 *     tiras finas: as curtas, entre si, não colidem e compartilham a mesma faixa.
 */
export function calcularFaixas(caixas: CaixaAgendamento[]): Map<string, FaixaLayout> {
  const layout = new Map<string, FaixaLayout>();
  const box = caixas.map((c) => ({ ...c, bottom: c.top + c.height }));

  let i = 0;
  while (i < box.length) {
    let fimDoCluster = box[i].bottom;
    let j = i + 1;
    while (j < box.length && box[j].top < fimDoCluster - FOLGA) {
      fimDoCluster = Math.max(fimDoCluster, box[j].bottom);
      j++;
    }
    const cluster = box.slice(i, j);

    const fimPorFaixa: number[] = [];
    const faixaDe = cluster.map((b) => {
      let faixa = fimPorFaixa.findIndex((fim) => b.top >= fim - FOLGA);
      if (faixa === -1) { faixa = fimPorFaixa.length; fimPorFaixa.push(b.bottom); }
      else { fimPorFaixa[faixa] = b.bottom; }
      return faixa;
    });

    const faixas = fimPorFaixa.length;
    cluster.forEach((b, k) => {
      layout.set(b.id, {
        leftPct: (faixaDe[k] / faixas) * 100,
        widthPct: (1 / faixas) * 100,
        faixa: faixaDe[k],
        faixas,
      });
    });

    i = j;
  }

  return layout;
}
