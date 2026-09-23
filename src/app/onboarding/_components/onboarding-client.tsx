'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, ChevronLeft, ChevronRight, Loader2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { criarConviteEquipeAction, iniciarOnboardingModalidade } from '../actions';
import type { Especialidade } from '@/lib/especialidades';
import { EspecialidadeChips } from '@/components/ui/especialidade-chips';

const schema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo.'),
  nomeConsultorio: z.string().trim().min(2, 'Informe o nome da clínica.'),
  cro: z.string().trim(),
  especialidade: z.array(z.string().trim().min(1)).max(12),
});
type FormData = z.infer<typeof schema>;
export type OnboardingStep = 'modalidade' | 'previsao' | 'equipe';
type Modalidade = 'colaborativa' | 'gerida';
type InviteType = 'dentista' | 'gestor' | 'responsavel_tecnico';
const inputClass = 'w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-teal focus:ring-2 focus:ring-teal/20';
const motionProps = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.2 } };

export function OnboardingClient({ initialStep }: { initialStep: OnboardingStep }): React.JSX.Element {
  const [step, setStep] = useState(initialStep);
  const [modalidade, setModalidade] = useState<Modalidade>('gerida');
  const [criadorAtende, setCriadorAtende] = useState(true);
  const [quantidade, setQuantidade] = useState(1);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteType, setInviteType] = useState<InviteType | null>(null);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const key = useRef<string | null>(null);
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { nome: '', nomeConsultorio: '', cro: '', especialidade: [] } });
  const especialidades = form.watch('especialidade');
  const minimum = criadorAtende || modalidade === 'colaborativa' ? 1 : 0;
  const vagas = Math.max(0, quantidade - (criadorAtende ? 1 : 0));

  function chooseMode(next: Modalidade): void {
    setModalidade(next);
    if (next === 'colaborativa') {
      setCriadorAtende(true);
      setQuantidade((value) => Math.max(1, value));
    }
  }

  async function continueToForecast(): Promise<void> {
    const fields: Array<keyof FormData> = criadorAtende ? ['nome', 'nomeConsultorio', 'cro', 'especialidade'] : ['nome', 'nomeConsultorio'];
    if (!(await form.trigger(fields))) return;
    const values = form.getValues();
    if (criadorAtende && (!values.cro || values.especialidade.length === 0)) {
      toast.error('Informe o CRO e ao menos uma especialidade.');
      return;
    }
    setQuantidade((value) => Math.max(minimum, value));
    setStep('previsao');
  }

  async function createClinic(): Promise<void> {
    if (loading) return;
    const values = form.getValues();
    setLoading(true);
    key.current ??= crypto.randomUUID();
    try {
      const result = await iniciarOnboardingModalidade({
        nome: values.nome, nomeConsultorio: values.nomeConsultorio, modalidade, criadorAtende,
        cro: criadorAtende ? values.cro : null, especialidade: criadorAtende ? values.especialidade as Especialidade[] : [],
        foco: criadorAtende ? 'economizar_tempo' : null, chaveIdempotencia: key.current,
        quantidadeDentistasPrevista: quantidade,
      });
      if (!result.success || !result.clinicaId) {
        key.current = null;
        toast.error(result.error ?? 'Não foi possível criar a clínica agora.');
        return;
      }
      setClinicId(result.clinicaId);
      setStep('equipe');
    } catch {
      key.current = null;
      toast.error('Não foi possível criar a clínica agora.');
    } finally { setLoading(false); }
  }

  async function sendInvite(): Promise<void> {
    if (!clinicId || !inviteType || loading) return;
    setLoading(true);
    try {
      const result = await criarConviteEquipeAction({
        clinicaId: clinicId, nome: inviteName, email: inviteEmail, tipo: inviteType, chaveIdempotencia: crypto.randomUUID(),
      });
      if (!result.success) { toast.error(result.error ?? 'Não foi possível criar o convite.'); return; }
      toast.success(result.emailEnviado ? 'Convite enviado.' : 'Convite criado, mas o e-mail não pôde ser enviado.');
      setInviteType(null); setInviteName(''); setInviteEmail('');
    } finally { setLoading(false); }
  }
  function finish(): void { window.location.assign(criadorAtende ? '/dashboard' : '/consultorio'); }
  const values = form.getValues();

  return <div className="w-full max-w-2xl">
    <Progress step={step} />
    <AnimatePresence mode="wait">
      {step === 'modalidade' && <motion.section key="modalidade" {...motionProps} className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-sm">
        <div className="p-6 sm:p-8">
          <Eyebrow>Sua clínica</Eyebrow><h1 className="mt-2 font-heading text-3xl text-text-primary">Como sua clínica funciona?</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Isso organiza a gestão e como cada dentista acompanha o próprio trabalho.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ModeCard active={modalidade === 'gerida'} icon={<Building2 className="size-5" />} title="Clínica gerida" description="A clínica tem proprietário ou gestor e acompanha a operação completa." onClick={() => chooseMode('gerida')} />
            <ModeCard active={modalidade === 'colaborativa'} icon={<Users className="size-5" />} title="Clínica colaborativa" description="Dentistas compartilham pacientes e estoque; cada um acompanha seu financeiro." onClick={() => chooseMode('colaborativa')} />
          </div>
          <Field label="Seu nome" error={form.formState.errors.nome?.message}><input className={inputClass} placeholder="Seu nome completo" {...form.register('nome')} /></Field>
          <Field label="Nome da clínica" error={form.formState.errors.nomeConsultorio?.message}><input className={inputClass} placeholder="Ex: Clínica Sorriso" {...form.register('nomeConsultorio')} /></Field>
          {modalidade === 'gerida' && <div className="mt-5 rounded-xl border border-border bg-surface-alt p-4"><p className="text-sm font-semibold text-text-primary">Você também atende nesta clínica?</p><div className="mt-3 flex gap-2"><Choice active={criadorAtende} label="Sim, sou dentista" onClick={() => { setCriadorAtende(true); setQuantidade((value) => Math.max(1, value)); }} /><Choice active={!criadorAtende} label="Não, sou proprietário" onClick={() => setCriadorAtende(false)} /></div></div>}
          {criadorAtende && <div className="mt-5 space-y-5"><Field label="CRO" error={form.formState.errors.cro?.message}><input className={inputClass} placeholder="CRO-SP 12345" {...form.register('cro')} /></Field><div><Eyebrow>Especialidades</Eyebrow><div className="mt-2"><EspecialidadeChips selected={especialidades as Especialidade[]} onChange={(next) => form.setValue('especialidade', next, { shouldValidate: true })} /></div></div></div>}
        </div><Footer primary="Continuar" onPrimary={() => void continueToForecast()} />
      </motion.section>}

      {step === 'previsao' && <motion.section key="previsao" {...motionProps} className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-sm">
        <div className="p-6 sm:p-8"><Eyebrow>Previsão da equipe</Eyebrow><h1 className="mt-2 font-heading text-3xl text-text-primary">Quantos dentistas atenderão?</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{criadorAtende ? 'Inclua você na conta se também atende.' : 'Informe apenas quem atenderá na clínica.'}</p>
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-border p-4"><div><h2 className="text-sm font-semibold text-text-primary">Dentistas que atenderão</h2><p className="mt-1 text-xs text-text-secondary">{criadorAtende ? 'Inclui você.' : 'A clínica pode começar sem dentista.'}</p></div><div className="flex items-center gap-3"><AmountButton label="Diminuir" onClick={() => setQuantidade((value) => Math.max(minimum, value - 1))}><ChevronLeft className="size-4" /></AmountButton><span className="min-w-5 text-center text-lg font-bold text-text-primary">{quantidade}</span><AmountButton label="Aumentar" onClick={() => setQuantidade((value) => value + 1)}><Plus className="size-4" /></AmountButton></div></div>
          <div className="mt-4 rounded-2xl border border-teal/25 bg-teal-pale p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-semibold text-text-primary">Previsão mensal</h2><strong className="font-heading text-2xl text-teal-ink">R$ {quantidade * 200}/mês</strong></div><p className="mt-2 text-sm leading-6 text-text-secondary">{modalidade === 'colaborativa' ? 'Cada dentista tem assinatura individual. Cada pessoa escolhe e paga a própria assinatura.' : 'A clínica responde pelos acessos. A estimativa considera todos os dentistas previstos.'}</p></div>
          <p className="mt-4 border-l-2 border-teal pl-3 text-xs leading-5 text-text-secondary">Ainda não haverá cobrança, reserva de vaga ou contrato. A quantidade prevista não limita sua equipe.</p>
        </div><Footer back={() => setStep('modalidade')} primary={loading ? 'Criando clínica...' : 'Criar clínica'} loading={loading} onPrimary={() => void createClinic()} />
      </motion.section>}

      {step === 'equipe' && <motion.section key="equipe" {...motionProps} className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-sm">
        <div className="flex gap-3 border-b border-border bg-surface-alt/60 px-6 py-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-pale text-teal-ink"><Check className="size-5" /></span><div><h2 className="text-sm font-semibold text-text-primary">{values.nomeConsultorio} criada</h2><p className="mt-0.5 text-xs text-text-secondary">{modalidade === 'gerida' ? 'Clínica gerida' : 'Clínica colaborativa'} · {quantidade} dentista(s) previsto(s)</p></div></div>
        <div className="p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><Eyebrow>Montar equipe</Eyebrow><h1 className="mt-2 font-heading text-3xl text-text-primary">Convide sua equipe</h1><p className="mt-2 text-sm leading-6 text-text-secondary">Cada pessoa recebe um convite no próprio e-mail e cria sua senha ao aceitar.</p></div><span className="shrink-0 rounded-full bg-teal-pale px-2.5 py-1 text-xs font-bold text-teal-ink">{criadorAtende ? 1 : 0} de {quantidade}</span></div>
          <div className="mt-6 space-y-3"><MemberCard name="Você" subtitle={criadorAtende ? 'Proprietário · Dentista' : 'Proprietário'} initials={values.nome.slice(0, 2).toUpperCase()} />{vagas > 0 && <AddCard title="Adicionar dentista" description="Nome e e-mail de quem atenderá na clínica." onClick={() => setInviteType('dentista')} />}<AddCard title="Adicionar gestão" description="Responsável técnico ou gestor da clínica." onClick={() => setInviteType('gestor')} /></div>
          <p className="mt-5 text-center text-xs text-text-secondary">Você pode montar a equipe agora ou <button type="button" className="font-semibold text-teal-ink underline" onClick={finish}>configurar depois</button>.</p>
        </div><Footer back={() => setStep('previsao')} primary="Ir para minha clínica" onPrimary={finish} />
      </motion.section>}
    </AnimatePresence>
    {inviteType && <InviteDialog type={inviteType} name={inviteName} email={inviteEmail} loading={loading} onType={setInviteType} onName={setInviteName} onEmail={setInviteEmail} onCancel={() => setInviteType(null)} onSubmit={() => void sendInvite()} />}
  </div>;
}

