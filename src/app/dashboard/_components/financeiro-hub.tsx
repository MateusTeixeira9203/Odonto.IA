'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, TrendingUp, TrendingDown, CircleDollarSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Ganhos7DiasChart } from './ganhos-7dias-chart';
import type { DayPoint } from '../financeiro/actions';

type SaldoMes = { receita: number; despesas: number; saldo: number };

export function FinanceiroHub({
  saldoMes,
  chartData,
}: {
  saldoMes: SaldoMes;
  chartData: DayPoint[];
}) {
  const [privado, setPrivado] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('dentia:financeiro-privado') === 'true') setPrivado(true);
    } catch { /* SSR */ }
  }, []);

  function toggle() {
    const next = !privado;
    setPrivado(next);
    try { localStorage.setItem('dentia:financeiro-privado', String(next)); } catch { /* ignore */ }
  }

  function fmtNum(v: number) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  const valStyle: React.CSSProperties = {
    filter: privado ? 'blur(8px)' : 'none',
    transition: 'filter 0.25s ease',
    userSelect: privado ? 'none' : 'auto',
  };

  const lucroPositivo = saldoMes.saldo >= 0;

  return (
    <section>
      {/*
       * Container único horizontal — fundo flat semi-transparente para deixar
       * o NeuralBackground passar por trás (backdrop-blur cria o efeito glass).
       */}
      {/* Container: charcoal #0d0d0d, borda teal, blur xl — mesmo DNA da landing page */}
      <div
        className="rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{
          background: 'rgba(13, 13, 13, 0.90)',
          border: '1px solid rgba(47, 156, 133, 0.3)',
          boxShadow: '0 0 0 1px rgba(47,156,133,0.06), 0 24px 48px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(47,156,133,0.08)',
        }}
      >
        {/* ── Cabeçalho ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-teal/10">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
            </span>
            {/* DM Serif Display via font-heading */}
            <h2 className="font-heading text-white text-xl tracking-tight">
              Saúde Financeira
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal/35 hidden sm:block">
              — mês atual
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Olho de privacidade — ícone minimalista */}
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-teal/40 hover:text-teal transition-all"
              style={{ border: '1px solid rgba(47,156,133,0.2)' }}
              title={privado ? 'Revelar valores' : 'Ocultar valores'}
              aria-pressed={privado}
            >
              {privado ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            <Link
              href="/dashboard/financeiro"
              className="hidden sm:flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-teal/40 hover:text-teal transition-colors"
            >
              Detalhes <ArrowRight className="w-3 h-3 mt-px" />
            </Link>
          </div>
        </div>

        {/* ── Corpo: indicadores 35% | gráfico 65% ─────────────────── */}
        <div className="flex flex-col lg:flex-row divide-y divide-teal/[0.08] lg:divide-y-0 lg:divide-x lg:divide-teal/[0.08]">

          {/* Coluna esquerda — 3 KPIs sem card, apenas borda lateral */}
          <div className="lg:w-[35%] p-6 flex flex-col justify-between">

            {/* Total Bruto */}
            <div className="flex flex-col gap-1.5 pl-4 border-l-2 border-teal/50 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal/50">
                <TrendingUp className="w-3 h-3 text-teal" />
                Total Bruto
              </div>
              {/* DM Mono via font-mono */}
              <div className="font-mono text-2xl font-semibold text-white tracking-tight" style={valStyle}>
                <span className="text-teal text-sm mr-1">R$</span>
                {fmtNum(saldoMes.receita)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-teal/30">
                Pagamentos recebidos
              </div>
            </div>

            <div className="h-px bg-teal/[0.08]" />

            {/* Despesas — coral em vez de rose */}
            <div className="flex flex-col gap-1.5 pl-4 border-l-2 border-coral/40 py-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal/50">
                <TrendingDown className="w-3 h-3 text-coral" />
                Despesas
              </div>
              <div className="font-mono text-2xl font-semibold text-white tracking-tight" style={valStyle}>
                <span className="text-coral text-sm mr-1">R$</span>
                {fmtNum(saldoMes.despesas)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-teal/30">
                Lançamentos do mês
              </div>
            </div>

            <div className="h-px bg-teal/[0.08]" />

            {/* Lucro Líquido — teal micro-glow quando positivo */}
            <div className={`flex flex-col gap-1.5 pl-4 border-l-2 py-3 ${
              lucroPositivo ? 'border-teal' : 'border-coral/60'
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-teal/50">
                <CircleDollarSign className={`w-3 h-3 ${lucroPositivo ? 'text-teal' : 'text-coral'}`} />
                Lucro Líquido
              </div>
              <div
                className={`font-mono text-2xl font-semibold tracking-tight ${
                  lucroPositivo ? 'text-teal teal-glow' : 'text-coral'
                }`}
                style={privado ? valStyle : { ...valStyle, textShadow: lucroPositivo ? undefined : 'none' }}
              >
                {!lucroPositivo && <span className="text-base mr-0.5">−</span>}
                <span className="text-sm mr-1">R$</span>
                {fmtNum(Math.abs(saldoMes.saldo))}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-teal/30">
                Receita − Despesas
              </div>
            </div>

          </div>

          {/* Coluna direita — gráfico flutuante sem container extra */}
          <div className="lg:w-[65%] p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal/50 mb-0.5">
                  Fluxo de Caixa
                </p>
                <h3 className="font-sans text-sm font-semibold text-white/70">
                  Entradas vs Saídas — Últimos 7 dias
                </h3>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-teal shrink-0" style={{ borderRadius: 3 }} />
                  <span className="text-[10px] font-mono text-teal/40">Receita</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Coral legend dot */}
                  <span className="w-2 h-2 shrink-0" style={{ borderRadius: 3, background: 'var(--color-coral)' }} />
                  <span className="text-[10px] font-mono text-teal/40">Despesas</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[180px]">
              <Ganhos7DiasChart data={chartData} hideValues={privado} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
