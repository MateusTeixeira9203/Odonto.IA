'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, ChevronRight, Loader2, Stethoscope, UserRound, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { iniciarOnboardingModalidade } from '../actions';
import { especialidadesSchema } from '@/lib/especialidades';
import { EspecialidadeChips } from '@/components/ui/especialidade-chips';
import { DexApresentacao } from './dex-apresentacao';

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo.'),
  nomeConsultorio: z.string().trim().min(2, 'Informe o nome da clínica.'),
  cro: z.string().trim(),
  especialidade: especialidadesSchema,
});

type CadastroForm = z.infer<typeof cadastroSchema>;
export type OnboardingStep = 'modalidade' | 'dados' | 'dex';
type Modalidade = 'colaborativa' | 'gerida';

interface OnboardingClientProps {
  initialStep: OnboardingStep;
}

const inputClass = 'w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-60';

export function OnboardingClient({ initialStep }: OnboardingClientProps): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [modalidade, setModalidade] = useState<Modalidade>('colaborativa');
  const [criadorAtende, setCriadorAtende] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: { nome: '', nomeConsultorio: '', cro: '', especialidade: [] },
  });
  const especialidades = watch('especialidade');

  function escolherModalidade(next: Modalidade): void {
    setModalidade(next);
    if (next === 'colaborativa') setCriadorAtende(true);
  }

  async function salvarDados(data: CadastroForm): Promise<void> {
    if (isLoading) return;
    if (criadorAtende && (!data.cro || data.especialidade.length === 0)) {
      toast.error('Informe o CRO e ao menos uma especialidade de quem atende.');
      return;
    }
    setIsLoading(true);
    submissionKey.current ??= crypto.randomUUID();
    try {
      const result = await iniciarOnboardingModalidade({
        nome: data.nome,
        nomeConsultorio: data.nomeConsultorio,
        cro: criadorAtende ? data.cro : null,
        especialidade: criadorAtende ? data.especialidade : [],
        foco: criadorAtende ? 'economizar_tempo' : null,
        modalidade,
        criadorAtende,
        chaveIdempotencia: submissionKey.current,
      });
      if (!result.success) {
        submissionKey.current = null;
        toast.error(result.error ?? 'Não foi possível criar a clínica agora.');
        return;
      }
      if (!criadorAtende) {
        window.location.assign('/consultorio');
        return;
      }
      setStep('dex');
    } catch {
      submissionKey.current = null;
      toast.error('Não foi possível criar a clínica agora.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={step === 'dex' ? 'w-full max-w-5xl' : 'w-full max-w-2xl'}>
      <AnimatePresence mode="wait">
        {step === 'modalidade' && (
          <motion.section key="modalidade" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
            <div className="mx-auto mb-8 max-w-xl text-center">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-teal-pale text-teal-ink"><Building2 className="size-7" /></div>
              <h1 className="font-heading text-3xl text-text-primary">Como sua clínica funciona?</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">Escolha a modalidade para organizar acessos, operação e financeiro desde o começo.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ModeCard active={modalidade === 'colaborativa'} icon={<Users className="size-5" />} title="Colaborativa" description="Os dentistas pertencem à clínica, compartilham pacientes e estoque, e cada um acompanha seu próprio financeiro." onClick={() => escolherModalidade('colaborativa')} />
              <ModeCard active={modalidade === 'gerida'} icon={<Stethoscope className="size-5" />} title="Gerida" description="A clínica centraliza a gestão. O proprietário acompanha equipe, operação, indicadores e os recebimentos da clínica." onClick={() => escolherModalidade('gerida')} />
            </div>
            <button type="button" onClick={() => setStep('dados')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"><span>Continuar</span><ChevronRight className="size-4" /></button>
          </motion.section>
        )}

        {step === 'dados' && (
          <motion.section key="dados" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24 }}>
            <div className="mx-auto mb-7 max-w-xl text-center">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-teal-pale text-teal-ink"><UserRound className="size-7" /></div>
              <h1 className="font-heading text-3xl text-text-primary">Dados iniciais da clínica</h1>
              <p className="mt-2 text-sm text-text-secondary">Você poderá completar os demais dados da operação depois.</p>
            </div>
            <form onSubmit={handleSubmit(salvarDados)} className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
              <div className="space-y-5">
                <Field label="Seu nome" error={errors.nome?.message}><input className={inputClass} placeholder="Seu nome completo" disabled={isLoading} {...register('nome')} /></Field>
                <Field label="Nome da clínica" error={errors.nomeConsultorio?.message}><input className={inputClass} placeholder="Ex: Clínica Sorriso" disabled={isLoading} {...register('nomeConsultorio')} /></Field>
                {modalidade === 'gerida' && <div className="rounded-xl border border-border bg-surface-alt p-4"><p className="text-sm font-medium text-text-primary">Você também atende pacientes nesta clínica?</p><div className="mt-3 flex gap-2"><Choice active={criadorAtende} label="Sim, sou dentista" onClick={() => setCriadorAtende(true)} /><Choice active={!criadorAtende} label="Não, sou proprietário/gestor" onClick={() => setCriadorAtende(false)} /></div></div>}
                {criadorAtende && <>
                  <Field label="CRO" error={errors.cro?.message}><input className={inputClass} placeholder="CRO-SP 12345" disabled={isLoading} {...register('cro')} /></Field>
                  <div><p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-text-secondary">Especialidades</p><EspecialidadeChips selected={especialidades} onChange={(next) => setValue('especialidade', next, { shouldValidate: true })} disabled={isLoading} />{errors.especialidade && <p className="mt-1 text-xs text-destructive">{errors.especialidade.message}</p>}</div>
                </>}
              </div>
              <div className="mt-7 flex gap-3"><button type="button" disabled={isLoading} onClick={() => setStep('modalidade')} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-text-primary hover:bg-surface-alt disabled:opacity-60">Voltar</button><button type="submit" disabled={isLoading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60">{isLoading ? <><Loader2 className="size-4 animate-spin" />Criando clínica...</> : <>Criar clínica<ChevronRight className="size-4" /></>}</button></div>
            </form>
          </motion.section>
        )}

        {step === 'dex' && <DexApresentacao key="dex" pendente={isLoading} onContinuar={() => { router.push('/dashboard/meu-dia'); }} onPular={() => { router.push('/dashboard/meu-dia'); }} />}
      </AnimatePresence>
    </div>
  );
}

function ModeCard({ active, icon, title, description, onClick }: { active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }): React.JSX.Element {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-6 text-left transition-colors ${active ? 'border-teal bg-teal-pale/60 ring-1 ring-teal/20' : 'border-border bg-surface hover:bg-surface-alt'}`}><div className="mb-5 flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-teal-pale text-teal-ink">{icon}</span>{active && <span className="flex size-5 items-center justify-center rounded-full bg-teal text-primary-foreground"><Check className="size-3" /></span>}</div><h2 className="font-heading text-xl text-text-primary">{title}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p></button>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }): React.JSX.Element {
  return <div><label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-text-secondary">{label}</label>{children}{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div>;
}

function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }): React.JSX.Element {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-teal bg-teal-pale text-teal-ink' : 'border-border bg-surface text-text-secondary hover:bg-surface'}`}>{label}</button>;
}
