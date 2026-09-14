import type {
  AncoraClinica,
  OdontogramaEventoInput,
  TipoRegistroOdontograma,
} from '@/types/odontograma';
import { ARCH_SUPERIOR, ARCH_INFERIOR, ARCH_COMPLETA, isQuadrante } from '@/lib/arcadas';
import type { ModoFormatacaoDex } from './classificar-status';

export interface ResultadoReconciliacaoDex {
  eventos: OdontogramaEventoInput[];
  adicionadosComoOutro: number;
  procedimentosSemCobertura: string[];
}

const ALIASES_POR_TIPO: Readonly<Record<TipoRegistroOdontograma, readonly string[]>> = {
  carie_restauracao: ['restauracao', 'restauracao com resina'],
  exodontia: ['extracao', 'exodontia'],
  endodontia: ['canal', 'tratamento de canal', 'tratamento endodontico', 'endodontia'],
  lesao_periapical: ['lesao periapical'],
  implante: ['implante'],
  coroa: ['coroa', 'coroa total'],
  ponte: ['ponte', 'protese fixa'],
  selante: ['selante'],
  inclusao: ['inclusao', 'dente incluso', 'dente impactado'],
  esfoliacao: ['esfoliacao'],
  fratura: ['fratura'],
  pino_nucleo: ['pino', 'nucleo'],
  profilaxia: ['profilaxia', 'limpeza'],
  raspagem: ['raspagem', 'alisamento radicular'],
  clareamento: ['clareamento'],
  fluor: ['fluor', 'aplicacao de fluor'],
  exame_periodontal: ['exame periodontal'],
  outro: [],
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A frase precisa aparecer como palavras completas, nunca como fragmento solto. */
function contemFrase(texto: string, frase: string): boolean {
  const normalizado = normalizar(texto);
  const alvo = normalizar(frase);
  return normalizado === alvo
    || normalizado.startsWith(`${alvo} `)
    || normalizado.endsWith(` ${alvo}`)
    || normalizado.includes(` ${alvo} `);
}

/** Remove apenas variações de redação; remoção, material e etapa continuam significativos. */
function palavrasDoProcedimento(texto: string): string[] {
  return normalizar(texto)
    .replace(/^(?:instalacao|confeccao|realizacao) (?:de |do |da |dos |das )?/, '')
    .replace(/\b(?:tratamento de canal|tratamento endodontico|canal)\b/g, 'endodontia')
    .replace(/\bextracao\b/g, 'exodontia')
    .replace(/\bimplantes\b/g, 'implante')
    .replace(/\bproteses\b/g, 'protese')
    .split(' ')
    .filter((palavra) => palavra && !['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas'].includes(palavra));
}

function nomeCobreProcedimento(nome: string, procedimento: string): boolean {
  const palavras = new Set(palavrasDoProcedimento(nome));
  const alvo = palavrasDoProcedimento(procedimento);
  return alvo.length > 0 && alvo.every((palavra) => palavras.has(palavra));
}

function eventoCobreProcedimento(procedimento: string, evento: OdontogramaEventoInput): boolean {
  const nome = evento.procedimentoNome?.trim() || (evento.tipo === 'outro' ? evento.observacao.trim() : '');
  // Um título explícito tem precedência sobre o enum visual: "coroa" não pode esconder
  // a falta de uma coroa definitiva quando só a provisória foi extraída.
  if (nome) return nomeCobreProcedimento(nome, procedimento);
  return ALIASES_POR_TIPO[evento.tipo].some((alias) => contemFrase(procedimento, alias));
}

function dentesDoProcedimento(
  procedimento: string,
  dentesObservacoes: Readonly<Record<string, string>>,
): number[] {
  return Object.entries(dentesObservacoes)
    .filter(([, observacao]) => observacao.split('\n').some((linha) => nomeCobreProcedimento(linha, procedimento)))
    .map(([dente]) => Number(dente))
    .filter((dente) => Number.isInteger(dente));
}

function mesmaRegiao(ancora: AncoraClinica, evento: OdontogramaEventoInput): boolean {
  if (ancora.nivel === 'dente') return ancora.dente === evento.ancora.dente;
  return ancora.nivel === evento.ancora.nivel
    && ancora.arcada === evento.ancora.arcada
    && ancora.quadrante === evento.ancora.quadrante;
}

function ancoraDoNumero(numero: number): AncoraClinica | null {
  if (numero === ARCH_SUPERIOR) return { nivel: 'arcada', arcada: 'superior' };
  if (numero === ARCH_INFERIOR) return { nivel: 'arcada', arcada: 'inferior' };
  if (numero === ARCH_COMPLETA) return { nivel: 'boca' };
  if (isQuadrante(numero)) return { nivel: 'quadrante', quadrante: (numero - 90) as 1 | 2 | 3 | 4 };
  const quadrante = Math.floor(numero / 10);
  const posicao = numero % 10;
  const maximo = quadrante >= 1 && quadrante <= 4 ? 8 : quadrante >= 5 && quadrante <= 8 ? 5 : 0;
  return posicao >= 1 && posicao <= maximo ? { nivel: 'dente', dente: numero } : null;
}

export function reconciliarProcedimentosDex(input: {
  procedimentos: readonly string[];
  eventos: readonly OdontogramaEventoInput[];
  dentesObservacoes: Readonly<Record<string, string>>;
  modo: ModoFormatacaoDex;
}): ResultadoReconciliacaoDex {
  const eventos = [...input.eventos];
  const vistos = new Set<string>();
  const procedimentos = input.procedimentos.filter((procedimento) => {
    const chave = normalizar(procedimento);
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  const semCobertura: string[] = [];

  for (const procedimento of procedimentos) {
    const cobertura = eventos.filter((evento) => eventoCobreProcedimento(procedimento, evento));
    const regioes = dentesDoProcedimento(procedimento, input.dentesObservacoes)
      .map(ancoraDoNumero).filter((ancora): ancora is AncoraClinica => ancora !== null);
    const ancoras = regioes.length > 0
      ? regioes.filter((ancora) => !cobertura.some((evento) => mesmaRegiao(ancora, evento)))
      : cobertura.length === 0 ? [{ nivel: 'geral' } satisfies AncoraClinica] : [];
    if (ancoras.length === 0) continue;
    semCobertura.push(procedimento);
    const grupoId = ancoras.length > 1 ? crypto.randomUUID() : null;

    for (const ancora of ancoras) {
      eventos.push({
        tipo: 'outro',
        procedimentoId: null,
        procedimentoNome: procedimento.trim(),
        status: 'indicado',
        origem: input.modo === 'exame_inicial' ? 'preexistente' : 'clinica',
        momento_planejado: 'sessao_atual',
        ancora,
        grupo_id: grupoId,
        papel_no_grupo: null,
        observacao: '',
        evidencia_status: 'ambiguo',
        revisar_status: true,
      });
    }
  }

  return {
    eventos,
    adicionadosComoOutro: eventos.length - input.eventos.length,
    procedimentosSemCobertura: semCobertura,
  };
}
