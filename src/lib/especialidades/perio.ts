// src/lib/especialidades/perio.ts
//
// Plugin de Periodontia — rastreio PSR/CPITN (R-08b).
// Spec: plans/specs/R-08b-rastreio-psr.md · Contrato clínico: plans/specs/R-08-contrato-clinico-perio.md
//
// O rastreio é o `detalhe` do evento tipo='exame_periodontal' (criado no R-08a), nível 'boca'.
// ZERO migration: a coluna `odontograma_eventos.detalhe` jsonb e o CHECK do tipo já existem no
// banco vivo, e a RPC salvar_eventos_odontograma já persiste `detalhe`.
//
// PSR mede SEXTANTE, não sítio — 6 números, não 192. Não calcula NIC: o rastreio não mede
// inserção clínica (I1/I2 do contrato não se aplicam aqui, só ao periograma completo do R-08c).

import { z } from 'zod';
import type { EspecialidadePlugin } from './plugin';
import { PsrForm } from '@/components/fichas/psr-form';
import { PsrCard } from '@/components/fichas/psr-card';

export const CODIGOS_PSR = [0, 1, 2, 3, 4] as const;
export type CodigoPSR = typeof CODIGOS_PSR[number];

/**
 * Os 6 sextantes em FDI. A ORDEM aqui é a de leitura da boca (S1→S6), não a de tela:
 * o layout visual (S1 S2 S3 / S6 S5 S4) mora no form/card, que seguem a convenção do
 * odontograma — direito do paciente à esquerda de quem olha.
 */
export const SEXTANTES = [
  { id: 's1', label: 'S1', descricao: 'Superior direito',  dentes: '18–14' },
  { id: 's2', label: 'S2', descricao: 'Anterior superior', dentes: '13–23' },
  { id: 's3', label: 'S3', descricao: 'Superior esquerdo', dentes: '24–28' },
  { id: 's4', label: 'S4', descricao: 'Inferior esquerdo', dentes: '38–34' },
  { id: 's5', label: 'S5', descricao: 'Anterior inferior', dentes: '43–33' },
  { id: 's6', label: 'S6', descricao: 'Inferior direito',  dentes: '48–44' },
] as const;

export type SextanteId = typeof SEXTANTES[number]['id'];
export const SEXTANTE_IDS = SEXTANTES.map((s) => s.id) as readonly SextanteId[];

export const sextanteSchema = z.object({
  /** null = ainda não avaliado. DISTINTO de 0 (avaliado, saudável) — invariante do R-08b. */
  codigo: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  /** "X" — sextante edêntulo. I10 (registro por exceção): ausente do JSON quando falso. */
  ausente: z.boolean().optional(),
  /** "*" — furca, mobilidade, problema mucogengival ou recessão ≥3,5mm. I10: esparso. */
  asterisco: z.boolean().optional(),
});
export type SextantePSR = z.infer<typeof sextanteSchema>;

export const psrDetalheSchema = z.object({
  psr: z.object({
    s1: sextanteSchema, s2: sextanteSchema, s3: sextanteSchema,
    s4: sextanteSchema, s5: sextanteSchema, s6: sextanteSchema,
  }),
});
export type PsrDetalhe = z.infer<typeof psrDetalheSchema>;

/** Estado inicial — 6 sextantes não avaliados. Fonte única (form e futuro extractor reusam). */
export const PSR_VAZIO: PsrDetalhe = {
  psr: {
    s1: { codigo: null }, s2: { codigo: null }, s3: { codigo: null },
    s4: { codigo: null }, s5: { codigo: null }, s6: { codigo: null },
  },
};

/** vazio → 0 → 1 → 2 → 3 → 4 → X → vazio; o asterisco é independente. */
export function cicloSextante(detalhe: PsrDetalhe | null, id: SextanteId): PsrDetalhe {
  const v = detalhe ?? PSR_VAZIO;
  const s = v.psr[id];
  const resto = s.asterisco ? { asterisco: true } : {};
  const next: SextantePSR = s.ausente
    ? { codigo: null, ...resto }
    : s.codigo === null
      ? { codigo: 0, ...resto }
      : s.codigo === 4
        ? { codigo: null, ausente: true, ...resto }
        : { codigo: (s.codigo + 1) as CodigoPSR, ...resto };
  return { psr: { ...v.psr, [id]: next } };
}

export function alternarAsterisco(detalhe: PsrDetalhe | null, id: SextanteId): PsrDetalhe {
  const v = detalhe ?? PSR_VAZIO;
  const s = v.psr[id];
  return { psr: { ...v.psr, [id]: { ...s, asterisco: s.asterisco ? undefined : true } } };
}

// ── Conclusão determinística ────────────────────────────────────────────────

