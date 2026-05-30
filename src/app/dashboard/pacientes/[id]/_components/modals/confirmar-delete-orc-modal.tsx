'use client';

import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmarDeleteOrcModalProps {
  confirmDeleteOrcId: string | null;
  onOpenChange: (open: boolean) => void;
  orcDeleteSaving: boolean;
  onExcluir: () => void;
}

export function ConfirmarDeleteOrcModal({
  confirmDeleteOrcId,
  onOpenChange,
  orcDeleteSaving,
  onExcluir,
}: ConfirmarDeleteOrcModalProps) {
  return (
    <Dialog
      open={!!confirmDeleteOrcId}
      onOpenChange={(open) => { if (!open) onOpenChange(false); }}
    >
      <DialogContent className="max-w-sm rounded-2xl bg-surface border-border p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="w-9 h-9 rounded-xl bg-coral/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-coral" />
          </div>
          <div>
            <DialogTitle className="font-heading text-base text-text-primary leading-tight">
              Excluir orçamento?
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary mt-0.5">
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </div>
        </div>

        {/* Consequences */}
        <div className="mx-6 mb-5 bg-surface-alt rounded-xl p-3.5 space-y-1.5">
          <p className="text-[11px] text-text-secondary font-medium">O que será removido:</p>
          <ul className="space-y-1">
            {['Todos os procedimentos do orçamento', 'Registros de pagamento pendentes'].map(item => (
              <li key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1 h-1 rounded-full bg-coral/60 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-text-secondary/60 pt-1">
            Orçamentos com pagamentos já confirmados são protegidos automaticamente.
          </p>
        </div>

        <DialogFooter className="px-6 pb-6 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={orcDeleteSaving}
            className="flex-1 rounded-xl border-border text-text-primary hover:bg-surface-alt"
          >
            Cancelar
          </Button>
          <Button
            onClick={onExcluir}
            disabled={orcDeleteSaving}
            className="flex-1 bg-coral hover:bg-coral/90 text-white rounded-xl font-semibold"
          >
            {orcDeleteSaving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Excluindo...</>
              : <><Trash2 className="w-4 h-4 mr-1.5" />Excluir</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
