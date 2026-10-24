'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';

type AtendimentoDia = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Agendado', cls: 'bg-warning-pale text-warning-ink' },
  confirmed:   { label: 'Confirmado', cls: 'bg-teal-pale text-teal-ink' },
  checked_in:  { label: 'Chegou', cls: 'bg-clinical-done-pale text-clinical-done-ink' },
  in_progress: { label: 'Em curso', cls: 'bg-teal-pale text-teal-ink' },
  completed:   { label: 'Concluído', cls: 'bg-slate-pale text-slate-ink' },
  no_show:     { label: 'Faltou', cls: 'bg-coral-pale text-coral-ink' },
  cancelled:   { label: 'Cancelado', cls: 'bg-slate-pale text-slate-ink' },
};

interface DexDayButtonProps {
  atendimentos: AtendimentoDia[];
  dataHojeISO: string;
}

export function DexDayButton({ atendimentos, dataHojeISO }: DexDayButtonProps) {
  const [open, setOpen] = useState(false);
  if (atendimentos.length === 0) return null;
  const dataFormatada = format(new Date(dataHojeISO), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-border px-[13px] text-[15px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20" />}>
        Ver procedimentos do dia <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="flex w-[calc(100vw-2rem)] max-w-[650px] flex-col gap-0 overflow-hidden rounded-[16px] border-border bg-surface! p-0 backdrop-blur-none! sm:max-w-[650px]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-6 py-[18px]">
          <div className="min-w-0">
            <DialogTitle className="font-sans text-[17px] font-bold leading-normal text-text-primary">Procedimentos de hoje</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-text-secondary">{dataFormatada} · {atendimentos.length} atendimento{atendimentos.length !== 1 ? 's' : ''}</DialogDescription>
          </div>
          <DialogClose render={<button type="button" aria-label="Fechar procedimentos de hoje" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20" />}><X className="h-4 w-4" aria-hidden="true" /></DialogClose>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-6">
          {atendimentos.map((apt) => {
            const hora = format(parseISO(apt.data_hora), 'HH:mm');
            const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
            const isDone = ['completed', 'no_show', 'cancelled'].includes(apt.status);
            const alertas = apt.paciente?.observacoes
              ? apt.paciente.observacoes.split('\n').map((l) => l.trim()).filter(Boolean)
              : [];
            return (
              <li key={apt.id} data-atendimento-id={apt.id} className={`grid grid-cols-[40px_minmax(0,1fr)] gap-3 py-3 ${isDone ? 'opacity-50' : ''}`}>
                <span className="font-mono text-[15px] font-bold text-text-secondary">{hora}</span>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-[15px] font-medium text-text-primary">{apt.paciente?.nome ?? '—'}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[12px] ${cfg.cls}`}>{apt.status === 'in_progress' && <span className="h-2 w-2 rounded-full bg-teal" aria-hidden="true" />}{cfg.label}</span>
                  </div>
                  {alertas.length > 0 && <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-[4px] bg-warning-pale px-1.5 py-0.5 text-[12px] text-warning-ink"><AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{alertas[0]}</span></span>}
                  <p className="mt-1 break-words text-[12px] text-text-secondary">{apt.observacoes || 'Sem procedimento registrado'}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 border-t border-border px-6 py-4"><p className="text-[11px] text-text-secondary">Procedimentos baseados nas observações de cada agendamento</p></div>
      </DialogContent>
    </Dialog>
  );
}
