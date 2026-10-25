'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ExcluirPacienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteNome: string;
  saving: boolean;
  error: string | null;
  onExcluir: () => void;
}

const CONSEQUENCIAS = [
  'Todo o prontuário — todas as fichas e o odontograma',
  'Orçamentos e todos os pagamentos registrados',
  'Assinaturas — prova de aceite do paciente',
  'Agendamentos, planejamentos e documentos anexados',
];

/** Confirmação reforçada (decisão dele 07/08): digitar o nome do paciente, não só um
 *  clique — o delete é permanente e cascateia sobre financeiro/clínico/assinaturas, não
 *  dá pra deixar isso um engano de 1 clique. */
export function ExcluirPacienteModal({
  open, onOpenChange, pacienteNome, saving, error, onExcluir,
}: ExcluirPacienteModalProps) {
  const [confirmacao, setConfirmacao] = useState('');
  const confirmado = confirmacao.trim().toLowerCase() === pacienteNome.trim().toLowerCase();

  function fechar() {
    onOpenChange(false);
    setConfirmacao('');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent className="max-w-sm rounded-2xl bg-surface border-border p-0 overflow-hidden gap-0">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="w-9 h-9 rounded-xl bg-coral/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-coral" />
          </div>
          <div>
            <DialogTitle className="font-heading text-base text-text-primary leading-tight">
              Excluir {pacienteNome}?
            </DialogTitle>
            <DialogDescription className="text-xs text-coral font-semibold mt-0.5">
              Permanente. Não tem como desfazer.
            </DialogDescription>
          </div>
        </div>

        <div className="mx-6 mb-5 bg-surface-alt rounded-xl p-3.5 space-y-1.5">
          <p className="text-[11px] text-text-secondary font-medium">O que será apagado pra sempre:</p>
          <ul className="space-y-1">
            {CONSEQUENCIAS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1 h-1 rounded-full bg-coral/60 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-6 mb-5 space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary">
            Digite &ldquo;{pacienteNome}&rdquo; pra confirmar
          </label>
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={pacienteNome}
            className="rounded-xl bg-surface border-border text-text-primary"
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="mx-6 mb-3 text-xs text-coral bg-coral/10 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="px-6 pb-6 gap-2">
          <Button
            variant="outline"
            onClick={fechar}
            disabled={saving}
            className="flex-1 rounded-xl border-border text-text-primary hover:bg-surface-alt"
          >
            Cancelar
          </Button>
          <Button
            onClick={onExcluir}
            disabled={saving || !confirmado}
            className="flex-1 bg-coral hover:bg-coral/90 text-white rounded-xl font-semibold disabled:opacity-40"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Excluindo...</>
              : <><Trash2 className="w-4 h-4 mr-1.5" />Excluir permanentemente</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
