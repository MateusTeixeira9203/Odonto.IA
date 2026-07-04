'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Users, Settings, CheckCircle2, Loader2, ChevronRight,
  Stethoscope, Building2, Check, Clock, TrendingUp, Play,
} from 'lucide-react';
import {
  iniciarOnboarding, definirPlano, marcarOnboardingCompleto,
  definirProcedimentosPendente, type PlanoClinica,
} from '../actions';
import { PERSONAS, PERSONA_IDS, getPersona, type FocoPrincipal } from '@/lib/persona';
import { especialidadesSchema } from '@/lib/especialidades';
import { EspecialidadeChips } from '@/components/ui/especialidade-chips';
import { DexMark } from '@/components/dex/dex-mark';
import { toast } from 'sonner';

// ── Constantes ────────────────────────────────────────────────────────────────

const PLANOS_CONFIG = [
  {
    id: 'SOLO' as PlanoClinica,
    label: 'Solo',
    tagline: 'Para você e sua equipe',
    preco: 'R$249',
    periodo: '/mês',
    minimo: null,
    icon: Stethoscope,
    features: [
      '1 Dentista + 1 Secretária',
      'IA, fichas e planejamento',
      'Agenda e financeiro',
      'Orçamentos e tratamentos',
    ],
  },
  {
    id: 'CLINICA' as PlanoClinica,
    label: 'Clínica',
    tagline: 'Para múltiplos dentistas',
    preco: 'R$179',
    periodo: '/dentista/mês',
    minimo: 'Mín. 3 dentistas · R$537/mês',
    badge: 'Popular',
    icon: Building2,
    features: [
      'A partir de 3 dentistas',
      'Secretária com visão unificada',
      'WhatsApp integrado',
      'Relatórios gerenciais',
    ],
  },
] as const;

const PERSONA_ICONS: Record<FocoPrincipal, typeof Clock> = {
  economizar_tempo: Clock,
  crescer: TrendingUp,
};

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome:            z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cro:             z.string().min(1, 'Informe o CRO'),
  especialidade:   especialidadesSchema,
  nomeConsultorio: z.string().min(2, 'Informe o nome'),
});

type FormData = z.infer<typeof schema>;

// ── Próximos passos ───────────────────────────────────────────────────────────

const PROXIMOS_PASSOS = [
  {
    icon: Calendar,
    label: 'Primeira consulta',
    desc:  'Agende sua primeira consulta e veja o modo de atendimento em ação.',
    href:  '/dashboard/agendamentos',
  },
  {
    icon: Users,
    label: 'Adicionar paciente',
    desc:  'Cadastre um paciente e comece a montar a ficha clínica.',
    href:  '/dashboard/pacientes',
  },
  {
    icon: Settings,
    label: 'Configurações',
    desc:  'Complete o endereço, horários e procedimentos.',
    href:  '/dashboard/configuracoes',
  },
] as const;

// ── Tipos ───────────────────────────────────────────────────────────────────────

export type OnboardingStep = 'identidade' | 'aha' | 'plano' | 'procedimentos' | 'sucesso';

