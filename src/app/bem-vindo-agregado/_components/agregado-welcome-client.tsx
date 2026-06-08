'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Stethoscope, Building2, Check, ArrowRight, Loader2, CreditCard } from 'lucide-react';
import { createCheckoutAgregado } from '../actions';

interface Props {
  clinicaNome: string;
  nomeDentista: string;
  userId: string;
  userEmail: string;
}

/** Extrai o primeiro nome (sem "Dr." ou "Dra.") para usar no cumprimento. */
function primeiroNome(nome: string): string {
  const limpo = nome.replace(/^(dr\.?|dra\.?)\s*/i, '').trim();
  return limpo.split(' ')[0] ?? limpo;
}

export function AgregadoWelcomeClient({ clinicaNome, nomeDentista, userEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePagar = () => {
    setErrorMsg(null);
    setIsRedirecting(true);
    startTransition(async () => {
      const result = await createCheckoutAgregado({ userEmail });
      if (result.error) {
        setErrorMsg(result.error);
        setIsRedirecting(false);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    });
  };

  const handleEntrar = () => {
    router.push('/dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-3xl border border-border shadow-sm p-8 space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal/10 border border-teal/20 mb-2">
          <Stethoscope className="w-8 h-8 text-teal" />
        </div>
        <h1 className="font-heading font-semibold text-2xl text-text-primary">
          {nomeDentista
            ? <>Bem-vindo, Dr. {primeiroNome(nomeDentista)}!</>
            : 'Bem-vindo ao Odonto.IA!'}
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Você agora faz parte da equipe de{' '}
          <strong className="text-text-primary">{clinicaNome}</strong>.
          <br />
          Seus pacientes e fichas continuam exclusivamente seus.
        </p>
      </div>

      {/* O que é Dentista Agregado */}
      <div className="bg-surface-alt rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-teal" />
          <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            Como funciona
          </span>
        </div>
        {[
          'Você usa a estrutura da clínica para atender',
          'Seus pacientes e fichas são exclusivamente seus',
          'Caso saia, leva seus pacientes automaticamente',
          'Acesso completo ao Odonto.IA sem plano separado',
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-2.5 h-2.5 text-teal stroke-[3]" />
            </div>
            <span className="text-sm text-text-primary">{item}</span>
          </div>
        ))}
      </div>

      {/* Taxa */}
      <div className="rounded-2xl border border-teal/25 bg-teal/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text-primary">Taxa de Dentista Agregado</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Acesso completo ao sistema · Renovação mensal
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-semibold text-teal">R$147</span>
            <span className="text-xs text-text-secondary">/mês</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 text-center">
          {errorMsg}
        </p>
      )}

      {/* CTAs */}
      <div className="space-y-3">
        <button
          onClick={handlePagar}
          disabled={isPending || isRedirecting}
          className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
            boxShadow: '0 4px 20px -4px rgba(47,156,133,0.45)',
          }}
        >
          {isPending || isRedirecting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando…</>
            : <><CreditCard className="w-4 h-4" /> Pagar taxa · R$147/mês</>
          }
        </button>

        <button
          onClick={handleEntrar}
          disabled={isPending || isRedirecting}
          className="w-full py-3 px-4 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          Entrar no sistema agora
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-xs text-text-secondary">
          Você pode pagar depois em Configurações → Assinatura
        </p>
      </div>
    </motion.div>
  );
}
