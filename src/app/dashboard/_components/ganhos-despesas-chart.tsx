'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ChartPoint } from '../financeiro/actions';

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

// ─── Tooltip personalizado ─────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload?.length) return null;

  const receita  = payload.find(p => p.dataKey === 'receita')?.value  ?? 0;
  const despesas = payload.find(p => p.dataKey === 'despesas')?.value ?? 0;
  const saldo    = (receita as number) - (despesas as number);

  function fmt(v: number) {
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  return (
    <div className="rounded-2xl p-4 shadow-2xl text-white min-w-[160px]"
      style={{ background: 'rgba(13,13,13,0.95)', border: '1px solid rgba(47,156,133,0.2)' }}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal shrink-0" />
            <span className="text-xs text-white/70">Receita</span>
          </div>
          <span className="font-mono text-xs font-semibold text-teal">{fmt(receita as number)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-coral shrink-0" />
            <span className="text-xs text-white/70">Despesas</span>
          </div>
          <span className="font-mono text-xs font-semibold text-coral">{fmt(despesas as number)}</span>
        </div>
        <div className="h-px bg-white/10 my-1" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-white/40">Saldo</span>
          <span className={`font-mono text-xs font-bold ${saldo >= 0 ? 'text-teal' : 'text-coral'}`}>
            {saldo < 0 ? '−' : '+'}{fmt(Math.abs(saldo))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  data: ChartPoint[];
}

export function GanhosDespesasChart({ data }: Props) {
  if (data.every(d => d.receita === 0 && d.despesas === 0)) {
    return (
      <div className="h-48 flex items-center justify-center text-[--color-gray-md] text-sm">
        Sem dados financeiros ainda para exibir o gráfico.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradientes */}
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#2f9c85" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2f9c85" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#e57373" stopOpacity={0.20} />
            <stop offset="95%" stopColor="#e57373" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />

        <XAxis
          dataKey="mes"
          tick={{ fill: '#8a8a8a', fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}
          tickLine={false}
          axisLine={false}
        />

        <YAxis
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#8a8a8a', fontSize: 10, fontFamily: 'var(--font-mono, monospace)' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />

        <Area
          type="monotone"
          dataKey="receita"
          name="Receita"
          stroke="#2f9c85"
          strokeWidth={2}
          fill="url(#gradReceita)"
          dot={false}
          activeDot={{ r: 4, fill: '#2f9c85', strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="despesas"
          name="Despesas"
          stroke="#e57373"
          strokeWidth={2}
          fill="url(#gradDespesas)"
          dot={false}
          activeDot={{ r: 4, fill: '#e57373', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
