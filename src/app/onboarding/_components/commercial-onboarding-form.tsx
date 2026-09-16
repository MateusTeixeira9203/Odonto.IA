'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EspecialidadeChips } from '@/components/ui/especialidade-chips';
import type { Especialidade } from '@/lib/especialidades';
import { iniciarOnboardingR165 } from '../actions';

type Model = 'colaborativa' | 'dentista_proprietario' | 'proprietario';
type Payer = 'individual' | 'centralizada';
const MODELS: { value: Model; label: string; description: string }[] = [
  { value: 'colaborativa', label: 'Dentista em clínica colaborativa', description: 'Cada dentista administra seu trabalho, sem hierarquia entre os colegas.' },
  { value: 'dentista_proprietario', label: 'Dentista e proprietário', description: 'Você atende pacientes e administra a clínica.' },
  { value: 'proprietario', label: 'Proprietário sem atendimento', description: 'Você administra a clínica e a equipe, sem perfil de atendimento.' },
];

/** Formulário do piloto Free. A ativação comercial em produção depende do checkout R165. */
export function CommercialOnboardingForm() {
  const router = useRouter();
  const [model, setModel] = useState<Model>('colaborativa');
  const [payer, setPayer] = useState<Payer>('individual');
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [cro, setCro] = useState('');
  const [specialties, setSpecialties] = useState<Especialidade[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const clinical = model !== 'proprietario';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (clinical && specialties.length === 0) { setError('Selecione pelo menos uma especialidade.'); return; }
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await iniciarOnboardingR165({
        modalidade: model === 'colaborativa' ? 'individual' : payer,
        modeloClinica: model === 'colaborativa' ? 'colaborativa' : 'gerida',
        atuaClinicamente: clinical, nomeClinica: clinicName, nomeUsuario: name,
        cro: clinical ? cro : null, especialidades: clinical ? specialties : [],
      });
      if (!result.ok) {
        if (result.codigo === 'JA_CADASTRADO') { router.refresh(); return; }
        setError(result.codigo === 'INVALIDO' ? 'Revise os dados do cadastro.' : 'Não foi possível criar sua clínica. Tente novamente.');
        return;
      }
      // No piloto isolado a navegação já tem guard próprio; não criar pagamento/trial fictício.
      window.location.assign(result.data.dentistaId ? '/onboarding' : '/clinica');
    } catch { setError('Não foi possível criar sua clínica. Tente novamente.'); }
    finally { submitting.current = false; setPending(false); }
  }

  return <div className="w-full max-w-xl">
    <header className="mb-8 text-center">
      <h1 className="font-heading text-3xl text-foreground">Vamos configurar seu espaço</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escolha como você trabalha e quem será responsável pelos acessos.</p>
    </header>
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-5 text-foreground sm:p-8">
      <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Seu papel na clínica</legend>
        {MODELS.map(option => <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input className="mt-1 accent-primary" type="radio" name="clinic-model" value={option.value} checked={model === option.value} onChange={() => setModel(option.value)} />
          <span><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-sm text-muted-foreground">{option.description}</span></span>
        </label>)}
      </fieldset>
      <div className="space-y-2"><label htmlFor="commercial-name" className="text-sm font-medium">Nome completo</label><Input className="min-h-11" id="commercial-name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} disabled={pending} /></div>
      <div className="space-y-2"><label htmlFor="commercial-clinic" className="text-sm font-medium">Nome da clínica ou consultório</label><Input className="min-h-11" id="commercial-clinic" autoComplete="organization" required minLength={2} maxLength={120} value={clinicName} onChange={event=>setClinicName(event.target.value)} disabled={pending} /></div>
      {clinical && <>
        <div className="space-y-2"><label htmlFor="commercial-cro" className="text-sm font-medium">CRO</label><Input className="min-h-11" id="commercial-cro" required maxLength={60} value={cro} onChange={event=>setCro(event.target.value)} disabled={pending} placeholder="CRO-SP 12345" /></div>
        <fieldset><legend className="mb-2 text-sm font-medium">Especialidades</legend><EspecialidadeChips selected={specialties} onChange={setSpecialties} disabled={pending} /></fieldset>
      </>}
      {model !== 'colaborativa' && <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-2 text-sm font-semibold">Quem paga os acessos dos dentistas?</legend>
        {([{ value: 'centralizada', label: 'O proprietário paga por todos' }, { value: 'individual', label: 'Cada dentista paga o próprio acesso' }] as const).map(option => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary">
          <input className="accent-primary" type="radio" name="payer" value={option.value} checked={payer === option.value} onChange={()=>setPayer(option.value)} /><span className="text-sm">{option.label}</span>
        </label>)}
      </fieldset>}
      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold">R$ 200 por dentista/mês</p>
        <p className="text-muted-foreground">O proprietário que atende conta como um dentista. Proprietário sem atendimento e recepção estão incluídos enquanto a clínica tiver dentistas com pagamento ativo.</p>
        <p className="text-muted-foreground">Neste ambiente de teste, a escolha é registrada sem gerar cobrança.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{pending ? 'Criando…' : 'Criar espaço de teste'}</Button>
    </form>
  </div>;
}
