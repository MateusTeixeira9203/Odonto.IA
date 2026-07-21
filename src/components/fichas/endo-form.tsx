'use client';

// Form manual da odontometria endodôntica (Roadmap A — migration 106, peça 3 do plugin).
// DESIGN: plans/specs/spec-106-detalhe-especialidade.md §5.1 (espelha a tabela do artefato §04/§05).
// Campo vazio = null (nunca inferido — invariante I5); CT sugerido é só placeholder visual,
// nunca preenche o valor sozinho.

import { Plus, X } from 'lucide-react';
import type { PluginFormProps } from '@/lib/especialidades/plugin';
import type { CanalDetalhe, EndoDetalhe } from '@/lib/especialidades/endo';

const CANAL_VAZIO: CanalDetalhe = {
  nome: '', referencia: null, comprimentoRaiz: null, ct: null, limaFinal: null,
};

const VAZIO: EndoDetalhe = { canais: [{ ...CANAL_VAZIO, nome: 'Único' }], obturacao: null, cimento: null };

const limparTexto = (s: string): string | null => (s.trim() === '' ? null : s);
const limparNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));

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

  const inputCls =
    'bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary font-mono ' +
    'tabular-nums text-right outline-none focus:border-teal disabled:opacity-60';
  const labelCls = 'text-[9px] font-bold uppercase tracking-wider text-text-secondary';

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[420px]">
          <thead>
            <tr>
              <th className={`${labelCls} text-left pb-1.5 pr-2`}>Canal</th>
              <th className={`${labelCls} text-left pb-1.5 pr-2`}>Referência</th>
              <th className={`${labelCls} text-right pb-1.5 pr-2`}>Raiz (mm)</th>
              <th className={`${labelCls} text-right pb-1.5 pr-2`}>CT (mm)</th>
              <th className={`${labelCls} text-right pb-1.5 pr-2`}>Lima final</th>
              {!readOnly && <th className="w-6" />}
            </tr>
          </thead>
          <tbody>
            {v.canais.map((c, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-1.5 pr-2">
                  <input
                    className="bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-teal disabled:opacity-60 w-20"
                    placeholder="MV" disabled={readOnly} value={c.nome}
                    onChange={(e) => setCanal(i, { nome: e.target.value })}
                    aria-label="Nome do canal"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    className="bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-teal disabled:opacity-60 w-full"
                    placeholder="Cúspide MV" disabled={readOnly} value={c.referencia ?? ''}
                    onChange={(e) => setCanal(i, { referencia: limparTexto(e.target.value) })}
                    aria-label="Ponto de referência"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number" step="0.5" className={`${inputCls} w-16`} placeholder="—" disabled={readOnly}
                    value={c.comprimentoRaiz ?? ''}
                    onChange={(e) => setCanal(i, { comprimentoRaiz: limparNum(e.target.value) })}
                    aria-label="Comprimento da raiz"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number" step="0.5"
                    className={`${inputCls} w-16 !text-teal-ink !font-bold`}
                    placeholder={c.comprimentoRaiz != null ? String(c.comprimentoRaiz - 1) : '—'}
                    disabled={readOnly} value={c.ct ?? ''}
                    onChange={(e) => setCanal(i, { ct: limparNum(e.target.value) })}
                    aria-label="Comprimento de trabalho"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    className={`${inputCls} w-16`} placeholder="#35" disabled={readOnly}
                    value={c.limaFinal ?? ''}
                    onChange={(e) => setCanal(i, { limaFinal: limparTexto(e.target.value) })}
                    aria-label="Lima final"
                  />
                </td>
                {!readOnly && (
                  <td className="py-1.5">
                    <button
                      type="button" onClick={() => removeCanal(i)} disabled={v.canais.length <= 1}
                      className="p-1 rounded text-text-secondary hover:text-coral-ink disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Remover canal"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
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

      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <label className={`${labelCls} block mb-1`} htmlFor="endo-obturacao">Obturação</label>
          <input
            id="endo-obturacao" disabled={readOnly}
            className="w-full bg-surface-alt border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-teal disabled:opacity-60"
            placeholder="condensação lateral" value={v.obturacao ?? ''}
            onChange={(e) => onChange({ ...v, obturacao: limparTexto(e.target.value) })}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className={`${labelCls} block mb-1`} htmlFor="endo-cimento">Cimento</label>
          <input
            id="endo-cimento" disabled={readOnly}
            className="w-full bg-surface-alt border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-teal disabled:opacity-60"
            placeholder="AH Plus" value={v.cimento ?? ''}
            onChange={(e) => onChange({ ...v, cimento: limparTexto(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
