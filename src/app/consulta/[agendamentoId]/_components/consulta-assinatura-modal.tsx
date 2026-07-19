'use client';

import { useRef, useState, useEffect } from 'react';
import SignaturePadLib from 'signature_pad';
import { motion, AnimatePresence } from 'motion/react';
import { PenLine, RotateCcw, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { salvarAssinaturaConsulta } from '../actions';

interface ConsultaAssinaturaModalProps {
  open: boolean;
  onClose: () => void;
  fichaId: string;
  pacienteId: string;
  pacienteNome: string;
  onSigned?: () => void;
  /** Demo: simula sucesso sem gravar no banco (spec 3.2). */
  isDemo?: boolean;
  /**
   * v3 §1.10 (fiscalização): procedimentos REALIZADOS com data clínica, listados acima
   * da assinatura — o paciente atesta conteúdo explícito, não uma ficha genérica.
   */
  procedimentosRealizados?: { label: string; data: string | null }[];
}

type Step = 'assinar' | 'salvando' | 'sucesso' | 'erro';

export function ConsultaAssinaturaModal({
  open, onClose, fichaId, pacienteId, pacienteNome, onSigned, isDemo = false,
  procedimentosRealizados = [],
}: ConsultaAssinaturaModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef    = useRef<SignaturePadLib | null>(null);

  const [step,  setStep]  = useState<Step>('assinar');
  const [erro,  setErro]  = useState<string | null>(null);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    if (!open) {
      setStep('assinar');
      setErro(null);
      setVazio(true);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'assinar' || !canvasRef.current || !open) return;

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
  }, [step, open]);

  const handleLimpar = () => {
    padRef.current?.clear();
    setVazio(true);
  };

  const handleConfirmar = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    if (!isDemo && !fichaId) return;
    setStep('salvando');

    // Demo: simula sucesso sem tocar no banco (spec 3.2 — não há fichaId real).
    if (isDemo) {
      setTimeout(() => {
        setStep('sucesso');
        onSigned?.();
        setTimeout(() => onClose(), 1600);
      }, 800);
      return;
    }

    const dataUrl = padRef.current.toDataURL('image/png');
    const result  = await salvarAssinaturaConsulta(fichaId, pacienteId, dataUrl);

    if (!result.ok) {
      setErro(result.error ?? 'Erro ao salvar assinatura.');
      setStep('erro');
      return;
    }

    setStep('sucesso');
    onSigned?.();
    setTimeout(() => onClose(), 2000);
  };

  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => step === 'assinar' ? undefined : onClose()}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="relative z-10 w-full max-w-lg rounded-3xl overflow-hidden bg-surface border border-border shadow-2xl mx-4"
      >
        <AnimatePresence mode="wait">

          {/* Pad de assinatura */}
          {step === 'assinar' && (
            <motion.div key="assinar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-surface-alt text-text-secondary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="font-heading text-2xl text-text-primary mt-3">
                  {pacienteNome.split(' ').slice(0, 2).join(' ')}
                </h2>
                <p className="text-sm text-text-secondary mt-0.5">{hoje}</p>
              </div>

              <div className="px-7 pt-5">
                <p className="text-sm text-text-secondary mb-4">
                  Ao assinar abaixo, o paciente confirma que está ciente do tratamento realizado e autoriza o registro na ficha clínica.
                </p>
              </div>

              {/* v3 §1.10 — o paciente atesta conteúdo explícito: realizados + datas */}
              {procedimentosRealizados.length > 0 && (
                <div className="px-7 pb-4">
                  <div className="rounded-xl border border-border bg-surface-alt/50 px-4 py-3 max-h-36 overflow-y-auto">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2">
                      Procedimentos realizados
                    </p>
                    <div className="flex flex-col gap-1">
                      {procedimentosRealizados.map((p, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="text-text-primary font-medium truncate">{p.label}</span>
                          <span className="font-mono text-[10.5px] text-text-secondary shrink-0">
                            {p.data ? p.data.split('-').reverse().join('/') : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="px-7">
                <div
                  className="relative rounded-2xl border-2 border-dashed border-border bg-white overflow-hidden"
                  style={{ height: 180 }}
                >
                  <canvas ref={canvasRef} className="w-full h-full touch-none" />
                  <div className="absolute bottom-8 left-8 right-8 pointer-events-none">
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

              <div className="px-7 py-6 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors"
                >
                  Pular
                </button>
                <button
                  onClick={() => void handleConfirmar()}
                  disabled={vazio}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: '#2f9c85',
                    boxShadow: vazio ? 'none' : '0 8px 24px -8px rgba(47,156,133,0.5)',
                  }}
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
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#2f9c85', boxShadow: '0 8px 24px rgba(47,156,133,0.35)' }}
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <p className="font-heading text-xl text-text-primary mb-1">Assinatura registrada!</p>
                <p className="text-sm text-text-secondary">
                  Ficha de {pacienteNome.split(' ')[0]} assinada com sucesso.
                </p>
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
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: '#2f9c85' }}
              >
                Tentar novamente
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
