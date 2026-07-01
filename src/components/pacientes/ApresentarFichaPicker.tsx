'use client';

import { Presentation } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/**
 * Ficha mínima para o seletor do Apresentar (L · spec 2.2 / DESIGN-KL §1).
 * Compatível com FichaRecente (get-patient-workspace-data).
 */
export interface FichaParaApresentar {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  dentista?: { nome: string } | null;
}

interface ApresentarFichaPickerProps {
  open: boolean;
  onClose: () => void;
  fichas: FichaParaApresentar[];
  onSelect: (fichaId: string) => void;
}

/**
 * Seletor de ficha para apresentar — espelha o seletor ficha→orçamento
 * (novo-orcamento-modal, etapa 'selecionar'). Aberto a partir do header do
 * perfil quando o Apresentar é acionado fora do contexto de uma ficha.
 */
export function ApresentarFichaPicker({ open, onClose, fichas, onSelect }: ApresentarFichaPickerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="rounded-3xl bg-surface border-border p-0 overflow-hidden gap-0"
        style={{ width: '92vw', maxWidth: '480px', maxHeight: '90vh', left: '50%' }}
        showCloseButton={false}
      >
        {/* Banner teal */}
        <div className="relative px-8 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="font-heading font-semibold text-xl text-white leading-tight">
                Apresentar ficha
              </DialogTitle>
              <DialogDescription className="text-white/70 text-xs mt-0.5">
                Escolha qual registro clínico apresentar ao paciente.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Lista de fichas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ maxHeight: 'calc(90vh - 92px)' }}>
          {fichas.map((ficha) => {
            const dataFormatada = format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
            return (
              <button
                key={ficha.id}
                onClick={() => onSelect(ficha.id)}
                className="w-full text-left p-4 rounded-xl border border-border bg-surface-alt hover:border-teal/40 hover:bg-teal/5 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors truncate">
                      {ficha.queixa_principal ?? 'Evolução clínica'}
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5 font-mono">{dataFormatada}</div>
                  </div>
                  {ficha.dentista?.nome && (
                    <span className="shrink-0 text-[10px] font-bold font-mono bg-teal/10 text-teal px-2 py-1 rounded-lg max-w-[120px] truncate">
                      {ficha.dentista.nome}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