function Eyebrow({ children }: { children: React.ReactNode }): React.JSX.Element { return <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-ink">{children}</p>; }
function Progress({ step }: { step: OnboardingStep }): React.JSX.Element { const current = step === 'modalidade' ? 1 : step === 'previsao' ? 2 : 3; const label = step === 'modalidade' ? 'modalidade' : step === 'previsao' ? 'previsão' : 'equipe'; return <div className="mb-7 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-text-secondary"><span>{current} de 3 · {label}</span>{[1, 2, 3].map((item) => <i key={item} className={item < current ? 'h-2 w-2 rounded-full bg-teal-ink' : item === current ? 'h-2 w-6 rounded-full bg-teal' : 'h-2 w-2 rounded-full bg-border'} />)}</div>; }
function Footer({ primary, onPrimary, back, loading }: { primary: string; onPrimary: () => void; back?: () => void; loading?: boolean }): React.JSX.Element { return <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-alt/30 px-6 py-4"><button type="button" onClick={back} disabled={!back || loading} className="text-sm font-semibold text-text-secondary disabled:opacity-0">Voltar</button><button type="button" disabled={loading} onClick={onPrimary} className="flex items-center gap-2 rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white hover:bg-teal-ink disabled:opacity-60">{loading && <Loader2 className="size-4 animate-spin" />}{primary}<ChevronRight className="size-4" /></button></div>; }
function ModeCard({ active, icon, title, description, onClick }: { active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }): React.JSX.Element { return <button type="button" onClick={onClick} className={active ? 'rounded-2xl border border-teal bg-teal-pale p-5 text-left ring-1 ring-teal/20' : 'rounded-2xl border border-border bg-surface p-5 text-left hover:border-teal/60'}><div className="flex items-center justify-between text-teal-ink">{icon}{active && <span className="flex size-5 items-center justify-center rounded-full bg-teal text-white"><Check className="size-3" /></span>}</div><h2 className="mt-5 text-base font-semibold text-text-primary">{title}</h2><p className="mt-2 text-sm leading-5 text-text-secondary">{description}</p></button>; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }): React.JSX.Element { return <div className="mt-5"><label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-text-secondary">{label}</label>{children}{error && <p className="mt-1 text-xs text-destructive">{error}</p>}</div>; }
function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }): React.JSX.Element { return <button type="button" onClick={onClick} className={active ? 'rounded-lg border border-teal bg-teal-pale px-3 py-2 text-xs font-semibold text-teal-ink' : 'rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary'}>{label}</button>; }
function AmountButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }): React.JSX.Element { return <button type="button" aria-label={label} onClick={onClick} className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-text-secondary">{children}</button>; }
function MemberCard({ name, subtitle, initials }: { name: string; subtitle: string; initials: string }): React.JSX.Element { return <div className="flex items-center gap-3 rounded-2xl border border-teal/50 bg-teal-pale/30 p-3"><span className="flex size-10 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">{initials}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-text-primary">{name}</p><p className="text-xs text-text-secondary">{subtitle}</p></div><span className="rounded-full bg-teal-pale px-2 py-1 text-xs font-bold text-teal-ink">Já incluído</span></div>; }
function AddCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }): React.JSX.Element { return <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border p-4"><div><h2 className="text-sm font-semibold text-text-primary">{title}</h2><p className="mt-1 text-xs text-text-secondary">{description}</p></div><button type="button" onClick={onClick} className="text-sm font-bold text-teal-ink">Adicionar</button></div>; }
function InviteDialog({ type, name, email, loading, onType, onName, onEmail, onCancel, onSubmit }: { type: InviteType; name: string; email: string; loading: boolean; onType: (value: InviteType) => void; onName: (value: string) => void; onEmail: (value: string) => void; onCancel: () => void; onSubmit: () => void }): React.JSX.Element { const management = type !== 'dentista'; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-md rounded-[20px] border border-border bg-surface p-6 shadow-xl"><h2 className="font-heading text-2xl text-text-primary">{management ? 'Adicionar gestão' : 'Adicionar dentista'}</h2><p className="mt-2 text-sm leading-6 text-text-secondary">O convite é pessoal. A pessoa confirma o e-mail e cria a própria senha.</p>{management && <div className="mt-5"><Eyebrow>Função na gestão</Eyebrow><div className="mt-2 grid grid-cols-2 gap-2"><Choice active={type === 'gestor'} label="Gestor" onClick={() => onType('gestor')} /><Choice active={type === 'responsavel_tecnico'} label="Responsável técnico" onClick={() => onType('responsavel_tecnico')} /></div></div>}<Field label="Nome"><input value={name} onChange={(event) => onName(event.target.value)} className={inputClass} placeholder="Nome da pessoa" /></Field><Field label="E-mail"><input value={email} onChange={(event) => onEmail(event.target.value)} className={inputClass} type="email" placeholder="nome@exemplo.com" /></Field><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-text-primary">Cancelar</button><button type="button" disabled={loading} onClick={onSubmit} className="rounded-xl bg-teal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{loading ? 'Enviando...' : 'Enviar convite'}</button></div></div></div>; }
