'use client';

import { useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NeuralBackground } from '@/components/layout/NeuralBackground';
import { activateTrial, createCheckout } from '../actions';
import Link from 'next/link';

interface PlanosClientProps {
  /** ID do usuário autenticado, null se não logado */
  userId: string | null;
  /** Email do usuário, null se não logado */
  userEmail: string | null;
  /** Trial já foi ativado antes */
  trialUsed: boolean;
  /** Status da assinatura atual */
  statusAssinatura: 'trial' | 'ativo' | 'inativo';
  /** Trial expirado (query param expired=1) */
  expired: boolean;
}

const plans = [
  {
    id: 'SOLO' as const,
    name: 'Solo',
    price: '167',
    description: 'Liberdade e tempo. Elimine o trabalho burocrático e foque no paciente.',
    features: ['1 Dentista', 'Orçamentos por Voz', 'Agenda Inteligente', 'DEX — Concierge WhatsApp'],
    popular: false,
    trial: false,
  },
  {
    id: 'BASICO' as const,
    name: 'Básico',
    price: '247',
    description: 'Controle total. A IA e sua secretária trabalhando juntas por você.',
    features: ['1 Dentista + 1 Secretária', 'Bot de Atendimento Customizável', 'Gestão de Despesas', 'Relatórios Financeiros'],
    popular: true,
    trial: false,
  },
  {
    id: 'CLINICA' as const,
    name: 'Clínica',
    price: '397',
    description: 'A experiência completa. Tudo do plano Básico e recursos avançados de escala.',
    features: ['Multi-dentistas (+ R$ 147/cada)', 'Silos de Privacidade Total', 'Rateio de Custos Automático', 'Gestão de Condomínio'],
    popular: false,
    trial: true,
  },
];

export function PlanosClient({
  userId,
  userEmail: _userEmail,
  trialUsed,
  statusAssinatura,
  expired,
}: PlanosClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClinkaTrialClick = () => {
    if (!userId) {
      router.push('/cadastro?next=/planos');
      return;
    }

    setErrorMsg(null);
    setLoadingPlan('CLINICA_TRIAL');

    startTransition(async () => {
      const result = await activateTrial();
      if (result?.error) {
        setErrorMsg(result.error);
        setLoadingPlan(null);
      }
      // Em caso de sucesso, activateTrial faz redirect() — o componente desmonta
    });
  };

  const handleCheckoutClick = (planId: 'SOLO' | 'BASICO' | 'CLINICA') => {
    if (!userId) {
      router.push(`/cadastro?next=/planos`);
      return;
    }

    setErrorMsg(null);
    setLoadingPlan(planId);

    startTransition(async () => {
      const result = await createCheckout(planId);
      if (result.error) {
        setErrorMsg(result.error);
        setLoadingPlan(null);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    });
  };

  const isActive = statusAssinatura === 'ativo';

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-bg">
      <NeuralBackground />

      <div className="z-10 w-full">
        {/* Header */}
        <div className="text-center pt-24 pb-4 px-6">
          <Link href="/" className="inline-block mb-8">
            <span className="text-2xl font-heading font-medium text-text-primary">
              Dent<span className="italic text-teal">IA</span>
            </span>
          </Link>

          {/* Banner de trial expirado */}
          {expired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-coral/10 border border-coral/20 text-coral text-sm font-medium mb-6"
            >
              <AlertCircle className="w-4 h-4" />
              Seu período de trial expirou. Escolha um plano para continuar.
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl md:text-5xl text-text-primary mb-4"
          >
            Planos que crescem com você
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-text-secondary max-w-2xl mx-auto"
          >
            Escolha o plano ideal para a sua clínica e transforme sua produtividade com o poder da IA.
          </motion.p>
        </div>

        {/* Erro global */}
        {errorMsg && (
          <div className="max-w-md mx-auto mt-4 px-6">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-coral/10 border border-coral/20 text-coral text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          </div>
        )}

        {/* Cards de planos */}
        <section className="py-12 px-6 max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start"
          >
            {plans.map(plan => {
              const isLoading = loadingPlan === plan.id || loadingPlan === `${plan.id}_TRIAL`;
              const canTrial = plan.trial && !trialUsed && !isActive && userId;
              const buttonLabel = isActive
                ? 'Plano Ativo'
                : canTrial
                ? '7 Dias Grátis'
                : 'Assinar Agora';

              return (
                <motion.div
                  key={plan.id}
                  variants={{
                    hidden: { opacity: 0, y: 40 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
                  }}
                  className={`relative flex flex-col p-8 rounded-2xl bg-surface border border-border shadow-sm hover:shadow-xl transition-all duration-300 ${
                    plan.popular ? 'ring-2 ring-teal scale-105 md:-mt-4' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <span className="bg-teal text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Mais Escolhido
                      </span>
                    </div>
                  )}

                  {plan.trial && !trialUsed && !isActive && (
                    <div className="absolute -top-4 right-6 flex justify-center">
                      <span className="inline-flex items-center gap-1 bg-teal-pale text-teal text-xs font-bold px-3 py-1 rounded-full border border-teal/20">
                        <Sparkles className="w-3 h-3" />
                        7 dias grátis
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-heading text-3xl text-text-primary mb-2">{plan.name}</h3>
                    <p className="text-sm text-text-secondary h-10">{plan.description}</p>
                  </div>

                  <div className="mb-8 flex items-baseline text-text-primary">
                    <span className="font-mono text-xl mr-1">R$</span>
                    <span className="font-mono text-5xl font-medium tracking-tight">{plan.price}</span>
                    <span className="text-text-secondary ml-1">/mês</span>
                  </div>

                  <ul className="flex-1 space-y-4 mb-8">
                    {plan.features.map(feature => (
                      <li key={feature} className="flex items-start">
                        <Check className="h-5 w-5 text-teal shrink-0 mr-3 stroke-[2.5]" />
                        <span className="text-text-primary font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {canTrial ? (
                    <button
                      onClick={handleClinkaTrialClick}
                      disabled={isLoading || isPending}
                      className="w-full py-3 px-4 rounded-xl bg-teal hover:bg-teal-lt text-white font-bold transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(47,156,133,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Ativando trial…
                        </>
                      ) : (
                        buttonLabel
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckoutClick(plan.id)}
                      disabled={isActive || isLoading || isPending}
                      className="w-full py-3 px-4 rounded-xl bg-teal hover:bg-teal-lt text-white font-bold transition-all duration-300 shadow-md hover:shadow-[0_0_20px_rgba(47,156,133,0.4)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Redirecionando…
                        </>
                      ) : (
                        buttonLabel
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* Nota de retorno */}
        <p className="text-center text-sm text-text-secondary pb-12">
          Em caso de cancelamento, você será redirecionado de volta para esta página.
        </p>
      </div>
    </div>
  );
}
