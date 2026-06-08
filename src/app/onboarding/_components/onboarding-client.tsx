'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Users, Settings, CheckCircle2, Loader2, ChevronRight,
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

const PLANO_LABELS: Record<PlanoClinica, string> = {
  SOLO:    'Solo',
  CLINICA: 'Clínica',
};

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  nome:            z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cro:             z.string().min(1, 'Informe o CRO'),
  especialidade:   z.enum(ESPECIALIDADES),
  nomeConsultorio: z.string().min(2, 'Informe o nome do consultório'),
});

type FormData = z.infer<typeof schema>;

// ── Próximos passos (tela de sucesso) ─────────────────────────────────────────

const PROXIMOS_PASSOS = [
  {
    icon: Calendar,
    label:  'Primeira consulta',
    desc:   'Agende sua primeira consulta e veja o modo de atendimento em ação.',
    href:   '/dashboard/agendamentos',
    color:  'var(--color-teal)',
  },
  {
    icon: Users,
    label:  'Adicionar paciente',
    desc:   'Cadastre um paciente e comece a montar a ficha clínica.',
    href:   '/dashboard/pacientes',
    color:  'var(--color-teal)',
  },
  {
    icon: Settings,
    label:  'Configurar clínica',
    desc:   'Complete o endereço, horários e procedimentos da sua clínica.',
    href:   '/dashboard/configuracoes',
    color:  'var(--color-teal)',
  },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface OnboardingClientProps {
  plano: PlanoClinica;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function OnboardingClient({ plano }: OnboardingClientProps) {
  const [step, setStep]           = useState<'form' | 'sucesso'>('form');
  const [nomeConfirmado, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef           = useRef(false);

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
        plano,
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
              {/* Badge de plano */}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                style={{
                  background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)',
                  color: 'var(--color-teal)',
                }}
              >
                Plano {PLANO_LABELS[plano]}
              </span>
              <h1 className="font-heading text-3xl text-text-primary mb-2">
                Configure seu consultório
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

                  {/* Nome do consultório */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                      Nome do consultório
                    </label>
                    <input
                      placeholder="Ex: Clínica Oral Health"
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
              <p className="text-text-secondary text-sm mb-10">
                Seu consultório está pronto para receber os primeiros pacientes.
              </p>
            </motion.div>

            {/* Próximos passos */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="grid grid-cols-3 gap-3 mb-8"
            >
              {PROXIMOS_PASSOS.map((item) => {
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
