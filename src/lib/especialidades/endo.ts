// src/lib/especialidades/endo.ts
//
// Plugin de Endodontia (Roadmap A — migration 106).
// Spec: plans/specs/spec-106-detalhe-especialidade.md §5.1.
//
// A tabela de odontometria (canal por canal) é o `detalhe` do evento tipo='endodontia'
// (persistencia: 'evento-detalhe', coluna `odontograma_eventos.detalhe` jsonb — migration
// 106). Campo não ditado fica null, nunca inferido (invariante I5).

import { z } from 'zod';
import type { EspecialidadePlugin } from './plugin';
import { EndoForm } from '@/components/fichas/endo-form';
import { EndoCard } from '@/components/fichas/endo-card';

export const canalSchema = z.object({
  nome:            z.string().trim().max(24),               // "MV", "DV", "P", "Único" — vazio ok (R-01)
  referencia:       z.string().trim().max(40).nullable(),
  comprimentoRaiz:  z.number().min(0).max(40).nullable(),    // mm
  limaInicial:      z.string().trim().max(8).nullable(),     // "#15" — troca do CT (22/07)
  limaFinal:        z.string().trim().max(8).nullable(),     // "#35"
});
export type CanalDetalhe = z.infer<typeof canalSchema>;

export const endoDetalheSchema = z.object({
  canais:    z.array(canalSchema).min(1).max(6),
  obturacao: z.string().trim().max(60).nullable(),  // "condensação lateral"
  cimento:   z.string().trim().max(60).nullable(),  // "AH Plus"
});
export type EndoDetalhe = z.infer<typeof endoDetalheSchema>;

/** Sinal (nível 1 de densidade) — "3 canais". Nunca digitado, sempre derivado. */
export function sinalEndo(v: EndoDetalhe): string {
  return `${v.canais.length} canal${v.canais.length > 1 ? 'is' : ''}`;
}

export const endoPlugin: EspecialidadePlugin<EndoDetalhe> = {
  id: 'endodontia',
  label: 'Endodontia',
  tiposEvento: ['endodontia', 'lesao_periapical'],
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: endoDetalheSchema,
  extractor: null, // A1 futura — Dex hoje não emite odontometria; entrada é manual
  Form: EndoForm,
  Card: EndoCard,
  render: { pinta: true, camadas: ['raiz', 'selo'] },
};
