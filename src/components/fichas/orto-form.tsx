'use client';

// Form manual da manutenção ortodôntica (Roadmap A — Fatia A0, peça 3 do plugin).
// DESIGN: plans/specs/DESIGN-ficha-a0.md §4. Caminho SEM IA — o dentista digita
// direto. Campo vazio = null (não string vazia), coerente com o schema Zod (§2.7).

import type { PluginFormProps } from '@/lib/especialidades/plugin';
import type { OrtoManutencaoDetalhe } from '@/lib/especialidades/orto';

const ARCADAS: ReadonlyArray<{ v: OrtoManutencaoDetalhe['arcada']; label: string }> = [
  { v: 'superior', label: 'Superior' },
  { v: 'inferior', label: 'Inferior' },
  { v: 'ambas', label: 'Ambas' },
];

const VAZIO: OrtoManutencaoDetalhe = {
  arcada: 'superior',
  fio: null,
  ativacao: null,
  elastico_corrente: null,
  elastico_intermaxilar: null,
};

/** Texto do input → null quando vazio (o schema aceita null, não ''). */
const limpar = (s: string): string | null => (s.trim() === '' ? null : s);

export function OrtoForm({ valor, onChange, readOnly }: PluginFormProps<OrtoManutencaoDetalhe>) {
  const v = valor ?? VAZIO;
  const set = (patch: Partial<OrtoManutencaoDetalhe>) => onChange({ ...v, ...patch });

  const inputCls =
    'w-full bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-text-primary ' +
    'outline-none focus:border-teal disabled:opacity-60';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1.5';

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelCls} htmlFor="orto-arcada">Arcada</label>
        <select
          id="orto-arcada"
          className={inputCls}
          value={v.arcada}
          disabled={readOnly}
          onChange={(e) => set({ arcada: e.target.value as OrtoManutencaoDetalhe['arcada'] })}
        >
          {ARCADAS.map((a) => (
            <option key={a.v} value={a.v}>{a.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor="orto-fio">Arco / fio</label>
        <input id="orto-fio" className={inputCls} placeholder="ex: 0.018 aço" disabled={readOnly}
          value={v.fio ?? ''} onChange={(e) => set({ fio: limpar(e.target.value) })} />
      </div>

      <div>
        <label className={labelCls} htmlFor="orto-ativacao">Ativação</label>
        <input id="orto-ativacao" className={inputCls} placeholder="ex: ativado + troca de ligaduras" disabled={readOnly}
          value={v.ativacao ?? ''} onChange={(e) => set({ ativacao: limpar(e.target.value) })} />
      </div>

      <div>
        <label className={labelCls} htmlFor="orto-corrente">Elástico corrente</label>
        <input id="orto-corrente" className={inputCls} placeholder="ex: 13 → 23" disabled={readOnly}
          value={v.elastico_corrente ?? ''} onChange={(e) => set({ elastico_corrente: limpar(e.target.value) })} />
      </div>

      <div>
        <label className={labelCls} htmlFor="orto-intermaxilar">Elástico intermaxilar</label>
        <input id="orto-intermaxilar" className={inputCls} placeholder="ex: 3/16 Classe II, 13 → 46" disabled={readOnly}
          value={v.elastico_intermaxilar ?? ''} onChange={(e) => set({ elastico_intermaxilar: limpar(e.target.value) })} />
      </div>
    </div>
  );
}
