'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, ChevronRight, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { gerarPlanejamentoIA } from '@/app/dashboard/pacientes/[id]/actions';
import type { Planejamento } from '@/types/database';

const STATUS_CONFIG = {
  rascunho:    { label: 'Rascunho',    className: 'bg-surface-alt text-text-secondary' },
  apresentado: { label: 'Apresentado', className: 'bg-teal/10 text-teal' },
  aprovado:    { label: 'Aprovado',    className: 'bg-teal-pale text-teal-dark' },
} as const;

interface Props {
  patientId: string;
  planejamentos: Planejamento[];
}

export function PlanejamentoTab({ planejamentos, patientId }: Props): React.JSX.Element {
  const [dialogIA, setDialogIA] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [planejamentoGerado, setPlanejamentoGerado] = useState('');
  const [copiado, setCopiado] = useState(false);

  async function handleGerarIA(): Promise<void> {
    setGerando(true);
    setPlanejamentoGerado('');
    const result = await gerarPlanejamentoIA(patientId);
    setGerando(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPlanejamentoGerado(result.conteudo ?? '');
    }
  }

  async function handleCopiar(): Promise<void> {
    await navigator.clipboard.writeText(planejamentoGerado);
    setCopiado(true);
    toast.success('Planejamento copiado!');
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-text-secondary">
          {planejamentos.length} planejamento{planejamentos.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setDialogIA(true); handleGerarIA(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gerar com IA
          </button>
          <Link
            href={`/dashboard/fichas/nova?paciente_id=${patientId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
          >
            Criar via Ficha
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Lista de planejamentos */}
      {planejamentos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-4 py-14"
        >
          <ClipboardList className="w-10 h-10 text-text-muted" />
          <div className="text-center">
            <p className="font-sans text-sm font-medium text-text-primary">Nenhum planejamento ainda</p>
            <p className="font-sans text-xs text-text-secondary mt-1">
              Gere um planejamento com IA ou crie a partir de uma ficha clínica
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDialogIA(true); handleGerarIA(); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Gerar planejamento com IA
          </button>
        </motion.div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          <AnimatePresence initial={false}>
            {planejamentos.map((plano) => {
              const cfg = STATUS_CONFIG[plano.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.rascunho;
              return (
                <motion.div
                  key={plano.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4 text-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-medium text-text-primary truncate">{plano.titulo}</p>
                    <p className="font-mono text-xs text-text-secondary">{format(new Date(plano.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Dialog: Planejamento gerado por IA */}
      <Dialog open={dialogIA} onOpenChange={(open) => { if (!open) setDialogIA(false); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal" />
              Planejamento gerado por IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 py-2">
            {gerando ? (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="w-8 h-8 text-teal animate-spin" />
                <p className="font-sans text-sm text-text-secondary">
                  Analisando fichas e gerando planejamento…
                </p>
              </div>
            ) : planejamentoGerado ? (
              <div className="bg-surface-alt rounded-xl p-4 text-sm font-sans text-text-primary whitespace-pre-wrap leading-relaxed">
                {planejamentoGerado}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10">
                <p className="font-sans text-sm text-text-secondary">Nenhum conteúdo gerado</p>
                <button
                  type="button"
                  onClick={handleGerarIA}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Tentar novamente
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center gap-2 pt-3 border-t border-border">
            <p className="font-sans text-xs text-text-muted flex-1">
              Revise o conteúdo antes de usar. Para salvar, crie uma ficha e adicione o planejamento lá.
            </p>
            {planejamentoGerado && (
              <button
                type="button"
                onClick={handleCopiar}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-teal/10 text-teal hover:bg-teal/20 transition-colors"
              >
                {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiado ? 'Copiado!' : 'Copiar texto'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialogIA(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
