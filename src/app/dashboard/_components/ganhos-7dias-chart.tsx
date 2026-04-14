'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DayPoint } from '../financeiro/actions';

// ─── Tipos internos do Recharts ────────────────────────────────────────────

interface TooltipEntry {
  dataKey?: string;
  value?:   number;
}

interface TooltipPayload {
  active?:  boolean;
  payload?: TooltipEntry[];
  label?:   string;
}

interface Props {
  data: DayPoint[];
  hideValues?: boolean;
}

// ─── Tooltip personalizado ─────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, hideValues }: TooltipPayload & { hideValues?: boolean }) {
  if (!active || !payload?.length) return null;

  const receita  = payload.find(p => p.dataKey === 'receita')?.value  ?? 0;
  const despesas = payload.find(p => p.dataKey === 'despesas')?.value ?? 0;
  const saldo    = (receita as number) - (despesas as number);

  function fmt(v: number) {
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  const valStyle: React.CSSProperties = {
    filter: hideValues ? 'blur(5px)' : 'none',
    transition: 'filter 0.2s ease',
    userSelect: hideValues ? 'none' : 'auto',
  };

  return (
    <div className="rounded-2xl p-4 shadow-2xl text-white min-w-[160px]"
      style={{ background: 'rgba(13,13,13,0.95)', border: '1px solid rgba(47,156,133,0.2)' }}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
            <span className="text-xs text-zinc-300">Receita</span>
          </div>
          <span className="font-mono text-xs font-semibold text-teal" style={valStyle}>
            {fmt(receita as number)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-coral shrink-0" />
            <span className="text-xs text-white/70">Despesas</span>
          </div>
          <span className="font-mono text-xs font-semibold text-coral" style={valStyle}>
            {fmt(despesas as number)}
          </span>
        </div>
        <div className="h-px bg-white/10 my-1" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-zinc-400">Saldo</span>
          <span
            className={`font-mono text-xs font-bold ${saldo >= 0 ? 'text-teal' : 'text-coral'}`}
            style={valStyle}
          >
            {saldo < 0 ? '−' : '+'}{fmt(Math.abs(saldo))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function Ganhos7DiasChart({ data, hideValues = false }: Props) {
  if (data.every(d => d.receita === 0 && d.despesas === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500 text-sm font-mono">
        Nenhum dado nos últimos 7 dias.
      </div>
    );
  }

  /* Formata o eixo Y: quando privado, mostra pontinhos */
  function yFormatter(v: number): string {
    if (hideValues) return '•••';
    return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}>
        <defs>
          <linearGradient id="barReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2f9c85" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#2f9c85" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="barDespesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e57373" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#e57373" stopOpacity={0.35} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          vertical={false}
        />

        <XAxis
          dataKey="dia"
          tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}
          tickLine={false}
          axisLine={false}
        />

        <YAxis
          tickFormatter={yFormatter}
          tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'var(--font-mono, monospace)' }}
          tickLine={false}
          axisLine={false}
          width={hideValues ? 26 : 34}
        />

        <Tooltip
          content={<CustomTooltip hideValues={hideValues} />}
          cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 6 }}
        />

        <Bar dataKey="receita" name="Receita" fill="url(#barReceita)" radius={[6, 6, 0, 0]} maxBarSize={30}>
          {data.map((entry, index) => (
            <Cell
              key={`r-${index}`}
              fill={entry.dia === 'Hoje' ? '#2f9c85' : 'url(#barReceita)'}
              opacity={entry.dia === 'Hoje' ? 1 : 0.75}
            />
          ))}
        </Bar>

        <Bar dataKey="despesas" name="Despesas" fill="url(#barDespesas)" radius={[6, 6, 0, 0]} maxBarSize={30}>
          {data.map((entry, index) => (
            <Cell
              key={`d-${index}`}
              fill={entry.dia === 'Hoje' ? '#e57373' : 'url(#barDespesas)'}
              opacity={entry.dia === 'Hoje' ? 1 : 0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
