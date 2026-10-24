import type { OdontogramaEventoDraft, OrtoManutencaoInfo } from '@/types/odontograma';

/** Decide os destinos sem ler ou gravar dados; as origens já foram verificadas no servidor. */
export function planejarRoteamentoVisita(input: {
  eventosDraft: OdontogramaEventoDraft[];
  fichaDeOrigem: ReadonlyMap<string, string>;
  fichaId?: string;
  destinoNovos?: { fichaId: string | null };
  alertaNovo?: string | null;
  ortoManutencao?: OrtoManutencaoInfo | null;
}) {
  const draft = input.eventosDraft;
  const fichaDeOrigem = input.fichaDeOrigem;
  // R-85 vence o roteamento: a ficha do orçamento antecipado já é a da sessão.
  const fichaDaSessao = input.fichaId ?? null;
  const destinoEscolhido = fichaDaSessao == null ? (input.destinoNovos?.fichaId ?? null) : null;

  const porFicha = new Map<string, OdontogramaEventoDraft[]>();
  const nascidosHoje: OdontogramaEventoDraft[] = [];

  for (const ev of draft) {
    const origem = fichaDeOrigem.get(ev.id);
    if (origem) {
      porFicha.set(origem, [...(porFicha.get(origem) ?? []), ev]);
    } else {
      nascidosHoje.push(ev);
    }
  }

  // "Absorver": procedimento novo entra num tratamento aberto que JÁ EXISTE. Mesma mecânica
  // aditiva da pendência — nos dois casos o payload é subconjunto da ficha, e por isso nenhum
  // dos dois pode passar por `salvarFicha`. A ficha do R-85 é a exceção: ela É da sessão.
  // Texto puro também alcança o destino escolhido. Alerta e orto continuam exigindo
  // ficha da sessão, pois esses dados não são gravados pelo caminho aditivo (C2-1).
  const soEvolucao = draft.length === 0 && input.alertaNovo == null && input.ortoManutencao == null;
  const absorve = destinoEscolhido !== null && (nascidosHoje.length > 0 || soEvolucao);
  if (absorve) {
    porFicha.set(destinoEscolhido, [...(porFicha.get(destinoEscolhido) ?? []), ...nascidosHoje]);
  }
  /** O que sobra pra ficha da sessão — vazio quando um tratamento aberto absorveu tudo. */
  const paraSessao = absorve ? [] : nascidosHoje;

  // ── 3. Quem fica com o relato ditado ───────────────────────────────────────
  // Uma ficha só (spec §2: duplicar polui prontuário, fatiar o texto por IA foi descartado).
  // `alertaNovo`/`ortoManutencao` são conteúdo de ficha sem outro lugar pra morar: se vierem
  // preenchidos, a ficha da sessão nasce mesmo numa visita que só concluiu pendência — perder
  // alerta de alergia é pior que uma ficha a mais.
  const criaFichaDaSessao =
    paraSessao.length > 0 ||
    porFicha.size === 0 ||
    input.alertaNovo != null ||
    input.ortoManutencao != null;

  // Sem ficha da sessão, o relato fica com a ficha absorvedora; sem absorção, com a que
  // recebeu mais procedimentos hoje. As demais recebem evolução automática.
  const principal: string | null = criaFichaDaSessao
    ? null
    : absorve
      ? destinoEscolhido
      : fichaComMaisEventos(porFicha, draft);

  return { fichaDaSessao, porFicha, paraSessao, criaFichaDaSessao, principal };
}

/** Empate resolvido pela ordem de aparição no draft — determinístico, nunca aleatório. */
function fichaComMaisEventos(
  porFicha: Map<string, OdontogramaEventoDraft[]>,
  draft: OdontogramaEventoDraft[],
): string {
  const primeiraAparicao = (fichaId: string) =>
    draft.findIndex((e) => (porFicha.get(fichaId) ?? []).some((p) => p.id === e.id));

  return [...porFicha.keys()].sort((a, b) => {
    const diff = (porFicha.get(b)?.length ?? 0) - (porFicha.get(a)?.length ?? 0);
    return diff !== 0 ? diff : primeiraAparicao(a) - primeiraAparicao(b);
  })[0];
}
