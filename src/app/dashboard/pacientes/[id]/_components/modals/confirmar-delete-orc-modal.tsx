'use client';

import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
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
  const [confirmadoParaOrcamentoId, setConfirmadoParaOrcamentoId] = useState<string | null>(null);
  const confirmado = confirmDeleteOrcId !== null && confirmadoParaOrcamentoId === confirmDeleteOrcId;
  const temRecebido = valorJaRecebido > 0;
  const valorFmt = valorJaRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
          <div className="mx-6 mb-5 flex items-start gap-2.5 rounded-xl bg-coral/10 px-3.5 py-3">
            <AlertTriangle className="w-4 h-4 text-coral shrink-0 mt-px" />
            <p className="text-xs text-text-primary leading-relaxed">
              {temRecebido && temAceiteAssinado ? (
                <>
                  Este orçamento tem <strong className="font-semibold text-coral">{valorFmt}</strong>{' '}
                  recebido <strong className="font-semibold text-coral">e aceite assinado</strong> pelo
                  paciente. Excluir tira esse valor do financeiro e apaga a assinatura — a prova de
                  que ele concordou com o valor.
                </>
              ) : temRecebido ? (
                <>
                  Este orçamento já tem <strong className="font-semibold text-coral">{valorFmt}</strong>{' '}
                  recebido. Excluir apaga esse recebimento do financeiro — o caixa do dia muda.
                </>
              ) : (
                <>
                  Este orçamento tem{' '}
                  <strong className="font-semibold text-coral">aceite assinado</strong> pelo paciente.
                  Excluir apaga a assinatura — a prova de que ele concordou com o valor.
                </>
              )}
            </p>
          </div>
        )}

        <label className="mx-6 mb-5 flex cursor-pointer items-start gap-3 rounded-xl border border-coral/30 bg-coral/5 px-3.5 py-3 text-xs leading-relaxed text-text-primary">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(event) => setConfirmadoParaOrcamentoId(event.target.checked ? confirmDeleteOrcId : null)}
            disabled={orcDeleteSaving}
            className="mt-0.5 h-4 w-4 accent-coral"
          />
          <span>Estou ciente de que esta exclusão é permanente e que os dados listados acima serão removidos.</span>
        </label>

        {orcDeleteError && (
          <p className="mx-6 mb-3 text-xs text-red-500 bg-red-500/10 rounded-xl px-3 py-2">
            {orcDeleteError}
          </p>
        )}

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
            disabled={orcDeleteSaving || !confirmado}
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
