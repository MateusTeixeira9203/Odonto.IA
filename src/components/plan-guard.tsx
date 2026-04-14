'use client';

import Link from 'next/link';
import { Lock, ArrowUpRight } from 'lucide-react';
import type { PlanoId, PlanoFeatures } from '@/lib/planos';
import { PLANOS, temFeature } from '@/lib/planos';

interface PlanGuardProps {
  /** Plano atual da clínica */
  plano: PlanoId;
  /** Feature a verificar */
  feature: keyof PlanoFeatures;
  /** Nome legível da funcionalidade (exibido no overlay) */
  featureName: string;
  /** Plano mínimo necessário para acessar (exibido na CTA) */
  requiredPlan: PlanoId;
  children: React.ReactNode;
  /** Quando true, o conteúdo ainda é renderizado mas com blur + overlay */
  blur?: boolean;
}

const PLANO_UPGRADE_ORDER: PlanoId[] = ['SOLO', 'BASICO', 'CLINICA'];

function planoMaiorOuIgual(plano: PlanoId, required: PlanoId): boolean {
  return PLANO_UPGRADE_ORDER.indexOf(plano) >= PLANO_UPGRADE_ORDER.indexOf(required);
}

/**
 * Envolve qualquer conteúdo com uma trava de plano.
 * Se o plano atual não tem a feature, exibe um overlay de upgrade.
 * Se `blur` for true, o conteúdo fica visível mas desfocado (preview).
 */
export function PlanGuard({
  plano,
  feature,
  featureName,
  requiredPlan,
  children,
  blur = true,
}: PlanGuardProps) {
  const hasAccess = temFeature(plano, feature) || planoMaiorOuIgual(plano, requiredPlan);

  if (hasAccess) return <>{children}</>;

  const requiredConfig = PLANOS[requiredPlan];

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Conteúdo com blur (preview) */}
      {blur && (
        <div className="pointer-events-none select-none" style={{ filter: 'blur(4px)', opacity: 0.4 }}>
          {children}
        </div>
      )}

      {/* Overlay de upgrade */}
      <div
        className={`${blur ? 'absolute inset-0' : 'relative'} flex flex-col items-center justify-center gap-5 rounded-2xl p-8 text-center`}
        style={{
          background: blur
            ? 'linear-gradient(135deg, rgba(9,9,11,0.85) 0%, rgba(47,156,133,0.10) 100%)'
            : 'linear-gradient(135deg, rgba(47,156,133,0.08) 0%, #09090b 55%)',
          backdropFilter: blur ? 'blur(2px)' : undefined,
          border: '1px solid rgba(47,156,133,0.20)',
          boxShadow: '0 8px 32px -8px rgba(47,156,133,0.20)',
        }}
      >
        {/* Ícone de cadeado */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(47,156,133,0.12)',
            border: '1px solid rgba(47,156,133,0.25)',
          }}
        >
          <Lock className="w-6 h-6" style={{ color: '#2f9c85' }} />
        </div>

        {/* Texto */}
        <div>
          <p className="text-white font-bold text-base mb-1">{featureName}</p>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Esta funcionalidade está disponível no Plano{' '}
            <span style={{ color: '#2f9c85' }} className="font-semibold">
              {requiredConfig.label}
            </span>{' '}
            (R$&nbsp;{requiredConfig.preco}/mês).
          </p>
        </div>

        {/* CTA upgrade */}
        <Link
          href="/dashboard/configuracoes"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #2f9c85 0%, #1e7a67 100%)',
            boxShadow: '0 6px 20px -6px rgba(47,156,133,0.5)',
          }}
        >
          Fazer Upgrade
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
