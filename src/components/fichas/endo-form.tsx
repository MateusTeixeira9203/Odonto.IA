'use client';

// Form manual da odontometria endodôntica (Roadmap A — migration 106, peça 3 do plugin).
// DESIGN: a base é a tabela do artefato `ficha-dois-modos-2026-07-21-artefato.html` §02
// (nível "Detalhe"), espelhada aqui em modo edição. Regras herdadas do artefato:
//   · cabeçalho "Ficha endodôntica" com ponto teal
//   · números compactos, à direita, DM Mono tabular — nunca campos largos
//   · CT destacado em teal-ink
//   · obturação/cimento como RODAPÉ inline, não como dois campos de formulário
//   · campo não ditado numa linha JÁ preenchida = borda tracejada coral (I5: nunca inferido)
//
// Divergência consciente do artefato: a coluna "Referência" existe aqui e não lá. O artefato
// desenha o modo LEITURA (4 colunas); o ponto de referência é dado que o dentista dita
// ("referência na cúspide mésio-vestibular") e precisa de entrada — mas ocupa largura fixa,
// nunca `w-full` (era o que quebrava o layout).

import { Plus, X } from 'lucide-react';
import type { PluginFormProps } from '@/lib/especialidades/plugin';
import type { CanalDetalhe, EndoDetalhe } from '@/lib/especialidades/endo';

const CANAL_VAZIO: CanalDetalhe = {
  nome: '', referencia: null, comprimentoRaiz: null, limaInicial: null, limaFinal: null,
};

const VAZIO: EndoDetalhe = { canais: [{ ...CANAL_VAZIO, nome: 'Único' }], obturacao: null, cimento: null };

/** Nomes canônicos de canal — datalist acelera o preenchimento sem travar entrada livre. */
const NOMES_CANAL = ['Único', 'MV', 'MV2', 'DV', 'ML', 'DL', 'P', 'V', 'L', 'MB', 'DB'];

const limparTexto = (s: string): string | null => (s.trim() === '' ? null : s);
const limparNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));

/**
 * A linha já tem algum dado? Decide o destaque coral: numa linha em branco (recém-criada)
 * campo vazio é normal e não deve gritar; numa linha PARCIALMENTE preenchida, o vazio é
 * informação — "isto não foi ditado" — e é o que o artefato marca em coral tracejado.
 */
function linhaTemDado(c: CanalDetalhe): boolean {
  return c.referencia != null || c.comprimentoRaiz != null || c.limaInicial != null || c.limaFinal != null;
}

