import Link from 'next/link';
import { Bell, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface AttentionPanelProps {
  semConfirmacao: number;
  orcamentosAguardando: number;
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
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            urgent ? 'bg-amber-500/10' : 'bg-surface-alt'
          }`}
        >
          <Icon
            className={`w-5 h-5 ${
              urgent ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'
            }`}
          />
        </div>
        <div>
          <p
            className={`text-sm font-semibold ${
              urgent ? 'text-amber-700 dark:text-amber-300' : 'text-text-primary'
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`font-mono text-3xl font-bold ${
            urgent ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'
          }`}
        >
          {count}
        </span>
        <ChevronRight className="w-4 h-4 text-text-secondary group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

export function AttentionPanel({ semConfirmacao, orcamentosAguardando }: AttentionPanelProps) {
  const hasItems = semConfirmacao > 0 || orcamentosAguardando > 0;
  const itemCount = (semConfirmacao > 0 ? 1 : 0) + (orcamentosAguardando > 0 ? 1 : 0);

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
        <div
          className={`grid gap-4 ${
            itemCount > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}
        >
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
          {orcamentosAguardando > 0 && (
            <ActionCard
              icon={Clock}
              title={`${orcamentosAguardando} orçamento${orcamentosAguardando !== 1 ? 's' : ''} aguardando`}
              subtitle="Pendente de aprovação"
              count={orcamentosAguardando}
              href="/dashboard/orcamentos"
            />
          )}
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
