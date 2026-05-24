import Link from 'next/link';
import { Bell, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface AttentionPanelProps {
  semConfirmacao: number;
  orcamentosAguardando: number;
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  href: string;
  colorClass: string;
}

function AttentionItem({ icon: Icon, label, count, href, colorClass }: AttentionItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-2xl border border-border bg-surface hover:bg-surface-alt transition-colors"
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg shrink-0 ${colorClass}`}>
        {count}
      </span>
    </Link>
  );
}

export function AttentionPanel({ semConfirmacao, orcamentosAguardando }: AttentionPanelProps) {
  const hasItems = semConfirmacao > 0 || orcamentosAguardando > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-text-secondary" />
        <h2 className="font-heading text-xl text-text-primary">Atenção hoje</h2>
      </div>

      {hasItems ? (
        <div className="space-y-3">
          {semConfirmacao > 0 && (
            <AttentionItem
              icon={AlertCircle}
              label={`${semConfirmacao} sem confirmação`}
              count={semConfirmacao}
              href="/dashboard/agendamentos"
              colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          )}
          {orcamentosAguardando > 0 && (
            <AttentionItem
              icon={Clock}
              label={`${orcamentosAguardando} orçamento${orcamentosAguardando !== 1 ? 's' : ''} aguardando`}
              count={orcamentosAguardando}
              href="/dashboard/orcamentos"
              colorClass="bg-surface-alt text-text-secondary"
            />
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-teal mx-auto mb-2" />
          <p className="text-sm font-medium text-text-primary">Tudo em ordem hoje.</p>
          <p className="text-xs text-text-secondary mt-1">Nenhuma pendência acionável.</p>
        </div>
      )}
    </div>
  );
}
