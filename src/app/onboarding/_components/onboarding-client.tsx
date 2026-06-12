'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Users, Settings, CheckCircle2, Loader2, ChevronRight,
  Stethoscope, Building2, Check, ArrowLeft,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { completeOnboarding, type PlanoClinica } from '../actions';
import { toast } from 'sonner';

// ── Constantes ────────────────────────────────────────────────────────────────

const ESPECIALIDADES = [
  'Clínico Geral',
  'Ortodontia',
  'Endodontia',
  'Implantodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia',
  'Outro',
] as const;

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

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome:            z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cro:             z.string().min(1, 'Informe o CRO'),
  especialidade:   z.enum(ESPECIALIDADES),
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

// ── Componente ────────────────────────────────────────────────────────────────

export function OnboardingClient({ plano }: { plano: PlanoClinica }) {
  const [step, setStep]                     = useState<'plano' | 'form' | 'sucesso'>('plano');
  const [planoSelecionado, setPlano]        = useState<PlanoClinica>(plano);
  const [nomeConfirmado, setNome]           = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const isSubmittingRef                     = useRef(false);

  const isClinica  = planoSelecionado === 'CLINICA';
  const labelLocal = isClinica ? 'clínica' : 'consultório';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', cro: '', nomeConsultorio: '' },
  });

  const especialidadeValue = watch('especialidade');

  const inputClass =
    'w-full font-sans text-sm px-4 py-3 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all';

  async function onSubmit(data: FormData): Promise<void> {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      const result = await completeOnboarding({
        plano:           planoSelecionado,
        nome:            data.nome,
        cro:             data.cro,
        especialidade:   data.especialidade,
        nomeConsultorio: data.nomeConsultorio,
      });

      if (result.success) {
        setNome(data.nome.split(' ')[0]);
        setStep('sucesso');
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

  return (
    <div className="w-full max-w-lg">
      <AnimatePresence mode="wait">

        {/* ── ETAPA 0 — Seleção de plano ── */}
        {step === 'plano' && (
          <motion.div
            key="plano"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div
                className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5"
                style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
              >
                <Stethoscope className="w-7 h-7" style={{ color: 'var(--color-teal)' }} />
              </div>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Como você vai usar o Odonto.IA?
              </h1>
              <p className="text-text-secondary text-sm">
                Escolha o plano que melhor se encaixa no seu perfil.
              </p>
            </div>

            {/* Cards de plano */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {PLANOS_CONFIG.map((p) => {
                const Icon      = p.icon;
                const selected  = planoSelecionado === p.id;
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
                    {/* Badge "Popular" */}
                    {'badge' in p && p.badge && (
                      <span
                        className="absolute top-3.5 right-3.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{
                          background: 'color-mix(in srgb, var(--color-teal) 15%, transparent)',
                          color: 'var(--color-teal)',
                        }}
                      >
                        {p.badge}
                      </span>
                    )}

                    {/* Checkmark quando selecionado */}
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

                    {/* Ícone */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors"
                      style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: 'var(--color-teal)' }} />
                    </div>

                    {/* Nome + tagline */}
                    <p className="font-heading text-lg text-text-primary mb-0.5">{p.label}</p>
                    <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">{p.tagline}</p>

                    {/* Preço */}
                    <div className="mb-1">
                      <span className="font-mono text-2xl font-bold text-text-primary">{p.preco}</span>
                      <span className="text-[11px] text-text-secondary ml-1">{p.periodo}</span>
                    </div>

                    {/* Mínimo de cobrança */}
                    {p.minimo && (
                      <p className="text-[10px] font-bold text-amber-500/80 mb-4">{p.minimo}</p>
                    )}
                    {!p.minimo && <div className="mb-4" />}

                    {/* Features */}
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

            {/* Nota */}
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

            {/* CTA */}
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)]"
            >
              Continuar com plano {planoSelecionado === 'SOLO' ? 'Solo' : 'Clínica'}
              <ChevronRight className="w-4 h-4" />
            </button>

            <p className="text-center text-[11px] text-text-secondary mt-4">
              Você pode mudar de plano a qualquer momento
            </p>
          </motion.div>
        )}

        {/* ── ETAPA 1 — Formulário ── */}
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              {/* Badge de plano clicável (volta) */}
              <button
                type="button"
                onClick={() => setStep('plano')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 transition-opacity hover:opacity-70"
                style={{
                  background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)',
                  color: 'var(--color-teal)',
                }}
              >
                <ArrowLeft className="w-3 h-3" />
                Plano {planoSelecionado === 'SOLO' ? 'Solo' : 'Clínica'}
              </button>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Configure {isClinica ? 'sua clínica' : 'seu consultório'}
              </h1>
              <p className="text-text-secondary text-sm">
                Menos de 2 minutos para começar.
              </p>
            </div>

            {/* Card do form */}
            <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
              <div className="p-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

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
                    {errors.nome && (
                      <p className="text-xs text-coral">{errors.nome.message}</p>
                    )}
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
                      {errors.cro && (
                        <p className="text-xs text-coral">{errors.cro.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                        Especialidade
                      </label>
                      <Select
                        value={especialidadeValue ?? ''}
                        onValueChange={(v) =>
                          setValue('especialidade', v as typeof ESPECIALIDADES[number], { shouldValidate: true })
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-full h-[46px] rounded-xl border border-border bg-surface-alt text-text-primary text-sm px-4">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESPECIALIDADES.map((esp) => (
                            <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.especialidade && (
                        <p className="text-xs text-coral">{errors.especialidade.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Nome do consultório / clínica */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                      Nome {isClinica ? 'da clínica' : 'do consultório'}
                    </label>
                    <input
                      placeholder={`Ex: ${isClinica ? 'Clínica' : 'Consultório'} Oral Health`}
                      disabled={isLoading}
                      className={inputClass}
                      {...register('nomeConsultorio')}
                    />
                    {errors.nomeConsultorio && (
                      <p className="text-xs text-coral">{errors.nomeConsultorio.message}</p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(47,156,133,0.45)] disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Configurando...</>
                      : <>Concluir configuração <ChevronRight className="w-4 h-4" /></>
                    }
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ETAPA 2 — Sucesso ── */}
        {step === 'sucesso' && (
          <motion.div
            key="sucesso"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            {/* Check animado */}
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
                {isClinica
                  ? 'Sua clínica foi criada. Agora convide sua equipe.'
                  : 'Seu consultório está pronto para receber os primeiros pacientes.'}
              </p>
            </motion.div>

            {/* Card "Monte sua equipe" — apenas Clínica */}
            {isClinica && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="mb-6 rounded-3xl border border-amber-500/25 bg-amber-500/5 p-6 text-left"
              >
                {/* Header do card */}
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

                {/* Explicação */}
                <p className="text-sm text-text-secondary mb-1">
                  O plano Clínica exige <span className="font-bold text-text-primary">mínimo 3 dentistas</span>. Você é o dentista 1.
                </p>
                <p className="text-sm text-text-secondary mb-5">
                  A cobrança mínima será <span className="font-bold text-text-primary">R$537/mês</span> (3 × R$179). Cada colega assina individualmente com o próprio cartão.
                </p>

                {/* CTA de convite */}
                <a
                  href="/dashboard/configuracoes?aba=equipe"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
                >
                  <Users className="w-4 h-4" />
                  Convidar colegas agora
                </a>
              </motion.div>
            )}

            {/* Próximos passos — Solo ou complementar para Clínica */}
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

            {/* CTA principal */}
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
