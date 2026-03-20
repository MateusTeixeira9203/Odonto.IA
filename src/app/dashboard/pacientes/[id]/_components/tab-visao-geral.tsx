'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, FileText, DollarSign, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/dentai';
import type { Orcamento } from '@/types/database';
import type { FichaResumida, PagamentoResumido, ProximaConsulta } from './paciente-detail-client';

interface Props {
  fichas: FichaResumida[];
  orcamentos: Orcamento[];
  pagamentos: PagamentoResumido[];
  proximaConsulta: ProximaConsulta;
  pacienteId: string;
}

function formatBRL(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function TabVisaoGeral({
  fichas,
  orcamentos,
  pagamentos,
  proximaConsulta,
  pacienteId,
}: Props): React.JSX.Element {
  const totalOrcado = orcamentos.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const totalPago = pagamentos
    .filter((p) => p.status === 'pago')
    .reduce((sum, p) => sum + p.valor, 0);
  const totalPendente = pagamentos
    .filter((p) => p.status === 'pendente')
    .reduce((sum, p) => sum + p.valor, 0);

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Próxima consulta */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-teal" />
            </div>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Próxima Consulta
            </p>
          </div>
          {proximaConsulta ? (
            <>
              <p className="font-sans text-base font-semibold text-text-primary">
                {format(new Date(proximaConsulta.data_hora), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="font-mono text-sm text-text-secondary">
                {format(new Date(proximaConsulta.data_hora), 'HH:mm')}
              </p>
            </>
          ) : (
            <p className="font-sans text-sm text-text-secondary">Nenhuma agendada</p>
          )}
        </div>

        {/* Financeiro — pago */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Total Pago
            </p>
          </div>
          <p className="font-mono text-base font-semibold text-text-primary">
            {formatBRL(totalPago)}
          </p>
          {totalPendente > 0 && (
            <p className="font-sans text-xs text-amber-600 dark:text-amber-400">
              {formatBRL(totalPendente)} pendente
            </p>
          )}
        </div>

        {/* Financeiro — orçado */}
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-teal" />
            </div>
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
              Total Orçado
            </p>
          </div>
          <p className="font-mono text-base font-semibold text-text-primary">
            {formatBRL(totalOrcado)}
          </p>
          <p className="font-sans text-xs text-text-secondary">
            {orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Últimas atividades */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary">
            Últimas Atividades
          </p>
          {fichas.length > 5 && (
            <p className="font-sans text-xs text-text-secondary">
              {fichas.length} fichas no total
            </p>
          )}
        </div>

        {fichas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <FileText className="w-8 h-8 text-text-muted" />
            <p className="font-sans text-sm text-text-secondary">Nenhuma ficha registrada</p>
            <Link
              href={`/dashboard/fichas/nova?paciente_id=${pacienteId}`}
              className="text-xs font-medium text-teal hover:text-teal-dark transition-colors"
            >
              Criar primeira ficha →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fichas.slice(0, 5).map((ficha) => (
              <Link
                key={ficha.id}
                href={`/dashboard/fichas/${ficha.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-alt/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-teal" />
                  </div>
                  <div>
                    <p className="font-sans text-sm font-medium text-text-primary">
                      {ficha.queixa_principal ?? 'Ficha clínica'}
                    </p>
                    <p className="font-mono text-xs text-text-secondary">
                      {format(new Date(ficha.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                </div>
                <Badge variant={ficha.status === 'aberta' ? 'warning' : 'success'}>
                  {ficha.status === 'aberta' ? 'Aberta' : 'Concluída'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
