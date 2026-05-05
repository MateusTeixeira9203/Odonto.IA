'use client';

import { useRef, useState, useEffect } from 'react';
import SignaturePadLib from 'signature_pad';
import { motion, AnimatePresence } from 'motion/react';
import { PenLine, RotateCcw, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buscarFichaParaAssinar, salvarAssinaturaRecepcao } from '@/app/dashboard/agendamentos/assinatura-actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  pacienteNome: string;
  onSigned?: () => void;
}

type Step = 'loading' | 'sem-ficha' | 'assinar' | 'salvando' | 'sucesso' | 'erro';

export function AssinaturaRecepcaoModal({ open, onOpenChange, pacienteId, pacienteNome, onSigned }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const padRef     = useRef<SignaturePadLib | null>(null);

  const [step,    setStep]    = useState<Step>('loading');
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [erro,    setErro]    = useState<string | null>(null);
  const [vazio,   setVazio]   = useState(true);

  // Busca a ficha ao abrir
  useEffect(() => {
    if (!open) return;
    setStep('loading');
    setErro(null);
    setVazio(true);

    void buscarFichaParaAssinar(pacienteId).then(({ fichaId: id, error }) => {
      if (error || !id) {
        setStep('sem-ficha');
        return;
      }
      setFichaId(id);
      setStep('assinar');
    });
  }, [open, pacienteId]);

  // Inicializa o signature pad quando o canvas montar
  useEffect(() => {
    if (step !== 'assinar' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio  = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255,255,255)',
      penColor: '#0d0d0d',
      minWidth: 1.5,
      maxWidth: 3,
    });

    padRef.current.addEventListener('endStroke', () => {
      setVazio(padRef.current?.isEmpty() ?? true);
    });

    return () => { padRef.current?.off(); };
  }, [step]);

  const handleLimpar = () => {
    padRef.current?.clear();
    setVazio(true);
  };

  const handleConfirmar = async () => {
    if (!fichaId || !padRef.current || padRef.current.isEmpty()) return;
    setStep('salvando');

    const dataUrl = padRef.current.toDataURL('image/png');
    const result  = await salvarAssinaturaRecepcao(fichaId, pacienteId, dataUrl);

    if (!result.ok) {
      setErro(result.error ?? 'Erro ao salvar assinatura.');
      setStep('erro');
      return;
    }

    setStep('sucesso');
    onSigned?.();
    setTimeout(() => onOpenChange(false), 2000);
  };

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen: boolean) => {
        if (!newOpen && step === 'assinar') return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden border-border">
        <AnimatePresence mode="wait">

          {/* Loading */}
          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-20 px-8"
            >
              <Loader2 className="w-8 h-8 text-teal animate-spin" />
              <p className="text-sm text-text-secondary">Localizando ficha...</p>
            </motion.div>
          )}

          {/* Sem ficha */}
          {step === 'sem-ficha' && (
            <motion.div
              key="sem-ficha"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-16 px-8 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-text-primary mb-1">Nenhuma ficha encontrada</p>
                <p className="text-sm text-text-secondary">
                  {pacienteNome} não possui ficha clínica sem assinatura. O dentista precisa criar uma ficha antes da assinatura.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="mt-2 px-6 py-2.5 bg-surface-alt hover:bg-border rounded-xl text-sm font-semibold text-text-primary transition-colors"
              >
                Fechar
              </button>
            </motion.div>
          )}

          {/* Pad de assinatura */}
          {step === 'assinar' && (
            <motion.div
              key="assinar"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              {/* Header */}
              <div className="px-7 pt-7 pb-5 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
                      <PenLine className="w-4 h-4 text-teal" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                      Assinatura do Paciente
                    </span>
                  </div>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 rounded-lg hover:bg-surface-alt text-text-secondary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="font-heading text-2xl text-text-primary mt-3">{pacienteNome}</h2>
                <p className="text-sm text-text-secondary mt-0.5">{hoje}</p>
              </div>

              {/* Instrução */}
              <div className="px-7 pt-5">
                <p className="text-sm text-text-secondary mb-4">
                  Ao assinar abaixo, confirmo que estou ciente do tratamento realizado e autorizo o registro na minha ficha clínica.
                </p>
              </div>

              {/* Canvas */}
              <div className="px-7">
                <div
                  className="relative rounded-2xl border-2 border-dashed border-border bg-white overflow-hidden"
                  style={{ height: 200 }}
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full touch-none"
                  />
                  {/* Linha-guia */}
                  <div className="absolute bottom-10 left-8 right-8 pointer-events-none">
                    <div className="w-full h-px bg-border/60" />
                    <p className="text-[10px] text-border/80 mt-1 font-mono">Assine acima</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLimpar}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors mt-2 px-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar
                </button>
              </div>

              {/* Footer */}
              <div className="px-7 py-6 flex gap-3">
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleConfirmar()}
                  disabled={vazio}
                  className="flex-1 py-3 rounded-xl bg-teal hover:bg-teal-lt text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ boxShadow: vazio ? 'none' : '0 8px 24px -8px rgba(47,156,133,0.5)' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Assinatura
                </button>
              </div>
            </motion.div>
          )}

          {/* Salvando */}
          {step === 'salvando' && (
            <motion.div
              key="salvando"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-20 px-8"
            >
              <Loader2 className="w-8 h-8 text-teal animate-spin" />
              <p className="text-sm text-text-secondary">Salvando assinatura...</p>
            </motion.div>
          )}

          {/* Sucesso */}
          {step === 'sucesso' && (
            <motion.div
              key="sucesso"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-2xl bg-teal/10 flex items-center justify-center"
              >
                <CheckCircle2 className="w-8 h-8 text-teal" />
              </motion.div>
              <div>
                <p className="font-semibold text-text-primary mb-1">Assinatura registrada!</p>
                <p className="text-sm text-text-secondary">Ficha de {pacienteNome} assinada com sucesso.</p>
              </div>
            </motion.div>
          )}

          {/* Erro */}
          {step === 'erro' && (
            <motion.div
              key="erro"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-16 px-8 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-text-primary mb-1">Erro ao salvar</p>
                <p className="text-sm text-text-secondary">{erro}</p>
              </div>
              <button
                onClick={() => setStep('assinar')}
                className="px-6 py-2.5 bg-teal text-white rounded-xl text-sm font-semibold hover:bg-teal-lt transition-colors"
              >
                Tentar novamente
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
