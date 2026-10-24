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
  orcDeleteError: string | null;
  onExcluir: () => void;
  /** Soma dos pagamentos já confirmados deste orçamento. > 0 dispara o aviso reforçado. */
  valorJaRecebido: number;
  /** R-03c-1 — aceite assinado pelo paciente. Não bloqueia mais (decisão de 14/08), avisa. */
  temAceiteAssinado: boolean;
}

export function ConfirmarDeleteOrcModal({
  confirmDeleteOrcId,
  onOpenChange,
  orcDeleteSaving,
  orcDeleteError,
  onExcluir,
  valorJaRecebido,
  temAceiteAssinado,
}: ConfirmarDeleteOrcModalProps) {
  const temRecebido = valorJaRecebido > 0;
  const valorFmt = valorJaRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <Dialog
      open={!!confirmDeleteOrcId}
      onOpenChange={(open) => { if (!open) onOpenChange(false); }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] rounded-[16px] bg-surface border-border p-0 overflow-y-auto gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="w-9 h-9 rounded-xl bg-coral-pale flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-coral-ink" />
          </div>
          <div>
            <DialogTitle className="font-heading text-[24px] font-normal text-text-primary leading-tight">
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
            {[
              'Todos os procedimentos do orçamento',
              'Registros de pagamento pendentes',
              ...(temRecebido ? ['Os pagamentos já recebidos, que somem do financeiro'] : []),
              ...(temAceiteAssinado ? ['A assinatura de aceite do paciente'] : []),
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-1 h-1 rounded-full bg-coral/60 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Aviso reforçado: pagamento recebido e/ou aceite assinado. Nenhum dos dois bloqueia
            a exclusão (decisão de 14/08) — a escolha é do dentista, o papel da tela é dizer
            exatamente o que ele está prestes a perder. */}
        {(temRecebido || temAceiteAssinado) && (
          <div className="mx-6 mb-5 flex items-start gap-2.5 rounded-xl bg-coral-pale px-3.5 py-3">
            <AlertTriangle className="w-4 h-4 text-coral-ink shrink-0 mt-px" />
            <p className="text-xs text-text-primary leading-relaxed">
              {temRecebido && temAceiteAssinado ? (
                <>
                  Este orçamento tem <strong className="font-semibold text-coral-ink">{valorFmt}</strong>{' '}
                  recebido <strong className="font-semibold text-coral-ink">e aceite assinado</strong> pelo
                  paciente. Excluir tira esse valor do financeiro e apaga a assinatura — a prova de
                  que ele concordou com o valor.
                </>
              ) : temRecebido ? (
                <>
                  Este orçamento já tem <strong className="font-semibold text-coral-ink">{valorFmt}</strong>{' '}
                  recebido. Excluir apaga esse recebimento do financeiro — o caixa do dia muda.
                </>
              ) : (
                <>
                  Este orçamento tem{' '}
                  <strong className="font-semibold text-coral-ink">aceite assinado</strong> pelo paciente.
                  Excluir apaga a assinatura — a prova de que ele concordou com o valor.
                </>
              )}
            </p>
          </div>
        )}

        {orcDeleteError && (
          <p className="mx-6 mb-3 text-xs text-coral-ink bg-coral-pale rounded-xl px-3 py-2">
            {orcDeleteError}
          </p>
        )}

        <DialogFooter className="mx-0 mb-0 rounded-none bg-transparent px-6 pb-6 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={orcDeleteSaving}
            className="h-10 min-h-10 flex-none sm:flex-1 rounded-[8px] border-border text-text-primary hover:bg-surface-alt"
          >
            Cancelar
          </Button>
          <Button
            onClick={onExcluir}
            disabled={orcDeleteSaving}
            className="h-10 min-h-10 flex-none sm:flex-1 rounded-[8px] border border-coral/30 bg-coral-pale text-coral-ink hover:bg-coral/20 font-semibold"
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
