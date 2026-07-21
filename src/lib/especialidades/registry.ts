// src/lib/especialidades/registry.ts
//
// Registry de plugins de especialidade + detecção (Roadmap A — Fatia A0).
// Spec: plans/specs/spec-a0-fundacao-plugins-especialidade.md §2.2.
//
// A0 registra os 8 plugins. Orto vem completo (metadados+detecção; form/card na
// Fase 3); os outros 7 entram com metadados mínimos (id/label/tiposEvento/
// persistencia/render) — A1/A2/A3 preenchem detalheSchema/extractor/Form/Card.
// A detecção (especialidadesDetectadas) é determinística: sai dos eventos do
// pass 1, nunca de um campo preenchido por LLM (D2 / invariante I3).

import type { EspecialidadePlugin, EspecialidadeId, EvolucaoDetectavel } from './plugin';
import type { TipoRegistroOdontograma } from '@/types/odontograma';
import { ortoPlugin } from './orto';
import { endoPlugin } from './endo';
import { implantePlugin } from './implante';

// ── Os 7 plugins de metadados mínimos (A0). Cada um ganha detalheSchema/
//    extractor/Form/Card na sua fatia. `render.camadas` é a intenção de pintura;
//    o consumo de render é da Fatia 4 (ficha), não da detecção. ─────────────

const dentisticaPlugin: EspecialidadePlugin = {
  id: 'dentistica',
  label: 'Dentística / Clínico Geral',
  tiposEvento: ['carie_restauracao', 'selante', 'fratura', 'pino_nucleo'],
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: null, // o dado É o próprio evento — sem detalhe estruturado na A0
  extractor: null,
  Form: null,
  Card: null,
  render: { pinta: true, camadas: ['face', 'coroa', 'raiz'] },
};

const cirurgiaPlugin: EspecialidadePlugin = {
  id: 'cirurgia',
  label: 'Cirurgia oral',
  tiposEvento: ['exodontia', 'inclusao'],
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: null,
  extractor: null,
  Form: null,
  Card: null,
  render: { pinta: true, camadas: ['coroa'] },
};

const proteseFixaPlugin: EspecialidadePlugin = {
  id: 'protese_fixa',
  label: 'Prótese fixa',
  tiposEvento: ['coroa', 'ponte'],
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: null,
  extractor: null,
  Form: null,
  Card: null,
  render: { pinta: true, camadas: ['coroa'] },
};

const periodontiaPlugin: EspecialidadePlugin = {
  id: 'periodontia',
  label: 'Periodontia',
  // Perio não emite tipo de evento próprio — o selo âmbar deriva do exame. A detecção
  // (exame presente) e o motor determinístico entram na A2.
  tiposEvento: [],
  persistencia: { forma: 'tabela-satelite', tabela: 'perio_exames' },
  detalheSchema: null,
  extractor: null, // A2: motor determinístico (zero LLM — I6)
  Form: null,
  Card: null,
  render: { pinta: true, camadas: ['selo'] },
};

const odontopediatriaPlugin: EspecialidadePlugin = {
  id: 'odontopediatria',
  label: 'Odontopediatria',
  tiposEvento: ['esfoliacao'], // decíduos usam o mesmo catálogo; esfoliação é o tipo próprio (A3)
  persistencia: { forma: 'evento-detalhe' },
  detalheSchema: null,
  extractor: null,
  Form: null,
  Card: null,
  render: { pinta: true, camadas: ['coroa'] },
};

/**
 * Plugin com o TDetalhe apagado — a forma que o registry armazena (tipo existencial).
 * Necessário porque `Form`/`onChange` são contravariantes em TDetalhe: um plugin com
 * detalhe concreto (orto) não é assignable a um array de `<unknown>` sem apagar o tipo.
 */
export type PluginRegistrado = EspecialidadePlugin<unknown>;

/**
 * Apaga o TDetalhe pra registrar. SEGURO: o registry só lê id/tiposEvento/detecta/
 * persistencia/render — nunca invoca Form/Card/extractor por este tipo. O TDetalhe
 * concreto só importa quando a ficha renderiza um plugin específico (Fase 3+), onde
 * o plugin é resolvido por id com seu tipo real.
 */
const registrar = <T>(p: EspecialidadePlugin<T>): PluginRegistrado => p as PluginRegistrado;

/** Todos os plugins registrados. Orto é o único com detecção/persistência reais na A0. */
export const PLUGINS: PluginRegistrado[] = [
  registrar(dentisticaPlugin),
  registrar(endoPlugin),
  registrar(cirurgiaPlugin),
  registrar(implantePlugin),
  registrar(proteseFixaPlugin),
  registrar(periodontiaPlugin),
  registrar(odontopediatriaPlugin),
  registrar(ortoPlugin),
];

/** tipo de evento → plugin dono. Construído uma vez; assert de unicidade (um tipo, um dono). */
const DONO_DO_TIPO: Map<TipoRegistroOdontograma, EspecialidadeId> = (() => {
  const m = new Map<TipoRegistroOdontograma, EspecialidadeId>();
  for (const p of PLUGINS) {
    for (const t of p.tiposEvento) {
      if (m.has(t)) throw new Error(`[registry] tipo "${t}" reivindicado por 2 plugins (${m.get(t)} e ${p.id})`);
      m.set(t, p.id);
    }
  }
  return m;
})();

/** Plugin dono de um tipo de evento (null se nenhum reivindica — ex: 'ponte' antes da A3 ligar prótese). */
export function pluginDoTipo(tipo: TipoRegistroOdontograma): EspecialidadeId | null {
  return DONO_DO_TIPO.get(tipo) ?? null;
}

const POR_ID: Map<EspecialidadeId, PluginRegistrado> = new Map(PLUGINS.map((p) => [p.id, p]));

/** Resolve um plugin pelo id (aceita string crua — valida o enum). null se desconhecido. */
export function pluginPorId(id: string): PluginRegistrado | null {
  return POR_ID.get(id as EspecialidadeId) ?? null;
}

/**
 * D2 / I3 — detecção determinística: quais especialidades um relato contém.
 * Eventos (via tiposEvento) + sinais não-evento (orto via detecta). Zero LLM,
 * zero campo novo no schema do Gemini. O conjunto detectado dispara quais
 * extractors do pass 2 rodam (nenhum na A0).
 */
export function especialidadesDetectadas(evo: EvolucaoDetectavel): EspecialidadeId[] {
  const set = new Set<EspecialidadeId>();
  for (const ev of evo.odontograma_eventos) {
    const dono = DONO_DO_TIPO.get(ev.tipo);
    if (dono) set.add(dono);
  }
  for (const p of PLUGINS) {
    if (p.detecta?.(evo)) set.add(p.id);
  }
  return [...set];
}
