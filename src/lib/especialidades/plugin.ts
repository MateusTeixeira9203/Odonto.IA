// src/lib/especialidades/plugin.ts
//
// Contrato do plugin de especialidade (Roadmap A — Fatia A0).
// Fonte da verdade: plans/specs/spec-a0-fundacao-plugins-especialidade.md §2.1.
//
// Uma especialidade dente-ancorada é um contrato de 5 peças que se pluga num
// core que não muda (invariante I1). A0 registra os 8 plugins; A1/A2/A3 preenchem
// form/card/extractor de cada um. Nada aqui conhece uma especialidade específica.

import type { z } from 'zod';
import type { ComponentType } from 'react';
import type { TipoRegistroOdontograma } from '@/types/odontograma';

/** As 8 especialidades dente-ancoradas do artefato (§3–10). Fechado — 9ª = plugin novo, não item de roadmap. */
export type EspecialidadeId =
  | 'dentistica'      // Dentística / Clínico Geral (§3)
  | 'endodontia'      // §4
  | 'cirurgia'        // Cirurgia oral (§5)
  | 'implantodontia'  // §6
  | 'protese_fixa'    // §7
  | 'periodontia'     // §8
  | 'odontopediatria' // §9
  | 'ortodontia';     // §10 — manutenção mensal

// ── Peça 1 — dados / persistência (D1) ──────────────────────────
export type PersistenciaPlugin =
  | { forma: 'evento-detalhe' }                    // JSONB em odontograma_eventos.detalhe (endo)
  | { forma: 'tabela-satelite'; tabela: string }   // FK própria, série temporal (perio)
  | { forma: 'ficha-coluna'; coluna: string };     // coluna em fichas — dado POR-FICHA, não por-evento (orto)

// ── Peça 2 — extractor do pass 2 ────────────────────────────────
export interface ExtractorRequest {
  especialidade: EspecialidadeId;
  /** Relato ORIGINAL do dentista (não a saída do pass 1) — o extractor lê a narrativa crua. */
  texto: string;
  /** Contexto do pass 1: dentes que esta especialidade tocou (endo: dentes com canal). */
  contexto: { dentes: number[] };
}
export type ExtractorResult<TDetalhe> =
  | { ok: true; especialidade: EspecialidadeId; itens: Array<{ dente: number; detalhe: TDetalhe }> }
  | { ok: false; motivo: 'sem-extractor' | 'nada-extraido' | 'erro'; mensagem?: string };

/** IA pequena: schema forçado = o `detalheSchema` do plugin. Nunca infere campo não-dito (I5). */
export interface ExtractorIA<TDetalhe> {
  modo: 'ia';
  extrair(input: ExtractorRequest): Promise<ExtractorResult<TDetalhe>>;
}
/** Motor determinístico: ZERO LLM no caminho do dado (perio — I6). Roda na UI, não na rota de despacho. */
export interface ExtractorDeterministico {
  modo: 'deterministico';
}
export type ExtractorPlugin<TDetalhe> = ExtractorIA<TDetalhe> | ExtractorDeterministico | null;

// ── Peças 3/4 — form manual e card readOnly (props uniformes) ───
export interface PluginFormProps<TDetalhe> {
  valor: TDetalhe | null;
  onChange: (v: TDetalhe) => void;
  dente?: number;
  readOnly?: boolean;
}
export interface PluginCardProps<TDetalhe> {
  /** Card NUNCA recebe null — só é montado quando há dado (I2). */
  valor: TDetalhe;
  dente?: number;
}

// ── Peça 5 — render no odontograma ──────────────────────────────
export type PluginRender =
  | { pinta: false }                                                   // orto não pinta
  | { pinta: true; camadas: Array<'coroa' | 'raiz' | 'face' | 'selo'> };

/** Shape mínimo pra detecção — evita acoplar o registry ao tipo completo do pass 1. */
export interface EvolucaoDetectavel {
  odontograma_eventos: Array<{ tipo: TipoRegistroOdontograma }>;
  orto_manutencao: unknown | null;
}

// ── O contrato ──────────────────────────────────────────────────
export interface EspecialidadePlugin<TDetalhe = unknown> {
  id: EspecialidadeId;
  label: string;
  /** Eventos que este plugin possui — base da detecção default (D2) e do dispatch de render (peça 5). */
  tiposEvento: TipoRegistroOdontograma[];
  persistencia: PersistenciaPlugin;
  /** Zod do detalhe estruturado; null pra plugins cujo dado É o próprio evento (dentística/cirurgia). */
  detalheSchema: z.ZodType<TDetalhe> | null;
  extractor: ExtractorPlugin<TDetalhe>;
  Form: ComponentType<PluginFormProps<TDetalhe>> | null;
  Card: ComponentType<PluginCardProps<TDetalhe>> | null;
  render: PluginRender;
  /** Detecção: default = algum evento com tipo em `tiposEvento`. Override pra sinal não-evento (orto). */
  detecta?: (evo: EvolucaoDetectavel) => boolean;
}
