import type { MeuDiaPendencia } from '@/server/dashboard/get-meu-dia';
import type { MomentoPlanejado } from '@/types/odontograma';

export type GrupoPendenciaPlano = 'minha_fila' | 'recebida' | 'acompanhada';

export interface PermissoesPendenciaPlano {
  alterarMomento: boolean;
  registrarHoje: boolean;
  concluirEncaminhada: boolean;
  encaminhar: boolean;
}

export interface PendenciaPlanoView {
  pendencia: MeuDiaPendencia;
  grupo: GrupoPendenciaPlano;
  responsavelId: string;
  responsavelNome: string;
  momentoEfetivo: MomentoPlanejado;
  permissoes: PermissoesPendenciaPlano;
}

export interface PlanoTratamentoView {
  minhaFila: PendenciaPlanoView[];
  recebidas: PendenciaPlanoView[];
  acompanhadas: PendenciaPlanoView[];
  total: number;
}

export interface ProjetarPlanoTratamentoInput {
  pendencias: readonly MeuDiaPendencia[];
  meuDentistaId: string;
  idsEmRevisao: ReadonlySet<string>;
  momentosOtimistas: ReadonlyMap<string, MomentoPlanejado>;
  idsConcluidosOtimistas: ReadonlySet<string>;
}

const semPermissoes: PermissoesPendenciaPlano = {
  alterarMomento: false,
  registrarHoje: false,
  concluirEncaminhada: false,
  encaminhar: false,
};

function ordenarPorMomento(itens: PendenciaPlanoView[]): PendenciaPlanoView[] {
  return itens.sort((a, b) => {
    const ordemA = a.momentoEfetivo === 'proxima_sessao' ? 0 : 1;
    const ordemB = b.momentoEfetivo === 'proxima_sessao' ? 0 : 1;
    return ordemA - ordemB;
  });
}

/** Projeção única para plano, contador e pendências contextuais no histórico. */
export function projetarPlanoTratamento({
  pendencias,
  meuDentistaId,
  idsEmRevisao,
  momentosOtimistas,
  idsConcluidosOtimistas,
}: ProjetarPlanoTratamentoInput): PlanoTratamentoView {
  const minhaFila: PendenciaPlanoView[] = [];
  const recebidas: PendenciaPlanoView[] = [];
  const acompanhadas: PendenciaPlanoView[] = [];

  for (const pendencia of pendencias) {
    if (idsEmRevisao.has(pendencia.id) || idsConcluidosOtimistas.has(pendencia.id)) continue;

    const responsavelId = pendencia.encaminhadoParaId ?? pendencia.dentistaId;
    const responsavelNome = pendencia.encaminhadoParaNome ?? pendencia.dentistaNome;
    const momentoEfetivo = momentosOtimistas.get(pendencia.id) ?? pendencia.momentoPlanejado;
    const eMinha = responsavelId === meuDentistaId;
    const autorSouEu = pendencia.dentistaId === meuDentistaId;

    const grupo: GrupoPendenciaPlano = eMinha
      ? (autorSouEu ? 'minha_fila' : 'recebida')
      : 'acompanhada';
    const permissoes: PermissoesPendenciaPlano = grupo === 'minha_fila'
      ? { alterarMomento: true, registrarHoje: true, concluirEncaminhada: false, encaminhar: true }
      : grupo === 'recebida'
        ? { alterarMomento: false, registrarHoje: false, concluirEncaminhada: true, encaminhar: false }
        : semPermissoes;
    const item = { pendencia, grupo, responsavelId, responsavelNome, momentoEfetivo, permissoes };

    if (grupo === 'minha_fila') minhaFila.push(item);
    else if (grupo === 'recebida') recebidas.push(item);
    else acompanhadas.push(item);
  }

  ordenarPorMomento(minhaFila);
  ordenarPorMomento(recebidas);
  ordenarPorMomento(acompanhadas);

  return {
    minhaFila,
    recebidas,
    acompanhadas,
    total: minhaFila.length + recebidas.length + acompanhadas.length,
  };
}
