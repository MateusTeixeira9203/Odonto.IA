import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

import type { ClinicFinancialData } from '@/server/financeiro/clinica';
import { FixedCostsClient } from './fixed-costs-client';

export function FixedCostsPage({ basePath, data, mensagem }: { basePath: '/dashboard/meu-consultorio' | '/consultorio'; data: ClinicFinancialData | null; mensagem?: string }): React.JSX.Element {
  return <div className="space-y-6"><Link className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium text-text-primary hover:bg-surface-alt" href={`${basePath}/financeiro-clinica`}><ArrowLeft className="size-4" />Voltar ao financeiro da clínica</Link>{data?.podeGerirCustos ? <FixedCostsClient initialCosts={data.recorrencias} /> : <section role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-5 text-sm text-text-primary"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral" /><p>{mensagem ?? 'Você não tem permissão para alterar os custos fixos desta clínica.'}</p></div></section>}</div>;
}
