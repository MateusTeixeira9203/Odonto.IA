'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Receipt, ChevronRight, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/dentai';
import type { Orcamento } from '@/types/database';

interface Props {
  orcamentos: Orcamento[];
  pacienteId: string;
}

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', variant: 'gray' as const },
  enviado:  { label: 'Enviado',  variant: 'teal' as const },
  aprovado: { label: 'Aprovado', variant: 'success' as const },
  recusado: { label: 'Recusado', variant: 'error' as const },
};

function formatBRL(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function TabOrcamentos({ orcamentos, pacienteId }: Props): React.JSX.Element {
  const [detalheAberto, setDetalheAberto] = useState<Orcamento | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-text-secondary">
          {orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''}
        </p>
        <Link
          href={`/dashboard/fichas/nova?paciente_id=${pacienteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Orçamento
        </Link>
      </div>

      {orcamentos.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-3 py-14">
          <Receipt className="w-10 h-10 text-text-muted" />
          <div className="text-center">
            <p className="font-sans text-sm font-medium text-text-primary">Nenhum orçamento ainda</p>
            <p className="font-sans text-xs text-text-secondary mt-1">
              Os orçamentos são criados a partir das fichas clínicas
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {orcamentos.map((orc) => {
            const cfg = STATUS_CONFIG[orc.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.rascunho;
            return (
              <button
                key={orc.id}
                type="button"
                onClick={() => setDetalheAberto(orc)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/60 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-surface-alt flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium text-text-primary">
                    {formatBRL(orc.total)}
                  </p>
                  <p className="font-mono text-xs text-text-secondary">
                    {format(new Date(orc.created_at), 'dd/MM/yyyy')}
                    {orc.validade_dias && ` · válido por ${orc.validade_dias} dias`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Dialog de detalhe */}
      <Dialog open={!!detalheAberto} onOpenChange={(open) => { if (!open) setDetalheAberto(null); }}>
        {detalheAberto && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Detalhe do Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">Status</p>
                  <Badge variant={STATUS_CONFIG[detalheAberto.status as keyof typeof STATUS_CONFIG]?.variant ?? 'gray'}>
                    {STATUS_CONFIG[detalheAberto.status as keyof typeof STATUS_CONFIG]?.label ?? detalheAberto.status}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">Total</p>
                  <p className="font-mono text-base font-semibold text-text-primary">
                    {formatBRL(detalheAberto.total)}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">Data</p>
                  <p className="font-mono text-sm text-text-primary">
                    {format(new Date(detalheAberto.created_at), 'dd/MM/yyyy')}
                  </p>
                </div>
                {detalheAberto.validade_dias && (
                  <div className="space-y-0.5">
                    <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">Validade</p>
                    <p className="font-mono text-sm text-text-primary">{detalheAberto.validade_dias} dias</p>
                  </div>
                )}
              </div>

              {detalheAberto.condicoes_pagamento && (
                <div className="space-y-0.5">
                  <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">Condições de pagamento</p>
                  <p className="font-sans text-sm text-text-secondary">{detalheAberto.condicoes_pagamento}</p>
                </div>
              )}

              {detalheAberto.ficha_id && (
                <Link
                  href={`/dashboard/fichas/${detalheAberto.ficha_id}`}
                  className="flex items-center gap-2 text-sm font-medium text-teal hover:text-teal-dark transition-colors"
                  onClick={() => setDetalheAberto(null)}
                >
                  Ver ficha completa com procedimentos
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
