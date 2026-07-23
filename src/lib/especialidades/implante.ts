// src/lib/especialidades/implante.ts
//
// Plugin de Implantodontia (Roadmap A — migration 106).
// Spec: plans/specs/spec-106-detalhe-especialidade.md §5.2.
//
// Campos pedidos pelo Mateus em 21/07: "nome do implante que vai usar, algumas
// informações técnicas". `lote` entra por rastreabilidade — implante tem recall,
// e o número do lote é o que permite localizar o paciente afetado.

import { z } from 'zod';
import type { EspecialidadePlugin } from './plugin';
import { ImplanteForm } from '@/components/fichas/implante-form';
import { ImplanteCard } from '@/components/fichas/implante-card';

export const implanteDetalheSchema = z.object({
  marca:       z.string().trim().max(40).nullable(),          // "Straumann", "Neodent"
  linha:       z.string().trim().max(40).nullable(),          // "BLT", "Grand Morse"
  diametro:    z.number().min(0).max(9).nullable(),           // mm — 4.1 (min saiu, R-01)
  comprimento: z.number().min(0).max(25).nullable(),          // mm — 10 (min(4) resetava ao digitar "10")
  plataforma:  z.enum(['cone_morse', 'hexagono_externo', 'hexagono_interno', 'outro']).nullable(),
  torque:      z.number().min(0).max(80).nullable(),          // Ncm de inserção
  carga:       z.enum(['imediata', 'precoce', 'tardia']).nullable(),
  lote:        z.string().trim().max(40).nullable(),
});
export type ImplanteDetalhe = z.infer<typeof implanteDetalheSchema>;

export const PLATAFORMA_LABEL: Record<NonNullable<ImplanteDetalhe['plataforma']>, string> = {
  cone_morse:        'Cone morse',
  hexagono_externo:  'Hexágono externo',
  hexagono_interno:  'Hexágono interno',
  outro:             'Outro',
};

export const CARGA_LABEL: Record<NonNullable<ImplanteDetalhe['carga']>, string> = {
  imediata: 'Imediata',
  precoce:  'Precoce',
  tardia:   'Tardia',
};

/** Sinal (nível 1) — "4.1 × 10" quando ambos existem; senão a marca; senão nada. */
export function sinalImplante(v: ImplanteDetalhe): string | null {
  if (v.diametro != null && v.comprimento != null) return `${v.diametro} × ${v.comprimento}`;
  return v.marca ?? null;
}

export const implantePlugin: EspecialidadePlugin<ImplanteDetalhe> = {
  id: 'implantodontia',
  label: 'Implantodontia',
  tiposEvento: ['implante'],
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: implanteDetalheSchema,
  extractor: null, // entrada manual — Dex hoje não emite marca/medidas de implante
  Form: ImplanteForm,
  Card: ImplanteCard,
  render: { pinta: true, camadas: ['raiz'] },
};
