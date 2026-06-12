'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Building2, Check, Users, Mail, Loader2,
  ChevronRight, ArrowLeft, Sparkles, AlertTriangle,
} from 'lucide-react';
import { enviarConvite } from '../usuarios/actions';
import { ativarPlanoClinica, verificarStatusMigracao } from '../plano-actions';
import { toast } from 'sonner';

interface MigrarClinicaModalProps {
  open: boolean;
  onClose: () => void;
  dentistasAtivos: number;
  onPlanoAtivado: () => void;
}

type Step = 'explicacao' | 'convites';

export function MigrarClinicaModal({
  open,
  onClose,
  dentistasAtivos: dentistasInicial,
  onPlanoAtivado,
}: MigrarClinicaModalProps) {
  const [step, setStep]                     = useState<Step>('explicacao');
  const [email, setEmail]                   = useState('');
  const [enviando, setEnviando]             = useState(false);
  const [ativando, setAtivando]             = useState(false);
  const [dentistasAtivos, setDentistas]     = useState(dentistasInicial);
  const [convidosEnviados, setConvidados]   = useState<string[]>([]);
  const emailInputRef                       = useRef<HTMLInputElement>(null);

  const faltam   = Math.max(0, 3 - dentistasAtivos);
  const podeAtivar = dentistasAtivos >= 3;

  function handleClose() {
    setStep('explicacao');
    setEmail('');
    onClose();
  }

  async function handleEnviarConvite() {
    const emailTrimado = email.trim().toLowerCase();
    if (!emailTrimado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimado)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (convidosEnviados.includes(emailTrimado)) {
      toast.error('Convite já enviado para este e-mail.');
      return;
    }

    setEnviando(true);
    try {
      const result = await enviarConvite(emailTrimado);
      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao enviar convite.');
      } else {
        setConvidados((prev) => [...prev, emailTrimado]);
        setEmail('');
        toast.success(`Convite enviado para ${emailTrimado}`);
        emailInputRef.current?.focus();
      }
    } catch {
      toast.error('Erro inesperado ao enviar convite.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleVerificarEAtivar() {
    setAtivando(true);
    try {
      // Atualiza a contagem antes de tentar ativar
      const statusResult = await verificarStatusMigracao();
      if (statusResult.ok) {
        setDentistas(statusResult.status.dentistasAtivos);
        if (!statusResult.status.podeAtivar) {
          toast.error(`São necessários 3 dentistas. Atualmente: ${statusResult.status.dentistasAtivos}.`);
          return;
        }
      }

      const result = await ativarPlanoClinica();
      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao ativar plano.');
      } else {
        toast.success('Plano Clínica ativado com sucesso!');
        onPlanoAtivado();
        handleClose();
      }
    } catch {
      toast.error('Erro inesperado.');
    } finally {
      setAtivando(false);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-md bg-surface rounded-3xl border border-border shadow-2xl overflow-hidden pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fechar */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-alt/60 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              <AnimatePresence mode="wait">

                {/* ── STEP 1: Explicação ── */}
                {step === 'explicacao' && (
                  <motion.div
                    key="explicacao"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                    className="p-7"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-teal) 25%, transparent)' }}
                      >
                        <Building2 className="w-6 h-6 text-teal" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal font-mono">Upgrade</p>
                        <h2 className="font-heading text-xl text-text-primary">Criar Clínica</h2>
                      </div>
                    </div>

                    {/* Descrição */}
                    <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                      Seu consultório vira uma clínica completa.{' '}
                      <span className="text-text-primary font-medium">Todos os seus dados são mantidos.</span>
                    </p>

                    {/* Passos */}
                    <div className="space-y-3 mb-6">
                      {[
                        { n: 1, titulo: 'Convide seus colegas', desc: 'Envie convites por e-mail direto do sistema.' },
                        { n: 2, titulo: 'Cada um assina individualmente', desc: 'Cada dentista paga R$179/mês com o próprio cartão.' },
                        { n: 3, titulo: 'Clínica ativada', desc: 'Com 3+ dentistas confirmados, o plano é ativado.' },
                      ].map(({ n, titulo, desc }) => (
                        <div key={n} className="flex items-start gap-3">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                            style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)', color: 'var(--color-teal)' }}
                          >
                            {n}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{titulo}</p>
                            <p className="text-xs text-text-secondary mt-0.5">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aviso de cobrança mínima */}
                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-amber-400/30 bg-amber-400/8 mb-6">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                        <span className="font-bold">Cobrança mínima: R$537/mês</span>{' '}
                        (3 × R$179). O plano Clínica exige no mínimo 3 dentistas ativos.
                      </p>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => setStep('convites')}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
                        boxShadow: '0 6px 20px rgba(47,156,133,0.35)',
                      }}
                    >
                      Entendido, vamos convidar
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── STEP 2: Convites ── */}
                {step === 'convites' && (
                  <motion.div
                    key="convites"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2 }}
                    className="p-7"
                  >
                    {/* Back + header */}
                    <div className="flex items-center gap-3 mb-6">
                      <button
                        onClick={() => setStep('explicacao')}
                        className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-alt/60 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal font-mono">Passo 2 de 2</p>
                        <h2 className="font-heading text-xl text-text-primary">Convide sua equipe</h2>
                      </div>
                    </div>

                    {/* Progresso N/3 */}
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-surface-alt border border-border/60">
                      <div className="flex items-center gap-2 flex-1">
                        {[1, 2, 3].map((n) => {
                          const ativo = n <= dentistasAtivos;
                          return (
                            <div
                              key={n}
                              className={[
                                'w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300',
                                ativo
                                  ? 'border-teal bg-teal/10 text-teal'
                                  : 'border-border bg-surface text-text-secondary',
                              ].join(' ')}
                            >
                              {ativo ? <Check className="w-4 h-4 stroke-[3]" /> : n}
                            </div>
                          );
                        })}
                        <div className="flex-1" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-text-primary">{dentistasAtivos}/3</p>
                        <p className="text-xs text-text-secondary">
                          {podeAtivar ? 'Pronto!' : `Faltam ${faltam}`}
                        </p>
                      </div>
                    </div>

                    {/* Ativar plano — aparece quando 3+ ativos */}
                    {podeAtivar && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-5 p-4 rounded-2xl border border-teal/30 bg-teal/5"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-teal" />
                          <p className="text-sm font-bold text-teal">3 dentistas confirmados!</p>
                        </div>
                        <p className="text-xs text-text-secondary mb-3">
                          Sua clínica está pronta para ser ativada.
                        </p>
                        <button
                          onClick={handleVerificarEAtivar}
                          disabled={ativando}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                          style={{
                            background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
                            boxShadow: '0 4px 16px rgba(47,156,133,0.35)',
                          }}
                        >
                          {ativando
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Ativando...</>
                            : <><Sparkles className="w-4 h-4" /> Ativar Plano Clínica</>
                          }
                        </button>
                      </motion.div>
                    )}

                    {/* Input de convite */}
                    <div className="space-y-2 mb-4">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> E-mail do colega
                      </label>
                      <div className="flex gap-2">
                        <input
                          ref={emailInputRef}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleEnviarConvite(); } }}
                          placeholder="dr.colega@email.com"
                          disabled={enviando}
                          className="flex-1 text-sm px-4 py-3 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                        />
                        <button
                          onClick={handleEnviarConvite}
                          disabled={enviando || !email.trim()}
                          className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #2f9c85, #1e7a67)' }}
                        >
                          {enviando
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><ChevronRight className="w-4 h-4" /></>
                          }
                        </button>
                      </div>
                    </div>

                    {/* Lista de convites desta sessão */}
                    {convidosEnviados.length > 0 && (
                      <div className="space-y-2 mb-5">
                        <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Convites enviados</p>
                        {convidosEnviados.map((e) => (
                          <div key={e} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-alt border border-border/60">
                            <div className="w-5 h-5 rounded-full bg-teal/10 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-teal stroke-[3]" />
                            </div>
                            <span className="text-xs font-mono text-text-primary truncate">{e}</span>
                            <span className="text-[10px] text-amber-500 font-bold ml-auto shrink-0">Pendente</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nota */}
                    <div className="flex items-start gap-2 mb-5">
                      <Users className="w-3.5 h-3.5 text-text-secondary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                        Convites válidos por 7 dias. Cada colega precisará criar a própria conta e assinar o plano Clínica individualmente.
                      </p>
                    </div>

                    {/* Fechar / ir para equipe */}
                    <button
                      onClick={handleClose}
                      className="w-full py-3 rounded-2xl border border-border text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-all"
                    >
                      Ir para Configurações → Equipe
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
