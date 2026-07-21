'use client';

// Form manual de implante (Roadmap A — migration 106, peça 3 do plugin).
// DESIGN: plans/specs/spec-106-detalhe-especialidade.md §5.2.
// Campo vazio = null (nunca inferido — invariante I5).

import type { PluginFormProps } from '@/lib/especialidades/plugin';
import {
  PLATAFORMA_LABEL, CARGA_LABEL,
  type ImplanteDetalhe,
} from '@/lib/especialidades/implante';

const VAZIO: ImplanteDetalhe = {
  marca: null, linha: null, diametro: null, comprimento: null,
  plataforma: null, torque: null, carga: null, lote: null,
};

const limparTexto = (s: string): string | null => (s.trim() === '' ? null : s);
const limparNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function ImplanteForm({ valor, onChange, readOnly }: PluginFormProps<ImplanteDetalhe>) {
  const v = valor ?? VAZIO;
  const set = (patch: Partial<ImplanteDetalhe>) => onChange({ ...v, ...patch });

  const inputCls =
    'w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary ' +
    'outline-none focus:border-teal disabled:opacity-60';
  const numCls = inputCls + ' font-mono tabular-nums';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1.5';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls} htmlFor="impl-marca">Marca</label>
        <input id="impl-marca" className={inputCls} placeholder="ex: Straumann" disabled={readOnly}
          value={v.marca ?? ''} onChange={(e) => set({ marca: limparTexto(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-linha">Linha</label>
        <input id="impl-linha" className={inputCls} placeholder="ex: BLT" disabled={readOnly}
          value={v.linha ?? ''} onChange={(e) => set({ linha: limparTexto(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-diametro">Diâmetro (mm)</label>
        <input id="impl-diametro" type="number" step="0.1" className={numCls} placeholder="4.1" disabled={readOnly}
          value={v.diametro ?? ''} onChange={(e) => set({ diametro: limparNum(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-comprimento">Comprimento (mm)</label>
        <input id="impl-comprimento" type="number" step="0.5" className={numCls} placeholder="10" disabled={readOnly}
          value={v.comprimento ?? ''} onChange={(e) => set({ comprimento: limparNum(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-plataforma">Plataforma</label>
        <select id="impl-plataforma" className={inputCls} disabled={readOnly}
          value={v.plataforma ?? ''}
          onChange={(e) => set({ plataforma: (e.target.value || null) as ImplanteDetalhe['plataforma'] })}
        >
          <option value="">— não informado</option>
          {Object.entries(PLATAFORMA_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-torque">Torque de inserção (Ncm)</label>
        <input id="impl-torque" type="number" step="1" className={numCls} placeholder="35" disabled={readOnly}
          value={v.torque ?? ''} onChange={(e) => set({ torque: limparNum(e.target.value) })} />
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-carga">Protocolo de carga</label>
        <select id="impl-carga" className={inputCls} disabled={readOnly}
          value={v.carga ?? ''}
          onChange={(e) => set({ carga: (e.target.value || null) as ImplanteDetalhe['carga'] })}
        >
          <option value="">— não informado</option>
          {Object.entries(CARGA_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="impl-lote">Lote</label>
        <input id="impl-lote" className={inputCls} placeholder="rastreabilidade" disabled={readOnly}
          value={v.lote ?? ''} onChange={(e) => set({ lote: limparTexto(e.target.value) })} />
      </div>
    </div>
  );
}
