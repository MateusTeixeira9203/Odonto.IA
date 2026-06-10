'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, AlertCircle, Clock, ChevronRight, ChevronDown, User } from 'lucide-react';

export interface OrcamentoResumido {
  id: string;
  total: number | null;
  paciente_id: string;
  paciente_nome: string;
}

interface AttentionPanelProps {
  semConfirmacao: number;
  orcamentosAguardando: OrcamentoResumido[];
}

interface ActionCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  count: number;
  href: string;
  urgent?: boolean;
}

function ActionCard({ icon: Icon, title, subtitle, count, href, urgent }: ActionCardProps) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between p-6 rounded-3xl border transition-all hover:-translate-y-0.5 hover:shadow-md ${
        urgent
          ? 'border-amber-500/25 bg-amber-500/[0.04] hover:bg-amber-500/[0.07]'
          : 'border-border bg-surface hover:bg-surface-alt'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${urgent ? 'bg-amber-500/10' : 'bg-surface-alt'}`}>
          <Icon className={`w-5 h-5 ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`} />
        </div>
        <div>
          <p className={`text-sm font-semibold ${urgent ? 'text-amber-700 dark:text-amber-300' : 'text-text-primary'}`}>
            {title}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`font-mono text-3xl font-bold ${urgent ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
          {count}
        </span>
        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

function OrcamentosCard({ orcamentos }: { orcamentos: OrcamentoResumido[] }) {
  const [aberto, setAberto] = useState(false);
  const count = orcamentos.length;

  if (count === 1) {
    const orc = orcamentos[0];
    return (
      <Link
        href={`/dashboard/pacientes/${orc.paciente_id}?tab=orcamentos`}
        className="group flex items-center justify-between p-6 rounded-3xl border border-border bg-surface hover:bg-surface-alt transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-text-secondary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">1 orçamento aguardando</p>
            <p className="text-xs text-text-secondary mt-0.5">{orc.paciente_nome} · Pendente de aprovação</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-3xl font-bold text-text-secondary">1</span>
          <ChevronRight className="w-4 h-4 text-text-secondary group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between p-6 hover:bg-surface-alt transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-text-secondary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-text-primary">{count} orçamentos aguardando</p>
            <p className="text-xs text-text-secondary mt-0.5">Pendente de aprovação</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-3xl font-bold text-text-secondary">{count}</span>
          <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {aberto && (
        <div className="border-t border-border/60 divide-y divide-border/40">
          {orcamentos.map(orc => (
            <Link
              key={orc.id}
              href={`/dashboard/pacientes/${orc.paciente_id}?tab=orcamentos`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-surface-alt transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-text-secondary" />
                </div>
                <span className="text-sm font-medium text-text-primary">{orc.paciente_nome}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {orc.total != null && (
                  <span className="text-xs font-mono text-text-secondary">
                    R$ {orc.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-text-secondary/50 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttentionPanel({ semConfirmacao, orcamentosAguardando }: AttentionPanelProps) {
  const hasOrc = orcamentosAguardando.length > 0;
  const hasItems = semConfirmacao > 0 || hasOrc;
  const itemCount = (semConfirmacao > 0 ? 1 : 0) + (hasOrc ? 1 : 0);

  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <Bell className="w-4 h-4 text-text-secondary" />
        <h2 className="font-heading font-semibold text-xl text-text-primary">Atenção hoje</h2>
        {hasItems && (
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {itemCount}
          </span>
        )}
      </div>

      {hasItems ? (
        <div className={`grid gap-4 ${itemCount > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {semConfirmacao > 0 && (
            <ActionCard
              icon={AlertCircle}
              title={`${semConfirmacao} sem confirmação`}
              subtitle="Aguardando resposta do paciente"
              count={semConfirmacao}
              href="/dashboard/agendamentos"
              urgent
            />
          )}
          {hasOrc && <OrcamentosCard orcamentos={orcamentosAguardando} />}
        </div>
      ) : (
        <div className="bg-surface rounded-3xl border border-border p-10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-6 h-6 text-teal" />
          </div>
          <p className="font-heading font-semibold text-xl text-text-primary mb-1">Tudo em ordem.</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Nenhuma pendência acionável hoje.
          </p>
        </div>
      )}
    </div>
  );
}