export function EndoForm({ valor, onChange, readOnly }: PluginFormProps<EndoDetalhe>) {
  const v = valor ?? VAZIO;

  const setCanal = (i: number, patch: Partial<CanalDetalhe>) => {
    onChange({ ...v, canais: v.canais.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };
  const addCanal = () => onChange({ ...v, canais: [...v.canais, { ...CANAL_VAZIO }] });
  const removeCanal = (i: number) => {
    if (v.canais.length <= 1) return; // sempre ao menos 1 linha
    onChange({ ...v, canais: v.canais.filter((_, idx) => idx !== i) });
  };

  const th = 'text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5';
  /** Célula numérica: compacta, à direita, mono tabular — igual ao `.cellin` do artefato. */
  const num = (faltando: boolean, destaque?: boolean) =>
    'w-[68px] bg-surface-alt rounded-md px-1.5 py-1 text-xs font-mono tabular-nums text-right ' +
    'outline-none focus:border-teal disabled:opacity-60 border ' +
    (faltando ? 'border-dashed border-coral ' : 'border-border ') +
    (destaque ? 'text-teal-ink font-bold' : 'text-text-primary');

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-ink">
        <span className="w-1.5 h-1.5 rounded-full bg-teal" aria-hidden="true" />
        Ficha endodôntica
      </p>

      <datalist id="nomes-canal">
        {NOMES_CANAL.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className={`${th} text-left pr-2`}>Canal</th>
              <th className={`${th} text-left pr-2`}>Referência</th>
              <th className={`${th} text-right pr-2`}>Raiz (mm)</th>
              <th className={`${th} text-right pr-2`}>Lima inicial</th>
              <th className={`${th} text-right`}>Lima final</th>
              {!readOnly && <th className="w-7" />}
            </tr>
          </thead>
          <tbody>
            {v.canais.map((c, i) => {
              const parcial = linhaTemDado(c);
              return (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <input
                      list="nomes-canal"
                      className="w-[76px] bg-surface-alt border border-border rounded-md px-2 py-1 text-xs font-semibold text-text-primary outline-none focus:border-teal disabled:opacity-60"
                      placeholder="MV" disabled={readOnly} value={c.nome}
                      onChange={(e) => setCanal(i, { nome: e.target.value })}
                      aria-label={`Nome do canal ${i + 1}`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      className={
                        'w-[150px] bg-surface-alt rounded-md px-2 py-1 text-xs text-text-primary ' +
                        'outline-none focus:border-teal disabled:opacity-60 border ' +
                        (parcial && c.referencia == null ? 'border-dashed border-coral' : 'border-border')
                      }
                      placeholder="Cúspide MV" disabled={readOnly} value={c.referencia ?? ''}
                      onChange={(e) => setCanal(i, { referencia: limparTexto(e.target.value) })}
                      aria-label={`Ponto de referência do canal ${i + 1}`}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <input
                      type="number" step="0.5" inputMode="decimal"
                      className={num(parcial && c.comprimentoRaiz == null)}
                      placeholder="—" disabled={readOnly} value={c.comprimentoRaiz ?? ''}
                      onChange={(e) => setCanal(i, { comprimentoRaiz: limparNum(e.target.value) })}
                      aria-label={`Comprimento da raiz do canal ${i + 1}`}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <input
                      className={num(parcial && c.limaInicial == null)}
                      placeholder="#15" disabled={readOnly} value={c.limaInicial ?? ''}
                      onChange={(e) => setCanal(i, { limaInicial: limparTexto(e.target.value) })}
                      aria-label={`Lima inicial do canal ${i + 1}`}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      className={num(parcial && c.limaFinal == null)}
                      placeholder="#35" disabled={readOnly} value={c.limaFinal ?? ''}
                      onChange={(e) => setCanal(i, { limaFinal: limparTexto(e.target.value) })}
                      aria-label={`Lima final do canal ${i + 1}`}
                    />
                  </td>
                  {!readOnly && (
                    <td className="py-1.5 pl-1">
                      <button
                        type="button" onClick={() => removeCanal(i)} disabled={v.canais.length <= 1}
                        className="p-1 rounded text-text-secondary hover:text-coral-ink disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Remover canal ${i + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button" onClick={addCanal}
          className="self-start flex items-center gap-1 text-[11px] font-semibold text-teal-ink hover:opacity-75"
        >
          <Plus className="w-3 h-3" /> Adicionar canal
        </button>
      )}

      {/* Rodapé inline — espelha o `.efoot` do artefato: rótulo fino, valor em destaque.
          Não são "campos de formulário" com label em cima; são a última linha da ficha. */}
      <div className="flex gap-4 flex-wrap items-baseline pt-1.5 border-t border-border">
        <label className="flex items-baseline gap-1.5 text-[11px] text-text-secondary">
          Obturação:
          <input
            disabled={readOnly}
            className="w-[150px] bg-surface-alt border border-border rounded-md px-2 py-1 text-[11px] font-semibold text-text-primary outline-none focus:border-teal disabled:opacity-60"
            placeholder="condensação lateral" value={v.obturacao ?? ''}
            onChange={(e) => onChange({ ...v, obturacao: limparTexto(e.target.value) })}
          />
        </label>
        <label className="flex items-baseline gap-1.5 text-[11px] text-text-secondary">
          Cimento:
          <input
            disabled={readOnly}
            className="w-[120px] bg-surface-alt border border-border rounded-md px-2 py-1 text-[11px] font-semibold text-text-primary outline-none focus:border-teal disabled:opacity-60"
            placeholder="AH Plus" value={v.cimento ?? ''}
            onChange={(e) => onChange({ ...v, cimento: limparTexto(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