interface OnboardingClientProps {
  /** Passo inicial — 'plano' quando volta da demo (?step=plano); senão 'identidade'. */
  initialStep: OnboardingStep;
  /** Persona já gravada (resumo da volta da demo) — alimenta a copy do sucesso. */
  focoInicial: FocoPrincipal | null;
  /** Primeiro nome do dentista (resumo da volta da demo) — saudação do sucesso. */
  nomeInicial: string;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function OnboardingClient({ initialStep, focoInicial, nomeInicial }: OnboardingClientProps) {
  const router = useRouter();
  const [step, setStep]               = useState<OnboardingStep>(initialStep);
  const [foco, setFoco]               = useState<FocoPrincipal | null>(focoInicial);
  const [planoSelecionado, setPlano]  = useState<PlanoClinica>('SOLO');
  const [nomeConfirmado, setNome]     = useState(nomeInicial);
  const [isLoading, setIsLoading]     = useState(false);
  const isSubmittingRef               = useRef(false);

  const isClinica = planoSelecionado === 'CLINICA';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', cro: '', nomeConsultorio: '', especialidade: [] },
  });

  const especialidadeValue = watch('especialidade');

  const inputClass =
    'w-full font-sans text-sm px-4 py-3 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all';

  // ── identidade → cria clínica+dentista (trial/SOLO) + persona, vai pro aha ──
  async function onSubmitIdentidade(data: FormData): Promise<void> {
    if (!foco) {
      toast.error('Escolha o que mais te ajudaria agora.');
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await iniciarOnboarding({
        nome:            data.nome,
        cro:             data.cro,
        especialidade:   data.especialidade,
        nomeConsultorio: data.nomeConsultorio,
        foco,
      });

      if (result.alreadyOnboarded) {
        router.replace('/dashboard');
        return;
      }
      if (result.success) {
        setNome(data.nome.trim().split(' ')[0]);
        setStep('aha');
      } else {
        toast.error(result.error ?? 'Erro ao salvar. Tente novamente.');
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  }

  // ── plano → grava plano definitivo, vai pros procedimentos ──
  async function onConfirmarPlano(): Promise<void> {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await definirPlano(planoSelecionado);
      if (error) {
        toast.error('Erro ao salvar o plano. Tente novamente.');
        return;
      }
      setStep('procedimentos');
    } finally {
      setIsLoading(false);
    }
  }

  // ── procedimentos → conclui onboarding, vai pro sucesso ──
  async function finalizar(pendente: boolean): Promise<void> {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await definirProcedimentosPendente(pendente);
      await marcarOnboardingCompleto();
      setStep('sucesso');
    } finally {
      setIsLoading(false);
    }
  }

  async function importarTabela(): Promise<void> {
    await marcarOnboardingCompleto();
    router.push('/dashboard/configuracoes?aba=procedimentos');
  }

  const personaCopy = getPersona(foco);

  return (
    <div className="w-full max-w-lg">
      <AnimatePresence mode="wait">

        {/* ── ETAPA 0 — Identidade + persona ── */}
        {step === 'identidade' && (
          <motion.div
            key="identidade"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-8">
              <div
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
              >
                <Stethoscope className="w-7 h-7" style={{ color: 'var(--color-teal)' }} />
              </div>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Vamos configurar seu consultório
              </h1>
              <p className="text-text-secondary text-sm">
                Menos de 2 minutos. Sem cartão.
              </p>
            </div>

            <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
              <form onSubmit={handleSubmit(onSubmitIdentidade)} className="p-8 space-y-5">

                {/* Nome completo */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Nome completo
                  </label>
                  <input
                    placeholder="Dr. João Silva"
                    disabled={isLoading}
                    className={inputClass}
                    {...register('nome')}
                  />
                  {errors.nome && <p className="text-xs text-coral">{errors.nome.message}</p>}
                </div>

                {/* CRO + Especialidade */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                      CRO
                    </label>
                    <input
                      placeholder="CRO-SP 12345"
                      disabled={isLoading}
                      className={inputClass}
                      {...register('cro')}
                    />
                    {errors.cro && <p className="text-xs text-coral">{errors.cro.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                      Especialidades
                    </label>
                    <EspecialidadeChips
                      selected={especialidadeValue ?? []}
                      onChange={(next) => setValue('especialidade', next, { shouldValidate: true })}
                      disabled={isLoading}
                    />
                    {errors.especialidade && <p className="text-xs text-coral">{errors.especialidade.message}</p>}
                  </div>
                </div>

                {/* Nome do consultório */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                    Nome do consultório
                  </label>
                  <input
                    placeholder="Ex: Consultório Oral Health"
                    disabled={isLoading}
                    className={inputClass}
                    {...register('nomeConsultorio')}
                  />
                  {errors.nomeConsultorio && <p className="text-xs text-coral">{errors.nomeConsultorio.message}</p>}
                </div>

                {/* Pergunta de persona */}
                <div className="space-y-2.5 pt-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                    O que mais te ajudaria agora?
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {PERSONA_IDS.map((id) => {
                      const p        = PERSONAS[id];
                      const Icon     = PERSONA_ICONS[id];
                      const selected = foco === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setFoco(id)}
                          className={[
                            'flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200',
                            selected
                              ? 'border-teal/40 bg-teal/5 ring-1 ring-teal/20'
                              : 'border-border bg-surface-alt hover:border-teal/20',
                          ].join(' ')}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                          >
                            <Icon className="w-4 h-4" style={{ color: 'var(--color-teal)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text-primary">{p.label}</p>
                            <p className="text-[11px] text-text-secondary leading-snug">{p.sublabel}</p>
                          </div>
                          {selected && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: 'var(--color-teal)' }}
                            >
                              <Check className="w-3 h-3 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                    : <>Continuar <ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ── ETAPA 1 — Aha (DEX + demo) ── */}
        {step === 'aha' && (
          <motion.div
            key="aha"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 18 }}
              className="flex justify-center mb-6"
            >
              <DexMark size={96} expression="feliz" />
            </motion.div>

            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-teal)' }}>
              Oi, eu sou o Dex
            </p>
            <h1 className="font-heading text-3xl text-text-primary mb-3 leading-tight">
              {personaCopy.promessaAha}
            </h1>
            <p className="text-text-secondary text-sm mb-8 max-w-sm mx-auto leading-relaxed">
              Sem teoria. Você fala, eu monto a ficha na sua frente — em uma consulta de demonstração.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => router.push('/consulta/demo?from=onboarding')}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)]"
              >
                <Play className="w-4 h-4" /> Ver agora (1 min)
              </button>
              <button
                type="button"
                onClick={() => setStep('plano')}
                className="w-full text-center text-sm font-semibold text-text-secondary hover:text-text-primary py-2 transition-colors"
              >
                Pular por agora
              </button>
            </div>
          </motion.div>
        )}

        {/* ── ETAPA 2 — Seleção de plano ── */}
        {step === 'plano' && (
          <motion.div
            key="plano"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-8">
              <div
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
              >
                <Stethoscope className="w-7 h-7" style={{ color: 'var(--color-teal)' }} />
              </div>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Escolha seu plano
              </h1>
              <p className="text-text-secondary text-sm">
                14 dias grátis. Sem cartão agora — você pode mudar depois.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLANOS_CONFIG.map((p) => {
                const Icon      = p.icon;
                const selected  = planoSelecionado === p.id;
                const hasBadge  = 'badge' in p && p.badge;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlano(p.id)}
                    className={[
                      'relative p-5 rounded-3xl border text-left transition-all duration-200 group',
                      selected
                        ? 'border-teal/40 bg-teal/5 ring-1 ring-teal/20 shadow-sm'
                        : 'border-border bg-surface hover:border-teal/20 hover:bg-teal/[0.02]',
                    ].join(' ')}
                  >
                    {/* Badge "Popular" — canto superior ESQUERDO (não colide com o ✓) */}
                    {hasBadge && (
                      <span className="absolute top-3.5 left-3.5 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-teal/15 text-teal border border-teal/30">
                        {p.badge}
                      </span>
                    )}

                    {/* Checkmark quando selecionado — canto superior DIREITO */}
                    {selected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-teal)' }}
                      >
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </motion.div>
                    )}

                    <div
                      className={[
                        'w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors',
                        hasBadge ? 'mt-5' : '',
                      ].join(' ')}
                      style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                    </div>

                    <p className="font-heading text-lg text-text-primary mb-0.5">{p.label}</p>
                    <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">{p.tagline}</p>

                    <div className="mb-1">
                      <span className="font-mono text-2xl font-bold text-text-primary">{p.preco}</span>
                      <span className="text-[11px] text-text-secondary ml-1">{p.periodo}</span>
                    </div>

                    {p.minimo
                      ? <p className="text-[10px] font-bold text-amber-500/80 mb-4">{p.minimo}</p>
                      : <div className="mb-4" />}

                    <ul className="space-y-1.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[11px] text-text-secondary">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                          >
                            <Check className="w-2 h-2 stroke-[3]" style={{ color: 'var(--color-teal)' }} />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {isClinica && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-center text-[11px] text-text-secondary mb-4"
              >
                Mínimo 3 dentistas · Cada dentista assina individualmente
              </motion.p>
            )}

            <button
              type="button"
              onClick={onConfirmarPlano}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <>Continuar com plano {planoSelecionado === 'SOLO' ? 'Solo' : 'Clínica'} <ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </motion.div>
        )}

        {/* ── ETAPA 3 — Procedimentos ── */}
        {step === 'procedimentos' && (
          <motion.div
            key="procedimentos"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-center mb-8">
              <div
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
              >
                <Settings className="w-7 h-7" style={{ color: 'var(--color-teal)' }} />
              </div>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Seus procedimentos
              </h1>
              <p className="text-text-secondary text-sm leading-relaxed max-w-sm mx-auto">
                Já incluímos uma tabela padrão com os procedimentos mais comuns. Use agora e ajuste depois, ou importe sua própria tabela.
              </p>
            </div>

            <div className="bg-surface rounded-3xl border border-border shadow-sm p-6 mb-4">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                >
                  <Check className="w-4 h-4" style={{ color: 'var(--color-teal)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-0.5">Tabela padrão incluída</p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Restaurações, exodontias, implantes, limpeza e mais 20 procedimentos prontos para uso.
                  </p>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Você pode adicionar, editar ou remover procedimentos a qualquer momento em{' '}
                <span className="font-semibold text-text-primary">Configurações → Procedimentos</span>.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => finalizar(false)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Finalizando...</>
                  : <>Usar tabela padrão <ChevronRight className="w-4 h-4" /></>
                }
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={importarTabela}
                className="w-full flex items-center justify-center gap-2 border border-border bg-surface hover:bg-surface-alt text-text-primary py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60"
              >
                Importar minha tabela
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => finalizar(true)}
                className="w-full text-center text-sm font-semibold text-text-secondary hover:text-text-primary py-2 transition-colors disabled:opacity-60"
              >
                Configurar depois
              </button>
            </div>
          </motion.div>
        )}

        {/* ── ETAPA 4 — Sucesso ── */}
        {step === 'sucesso' && (
          <motion.div
            key="sucesso"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 18 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)' }}
            >
              <CheckCircle2 className="w-10 h-10" style={{ color: 'var(--color-teal)' }} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Tudo configurado{nomeConfirmado ? `, Dr. ${nomeConfirmado}` : ''}!
              </h1>
              <p className="text-text-secondary text-sm mb-8">
                {personaCopy.sucesso}
              </p>
            </motion.div>

            {isClinica && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="mb-6 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6 text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">
                      Ação necessária
                    </p>
                    <p className="font-heading text-lg text-text-primary">Monte sua equipe</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={[
                          'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
                          n === 1
                            ? 'border-teal bg-teal/10 text-teal'
                            : 'border-border bg-surface-alt text-text-secondary',
                        ].join(' ')}
                      >
                        {n === 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : n}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-text-secondary mb-1">
                  O plano Clínica exige <span className="font-bold text-text-primary">mínimo 3 dentistas</span>. Você é o dentista 1.
                </p>
                <p className="text-sm text-text-secondary mb-5">
                  A cobrança mínima será <span className="font-bold text-text-primary">R$537/mês</span> (3 × R$179). Cada colega assina individualmente com o próprio cartão.
                </p>

                <a
                  href="/dashboard/configuracoes?aba=equipe"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
                >
                  <Users className="w-4 h-4" />
                  Convidar colegas agora
                </a>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={isClinica ? 'grid grid-cols-2 gap-3 mb-8' : 'grid grid-cols-3 gap-3 mb-8'}
            >
              {(isClinica ? PROXIMOS_PASSOS.slice(0, 2) : PROXIMOS_PASSOS).map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="bg-surface rounded-2xl border border-border p-4 flex flex-col items-center gap-2 text-center hover:border-teal/40 hover:bg-teal/5 transition-all group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                    >
                      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" style={{ color: 'var(--color-teal)' }} />
                    </div>
                    <p className="text-xs font-semibold text-text-primary leading-tight">{item.label}</p>
                    <p className="text-[11px] text-text-secondary leading-snug">{item.desc}</p>
                  </a>
                );
              })}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full max-w-xs bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)]"
              >
                Ir para o dashboard
                <ChevronRight className="w-4 h-4" />
              </a>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
