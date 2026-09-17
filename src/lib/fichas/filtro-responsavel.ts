/**
 * R-16 — Filtro por responsável na ficha.
 *
 * Responsável de um registro = `encaminhado_para ?? autor da ficha`. É **display puro**:
 * quem vê o quê. Nunca é a autoria legal (o PDF/prontuário exportado mostra `dentista_id`
 * + CRO + assinatura, jamais este derivado). Lógica separada do componente pra ser testável
 * sem login — a verificação na tela é barrada nesta sessão.
 */

/** Registro na ótica do filtro. A autoria por evento é necessária quando uma ficha
 * compartilhada recebe um novo procedimento de outro dentista. */
export interface RegistroResponsavel {
  encaminhadoPara: { id: string; nome: string } | null;
  /** Autor do evento; ausente nos dados legados, que continuam usando o autor da ficha. */
  autorId?: string | null;
  autorNome?: string | null;
}

/** Ficha na ótica do filtro. Sem eventos, a ficha inteira responde ao autor. */
export interface FichaResponsavel<E extends RegistroResponsavel> {
  /** Autor da ficha — responsável default de todo registro não encaminhado. */
  autorId: string;
  autorNome: string;
  eventos: E[];
}

/** null = Todos · 'me' = Meus · senão um `dentista.id`. */
export type FiltroResponsavel = string | null;

/** Marcador de "Meus" — evita colisão com um id de dentista real. */
export const FILTRO_MEUS = 'me';

/** Um responsável passa o filtro ativo? */
export function responsavelPassaFiltro(
  responsavelId: string,
  filtro: FiltroResponsavel,
  meuId: string,
): boolean {
  if (filtro === null) return true;
  if (filtro === FILTRO_MEUS) return responsavelId === meuId;
  return responsavelId === filtro;
}

/**
 * Responsáveis distintos presentes nas fichas do paciente — alimenta os chips.
 * Dedup por id, preservando a 1ª ocorrência. Um registro encaminhado conta pro
 * DESTINO (não pro autor); sem encaminhamento, usa o autor do próprio evento e só então
 * o autor da ficha. Ficha sem eventos conta pro autor da ficha.
 */
export function derivarResponsaveis<E extends RegistroResponsavel>(
  fichas: FichaResponsavel<E>[],
): { id: string; nome: string }[] {
  const m = new Map<string, string>();
  for (const f of fichas) {
    if (f.eventos.length > 0) {
      for (const ev of f.eventos) {
        m.set(
          ev.encaminhadoPara?.id ?? ev.autorId ?? f.autorId,
          ev.encaminhadoPara?.nome ?? ev.autorNome ?? f.autorNome,
        );
      }
    } else {
      m.set(f.autorId, f.autorNome);
    }
  }
  return [...m].map(([id, nome]) => ({ id, nome }));
}

/**
 * Eventos de uma ficha que sobrevivem ao filtro. `filtro === null` devolve a mesma
 * referência (Todos = sem trabalho). Preserva a ordem de entrada (compõe com o
 * abertos-primeiro do R-02, que ordena depois).
 */
export function eventosVisiveis<E extends RegistroResponsavel>(
  eventos: E[],
  autorId: string,
  filtro: FiltroResponsavel,
  meuId: string,
): E[] {
  if (filtro === null) return eventos;
  return eventos.filter((ev) => responsavelPassaFiltro(
    ev.encaminhadoPara?.id ?? ev.autorId ?? autorId,
    filtro,
    meuId,
  ));
}

/**
 * A ficha tem algum registro que passa o filtro? Se não, colapsa da timeline (#8).
 * Ficha sem eventos responde ao autor (a ficha inteira é dele).
 */
export function fichaVisivel<E extends RegistroResponsavel>(
  ficha: FichaResponsavel<E>,
  filtro: FiltroResponsavel,
  meuId: string,
): boolean {
  if (filtro === null) return true;
  if (ficha.eventos.length > 0) {
    return ficha.eventos.some((ev) =>
      responsavelPassaFiltro(ev.encaminhadoPara?.id ?? ev.autorId ?? ficha.autorId, filtro, meuId),
    );
  }
  return responsavelPassaFiltro(ficha.autorId, filtro, meuId);
}

/**
 * O filtro selecionado ainda corresponde a alguém? (Achado real na auditoria 24/07,
 * R-18.) Se o responsável escolhido deixa de existir — ex.: desfez o único
 * encaminhamento cruzado enquanto filtrado nele — os chips somem (regra "solo não
 * mostra chip", só 1 responsável sobra) mas `filtroResponsavel` continuava preso
 * nesse id inválido: nada passava, a ficha renderizava vazia, e não sobrava nenhum
 * controle na tela pra voltar a "Todos" (só reload). O chamador reseta pra `null`
 * quando isto der falso.
 */
export function filtroAindaValido(
  filtro: FiltroResponsavel,
  responsaveis: { id: string }[],
  meuId: string,
): boolean {
  if (filtro === null) return true;
  if (filtro === FILTRO_MEUS) return responsaveis.some((r) => r.id === meuId);
  return responsaveis.some((r) => r.id === filtro);
}
