'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface FinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalize: (data: {
    resumo: string;
    conduta: string;
    proximosPassos: string;
    followUpData: string;
  }) => Promise<void>;
  isSaving: boolean;
}

export function FinalizeConsultationDialog({
  open,
  onOpenChange,
  onFinalize,
  isSaving,
}: FinalizeDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    resumo: '',
    conduta: '',
    proximosPassos: '',
    followUpData: '',
  });

  const handleClose = () => {
    if (isSaving) return;
    onOpenChange(false);
    setTimeout(() => { setStep(1); setForm({ resumo: '', conduta: '', proximosPassos: '', followUpData: '' }); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-3xl bg-surface border-border p-0 gap-0 overflow-hidden max-w-lg">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
          <DialogTitle className="font-heading text-2xl text-white">Finalizar Consulta</DialogTitle>
          <p className="text-white/70 text-xs mt-1">Etapa {step} de 2 — {step === 1 ? 'Resumo clínico' : 'Próximos passos'}</p>
          <div className="mt-3 h-1 bg-white/20 rounded-full">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${(step / 2) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="p-6 space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Resumo da consulta</Label>
                <textarea
                  value={form.resumo}
                  onChange={e => setForm(f => ({ ...f, resumo: e.target.value }))}
                  placeholder="O que foi realizado nesta consulta..."
                  className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[100px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-text-primary placeholder:text-text-muted"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Conduta clínica</Label>
                <textarea
                  value={form.conduta}
                  onChange={e => setForm(f => ({ ...f, conduta: e.target.value }))}
                  placeholder="Orientações e condutas adotadas..."
                  className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-text-primary placeholder:text-text-muted"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>Cancelar</Button>
                <Button className="flex-1 rounded-xl bg-teal text-white hover:bg-teal/90" onClick={() => setStep(2)}>
                  Próximo <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Próximos passos</Label>
                <textarea
                  value={form.proximosPassos}
                  onChange={e => setForm(f => ({ ...f, proximosPassos: e.target.value }))}
                  placeholder="Instruções para o paciente, retorno, cuidados..."
                  className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:ring-2 focus:ring-teal/20 transition-all text-text-primary placeholder:text-text-muted"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Data de retorno (opcional)</Label>
                <input
                  type="date"
                  value={form.followUpData}
                  onChange={e => setForm(f => ({ ...f, followUpData: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-surface-alt border border-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal/20 transition-all text-text-primary"
                />
                <p className="text-[11px] text-text-secondary">Se preenchida, registrada nas anotações da ficha.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-teal text-white hover:bg-teal/90"
                  disabled={isSaving}
                  onClick={() => void onFinalize(form)}
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</> : <><Check className="w-4 h-4 mr-2" /> Concluir</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
