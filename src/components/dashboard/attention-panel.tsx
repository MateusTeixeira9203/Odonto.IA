'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, ChevronRight, ChevronDown, Forward } from 'lucide-react';
import { TIPO_LABEL, type TipoRegistroOdontograma } from '@/types/odontograma';

export interface OrcamentoResumido {
  id: string;
  total: number | null;
  paciente_id: string;
  paciente_nome: string;
}

export interface EncaminhadoResumido {
  id: string;
  tipo: TipoRegistroOdontograma;
  dente: number | null;
  paciente_id: string;
  paciente_nome: string;
}

interface AttentionPanelProps {
  semConfirmacao: number;
  orcamentosAguardando: OrcamentoResumido[];
  /** Registros planejados encaminhados a este dentista (R-04), ainda não concluídos. */
  encaminhados: EncaminhadoResumido[];
}

const linha = 'flex min-h-10 w-full items-center justify-between gap-3 px-6 py-3 text-left hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/20';
const detalhe = 'flex min-h-10 items-center justify-between gap-3 py-2.5 pl-10 pr-6 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal/20 max-[600px]:flex-wrap max-[600px]:pl-6';

interface ActionCardProps {
  title: string;
  subtitle: string;
  count: number;
  href: string;
}

function ActionCard({ title, subtitle, count, href }: ActionCardProps) {
  return (
    <Link href={href} className={linha}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[15px] font-medium text-text-primary"><AlertCircle className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />{title}</p>
        <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
      </div>
      <span className="flex shrink-0 items-center gap-3"><span className="font-mono text-[17px] text-warning-ink">{count}</span><ChevronRight className="h-4 w-4 text-text-secondary" aria-hidden="true" /></span>
    </Link>
  );
}

function OrcamentosCard({ orcamentos }: { orcamentos: OrcamentoResumido[] }) {
  const [aberto, setAberto] = useState(false);
  const listaId = useId();
  const count = orcamentos.length;
  if (count === 1) {
    const orc = orcamentos[0];
    return (
      <Link href={`/dashboard/pacientes/${orc.paciente_id}?tab=orcamentos`} className={linha}>
        <div className="min-w-0"><p className="text-[15px] font-medium text-text-primary">1 orçamento aguardando</p><p className="mt-0.5 break-words text-[12px] text-text-secondary">{orc.paciente_nome} · Pendente de aprovação</p></div>
        <span className="flex shrink-0 items-center gap-3"><span className="font-mono text-[17px] text-text-secondary">1</span><ChevronRight className="h-4 w-4 text-text-secondary" aria-hidden="true" /></span>
      </Link>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} aria-controls={listaId} className={linha}>
        <div className="min-w-0"><p className="flex items-center gap-2 text-[15px] font-medium text-text-primary"><Clock className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />{count} orçamentos aguardando</p><p className="mt-0.5 text-[12px] text-text-secondary">Pendente de aprovação</p></div>
        <span className="flex shrink-0 items-center gap-3"><span className="font-mono text-[17px] text-text-secondary">{count}</span><ChevronDown className={`h-4 w-4 text-text-secondary ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
      </button>
      {aberto && <ul id={listaId} className="divide-y divide-border border-t border-border">
        {orcamentos.map(orc => <li key={orc.id}><Link href={`/dashboard/pacientes/${orc.paciente_id}?tab=orcamentos`} className={detalhe}>
          <span className="min-w-0 break-words text-[15px] font-medium text-text-primary">{orc.paciente_nome}</span>
          <span className="ml-auto flex shrink-0 items-center gap-3">{orc.total != null && <span className="font-mono text-[12px] text-text-secondary">R$ {orc.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}<ChevronRight className="h-4 w-4 text-text-secondary" aria-hidden="true" /></span>
        </Link></li>)}
      </ul>}
    </div>
  );
}

/** Mesmo resumo do registro encaminhado, sem misturar os dados das fichas. */
function resumoEncaminhado(e: EncaminhadoResumido): string {
  return e.dente != null ? `${TIPO_LABEL[e.tipo]} · dente ${e.dente}` : TIPO_LABEL[e.tipo];
}

function EncaminhadosCard({ encaminhados }: { encaminhados: EncaminhadoResumido[] }) {
  const [aberto, setAberto] = useState(false);
  const listaId = useId();
  const count = encaminhados.length;
  if (count === 1) {
    const e = encaminhados[0];
    return (
      <Link href={`/dashboard/pacientes/${e.paciente_id}`} className={linha}>
        <div className="min-w-0"><p className="text-[15px] font-medium text-text-primary">1 procedimento encaminhado pra você</p><p className="mt-0.5 break-words text-[12px] text-text-secondary">{e.paciente_nome} · {resumoEncaminhado(e)}</p></div>
        <span className="flex shrink-0 items-center gap-3"><span className="font-mono text-[17px] text-text-secondary">1</span><ChevronRight className="h-4 w-4 text-text-secondary" aria-hidden="true" /></span>
      </Link>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} aria-controls={listaId} className={linha}>
        <div className="min-w-0"><p className="flex items-center gap-2 text-[15px] font-medium text-text-primary"><Forward className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />{count} procedimentos encaminhados pra você</p><p className="mt-0.5 text-[12px] text-text-secondary">Aguardando você</p></div>
        <span className="flex shrink-0 items-center gap-3"><span className="font-mono text-[17px] text-text-secondary">{count}</span><ChevronDown className={`h-4 w-4 text-text-secondary ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" /></span>
      </button>
      {aberto && <ul id={listaId} className="divide-y divide-border border-t border-border">
        {encaminhados.map(e => <li key={e.id}><Link href={`/dashboard/pacientes/${e.paciente_id}`} className={detalhe}>
          <span className="min-w-0 break-words text-[15px] font-medium text-text-primary">{e.paciente_nome}</span>
          <span className="ml-auto flex min-w-0 items-center gap-3"><span className="break-words text-[12px] text-text-secondary">{resumoEncaminhado(e)}</span><ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" /></span>
        </Link></li>)}
      </ul>}
    </div>
  );
}

export function AttentionPanel({ semConfirmacao, orcamentosAguardando, encaminhados }: AttentionPanelProps) {
  const hasOrc = orcamentosAguardando.length > 0;
  const hasEncaminhados = encaminhados.length > 0;
  const hasItems = semConfirmacao > 0 || hasOrc || hasEncaminhados;
  const itemCount = (semConfirmacao > 0 ? 1 : 0) + (hasOrc ? 1 : 0) + (hasEncaminhados ? 1 : 0);
  return (
    <section data-dashboard-atencao aria-labelledby="atencao-hoje-titulo" className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="atencao-hoje-titulo" className="text-[17px] font-bold text-text-primary">Atenção hoje</h2>
        {hasItems && <span className="rounded-[4px] bg-warning-pale px-1.5 py-0.5 font-mono text-[12px] text-warning-ink">{itemCount}</span>}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-surface">
        {hasItems ? <>
          {semConfirmacao > 0 && <ActionCard title={`${semConfirmacao} sem confirmação`} subtitle="Aguardando resposta do paciente" count={semConfirmacao} href="/dashboard/agendamentos" />}
          {hasOrc && <OrcamentosCard orcamentos={orcamentosAguardando} />}
          {hasEncaminhados && <EncaminhadosCard encaminhados={encaminhados} />}
        </> : <div className="px-6 py-[18px]"><p className="text-[15px] text-text-primary">Tudo em ordem.</p><p className="mt-1 text-[13px] text-text-secondary">Nenhuma pendência acionável hoje.</p></div>}
      </div>
    </section>
  );
}