export type ConclusaoPSR =
  | { tipo: 'sem_avaliacao' }
  | { tipo: 'sem_alteracao' }
  | { tipo: 'higiene' }
  | { tipo: 'calculo_margens' }
  | { tipo: 'periograma_sextante'; sextantes: SextanteId[] }
  | { tipo: 'periograma_boca'; motivo: 'codigo_4' | 'multiplos_3' };

/**
 * Deriva a conduta indicada dos 6 códigos. Função PURA, ZERO IA (I6 do contrato).
 *
 * Regra verificada em fonte (ADA/dentalcare, "Guidelines for Patient Management"):
 *   código 3 em 1 sextante  → periograma completo DAQUELE sextante
 *   código 3 em ≥2 sextantes → periograma completo de boca toda
 *   código 4 em qualquer     → periograma completo de boca toda
 *
 * Sextante ausente (edêntulo) não entra no cálculo — não há o que sondar.
 */
export function concluirPSR(d: PsrDetalhe): ConclusaoPSR {
  const avaliados = SEXTANTE_IDS
    .map((id) => ({ id, s: d.psr[id] }))
    .filter(({ s }) => !s.ausente && s.codigo !== null);

  if (avaliados.length === 0) return { tipo: 'sem_avaliacao' };

  if (avaliados.some(({ s }) => s.codigo === 4)) {
    return { tipo: 'periograma_boca', motivo: 'codigo_4' };
  }

  const comTres = avaliados.filter(({ s }) => s.codigo === 3).map(({ id }) => id);
  if (comTres.length >= 2) return { tipo: 'periograma_boca', motivo: 'multiplos_3' };
  if (comTres.length === 1) return { tipo: 'periograma_sextante', sextantes: comTres };

  const maximo = Math.max(...avaliados.map(({ s }) => s.codigo as number));
  if (maximo === 2) return { tipo: 'calculo_margens' };
  if (maximo === 1) return { tipo: 'higiene' };
  return { tipo: 'sem_alteracao' };
}

/** Texto da conclusão pro dentista. Separado de concluirPSR pra manter a lógica testável sem UI. */
export function textoConclusao(c: ConclusaoPSR): string {
  switch (c.tipo) {
    case 'sem_avaliacao':
      return 'Nenhum sextante avaliado ainda.';
    case 'sem_alteracao':
      return 'Sem alteração — prevenção e revisão do controle de placa.';
    case 'higiene':
      return 'Sangramento presente — orientação de higiene individualizada.';
    case 'calculo_margens':
      return 'Cálculo ou margem defeituosa — remoção e correção indicadas.';
    case 'periograma_sextante': {
      const nomes = c.sextantes
        .map((id) => SEXTANTES.find((s) => s.id === id)?.label ?? id)
        .join(', ');
      return `Periograma completo indicado no sextante ${nomes}.`;
    }
    case 'periograma_boca':
      return c.motivo === 'codigo_4'
        ? 'Periograma completo de boca toda indicado (código 4) — tratamento avançado necessário.'
        : 'Periograma completo de boca toda indicado (código 3 em 2+ sextantes).';
  }
}

/**
 * Sextantes com achado adicional (*). O asterisco NÃO muda a conduta — ele sinaliza condição
 * (furca, mobilidade, mucogengival, recessão ≥3,5mm) que o periograma vai detalhar.
 */
export function sextantesComAsterisco(d: PsrDetalhe): SextanteId[] {
  return SEXTANTE_IDS.filter((id) => d.psr[id].asterisco === true);
}

/** Cor semântica do código — mesma família dos chips de rotina. 0-1 teal · 2 warning · 3-4 coral. */
export function corDoCodigo(codigo: CodigoPSR): 'teal' | 'warning' | 'coral' {
  if (codigo >= 3) return 'coral';
  if (codigo === 2) return 'warning';
  return 'teal';
}

export const periodontiaPlugin: EspecialidadePlugin<PsrDetalhe> = {
  id: 'periodontia',
  label: 'Periodontia',
  // R-07: raspagem é tratamento perio (nível quadrante). R-08a: exame_periodontal é o rastreio.
  tiposEvento: ['raspagem', 'exame_periodontal'],
  // Metadado declarativo (nenhum código lê pra decidir). Descreve a persistência PRINCIPAL do
  // plugin — o periograma completo do R-08c. O rastreio mora no `detalhe` do evento; o R-08c
  // decide se o tipo passa a admitir duas formas. Ver spec R-08b, "Divergência conhecida".
  persistencia: { forma: 'tabela-satelite', tabela: 'perio_exames' },
  detalheSchema: psrDetalheSchema,
  extractor: { modo: 'deterministico' }, // I6 — zero LLM no caminho do número
  Form: PsrForm,
  Card: PsrCard,
  render: { pinta: true, camadas: ['selo'] },
};
