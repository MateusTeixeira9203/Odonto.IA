// src/lib/especialidades/orto.ts
//
// Plugin de Ortodontia (Roadmap A — Fatia A0).
// Spec: plans/specs/spec-a0-fundacao-plugins-especialidade.md §2.7.
//
// Orto é o 1º plugin: prova o contrato SEM IA nova. Manutenção é registro de
// ARCADA, não de dente — não pinta o odontograma (render.pinta=false) e persiste
// como coluna JSONB em `fichas` (não como evento). O `detalheSchema` e a `detecta`
// entram já na A0 (a detecção precisa deles); Form/Card completos ficam pra Fase 3.

import { z } from 'zod';
import type { EspecialidadePlugin } from './plugin';
import { OrtoCard } from '@/components/fichas/orto-card';
import { OrtoForm } from '@/components/fichas/orto-form';

/** Espelha OrtoManutencaoInfo (src/types/odontograma.ts §1.5). Contrato de forma na escrita e no form manual. */
export const ortoManutencaoSchema = z.object({
  arcada: z.enum(['superior', 'inferior', 'ambas']),
  fio: z.string().trim().min(1).nullable(),
  ativacao: z.string().trim().min(1).nullable(),
  elastico_corrente: z.string().trim().min(1).nullable(),
  elastico_intermaxilar: z.string().trim().min(1).nullable(),
});
export type OrtoManutencaoDetalhe = z.infer<typeof ortoManutencaoSchema>;

export const ortoPlugin: EspecialidadePlugin<OrtoManutencaoDetalhe> = {
  id: 'ortodontia',
  label: 'Ortodontia',
  // Orto não emite evento de odontograma — a detecção é por sinal não-evento (detecta).
  tiposEvento: [],
  persistencia: { forma: 'ficha-coluna', coluna: 'orto_manutencao' },
  detalheSchema: ortoManutencaoSchema,
  // Sem IA nova: o pass 1 (formatar-evolucao) já extrai orto_manutencao. Nada a enriquecer no pass 2.
  extractor: null,
  Form: OrtoForm,
  Card: OrtoCard,
  render: { pinta: false },
  detecta: (evo) => evo.orto_manutencao != null,
};
