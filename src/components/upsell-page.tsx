'use client';

import { ArrowUpRight, Check, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';
import type { PlanoId } from '@/lib/planos';
import { PLANOS } from '@/lib/planos';

interface UpsellPageProps {
  featureName: string;
  featureDescription: string;
  benefits: string[];
  requiredPlan: PlanoId;
  /** Ícone opcional passado como ReactNode */
  icon?: React.ReactNode;
}

/**
 * Tela de upsell completa para funcionalidades bloqueadas por plano.
 * Substitui o conteúdo da página — não oculta o botão de navegação.
 */
export function UpsellPage({
  featureName,
  featureDescription,
  benefits,
  requiredPlan,
  icon,
}: UpsellPageProps) {
  const config = PLANOS[requiredPlan];

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        {/* Card principal */}
        <div
          className="rounded-3xl p-10 text-center space-y-8"
          style={{
            background: 'linear-gradient(145deg, rgba(47,156,133,0.08) 0%, var(--color-surface) 60%)',
            border: '1px solid rgba(47,156,133,0.20)',
            boxShadow: '0 20px 60px -20px rgba(47,156,133,0.15)',
          }}
        >
          {/* Ícone de cadeado animado */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(47,156,133,0.15) 0%, rgba(47,156,133,0.05) 100%)',
              border: '1px solid rgba(47,156,133,0.3)',
            }}
          >
            {icon ?? <Lock className="w-8 h-8" style={{ color: '#2f9c85' }} />}
          </motion.div>

          {/* Cabeçalho */}
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(47,156,133,0.12)',
                color: '#2f9c85',
                border: '1px solid rgba(47,156,133,0.2)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Plano {config.label}
            </div>
            <h2 className="font-heading text-3xl text-text-primary">{featureName}</h2>
            <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
              {featureDescription}
            </p>
          </div>

          {/* Lista de benefícios */}
          <ul className="space-y-3 text-left">
            {benefits.map((b, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="flex items-start gap-3 text-sm text-text-primary"
              >
                <span className="w-5 h-5 rounded-full bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-teal" />
                </span>
                {b}
              </motion.li>
            ))}
          </ul>

          {/* Preço + CTA */}
          <div className="space-y-4 pt-2">
            <p className="text-text-secondary text-xs">
              A partir de{' '}
              <span className="font-mono text-text-primary font-semibold text-base">
                R$&nbsp;{config.preco}
              </span>
              /mês
            </p>
            <Link
              href="/dashboard/configuracoes"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
                boxShadow: '0 8px 24px -8px rgba(47,156,133,0.5)',
              }}
            >
              Fazer Upgrade para {config.label}
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <p className="text-text-secondary text-xs">
              Cancele quando quiser · Sem fidelidade
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
