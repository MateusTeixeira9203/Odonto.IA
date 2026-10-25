'use client';

import { useState, useTransition, useMemo } from 'react';
import { Loader2, User, AlertCircle, Phone, MapPin, FileText, Users, Baby } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { createPaciente } from '../actions';
import type { CandidatoDuplicata } from '@/server/patients/buscar-duplicatas';
import { calcularIdade, PARENTESCO_OPTIONS, formatCpf } from '@/lib/paciente-form-helpers';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppLabel } from '@/components/ui/app-label';
import { AppFormField } from '@/components/ui/app-form-field';
import { BackHeader } from '@/components/ui/back-header';
import { DateInputDMY } from '@/components/ui/date-input-dmy';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-teal" />
      </div>
      <h2 className="font-heading text-lg text-text-primary">{title}</h2>
      {badge}
    </div>
  );
}

export default function NovoPacienteForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /** R-31a §3.1 — aviso de nome duplicado; nunca bloqueia, só pede confirmação. */
  const [duplicatas, setDuplicatas] = useState<CandidatoDuplicata[] | null>(null);

  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    endereco: '',
    cidade: '',
    estado: '',
    observacoes: '',
    responsavel_nome: '',
    responsavel_telefone: '',
    responsavel_parentesco: '',
  });

  const idade = useMemo(() => calcularIdade(form.data_nascimento), [form.data_nascimento]);
  const eMenor = idade !== null && idade < 18;

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const enviar = (confirmarMesmoAssim: boolean) => {
    startTransition(async () => {
      const result = await createPaciente({
        nome:            form.nome.trim(),
        cpf:             form.cpf.trim() || null,
        email:           form.email.trim() || null,
        telefone:        form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        endereco:        form.endereco.trim() || null,
        cidade:          form.cidade.trim() || null,
        estado:          form.estado.trim() || null,
        observacoes:     form.observacoes.trim() || null,
        responsavel_nome:       eMenor ? (form.responsavel_nome.trim() || null) : null,
        responsavel_telefone:   eMenor ? (form.responsavel_telefone.trim() || null) : null,
        responsavel_parentesco: eMenor ? (form.responsavel_parentesco || null) : null,
        confirmarMesmoAssim,
      });
      if (result.success) {
        toast.success('Paciente cadastrado com sucesso!');
        router.push('/dashboard/pacientes');
      } else if (result.duplicatas?.length) {
        setDuplicatas(result.duplicatas);
      } else {
        setError(result.error ?? 'Erro ao cadastrar paciente.');
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.nome.trim()) { setError('O nome do paciente é obrigatório.'); return; }
    if (eMenor && !form.responsavel_nome.trim()) { setError('Paciente menor de idade requer nome do responsável.'); return; }
    if (form.cpf) {
      const digits = form.cpf.replace(/\D/g, '');
      if (digits.length !== 11) { setError('CPF inválido. Digite os 11 dígitos.'); return; }
    }
    if (form.telefone) {
      const digits = form.telefone.replace(/\D/g, '');
      if (digits.length < 10) { setError('Telefone inválido. Digite DDD + número (mínimo 10 dígitos).'); return; }
    }
    enviar(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <BackHeader
        title="Novo Paciente"
        subtitle="Preencha os dados cadastrais do paciente."
        href="/dashboard/pacientes"
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6 pb-4">

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 bg-coral/5 border border-coral/20 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-coral shrink-0" />
                <p className="text-sm font-medium text-coral">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dados Pessoais */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            <SectionHeader icon={User} title="Dados Pessoais" />

            <AppFormField label="Nome Completo" htmlFor="nome" required>
              <AppInput id="nome" value={form.nome} onChange={set('nome')} placeholder="Ex: Maria Almeida" />
            </AppFormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AppFormField label="CPF" htmlFor="cpf" optional>
                <AppInput
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) => setForm((p) => ({ ...p, cpf: formatCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="font-mono"
                />
              </AppFormField>
              <AppFormField label="Data de Nascimento" htmlFor="data_nascimento" optional>
                <DateInputDMY
                  id="data_nascimento"
                  value={form.data_nascimento}
                  onChange={(iso) => setForm((p) => ({ ...p, data_nascimento: iso }))}
                />
              </AppFormField>
            </div>

            {/* Badge de menor de idade */}
            <AnimatePresence>
              {eMenor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-amber-400/30 bg-amber-400/5">
                    <Baby className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      Paciente menor de idade ({idade} anos) — dados do responsável obrigatórios.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Responsável — aparece automaticamente quando menor */}
          <AnimatePresence>
            {eMenor && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="bg-surface rounded-2xl border border-amber-400/25 shadow-sm p-6 space-y-5"
                style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.2), 0 4px 16px -4px rgba(251,191,36,0.1)' }}
              >
                <SectionHeader
                  icon={Users}
                  title="Responsável Legal"
                  badge={
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-500 border border-amber-400/20">
                      Obrigatório
                    </span>
                  }
                />

                {/* Parentesco como pills */}
                <div className="space-y-2">
                  <AppLabel>Parentesco</AppLabel>
                  <div className="flex flex-wrap gap-2">
                    {PARENTESCO_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, responsavel_parentesco: opt.value }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          form.responsavel_parentesco === opt.value
                            ? 'bg-teal/10 border-teal/40 text-teal'
                            : 'border-border text-text-secondary hover:border-teal/30 hover:text-teal bg-surface-alt'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <AppFormField label="Nome Completo do Responsável" htmlFor="responsavel-nome" required>
                  <AppInput
                    id="responsavel-nome"
                    value={form.responsavel_nome}
                    onChange={set('responsavel_nome')}
                    placeholder="Ex: João Almeida"
                  />
                </AppFormField>

                <AppFormField label="Telefone / WhatsApp do Responsável" htmlFor="responsavel-telefone" optional>
                  <AppInput
                    id="responsavel-telefone"
                    value={form.responsavel_telefone}
                    onChange={(e) => setForm((p) => ({ ...p, responsavel_telefone: formatPhone(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                    inputMode="numeric"
                  />
                </AppFormField>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Contato */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            <SectionHeader icon={Phone} title="Contato" />

            <AppFormField label="Telefone / WhatsApp" htmlFor="telefone" optional>
              <AppInput
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
            </AppFormField>

            <AppFormField label="Email" htmlFor="email" optional>
              <AppInput id="email" type="email" value={form.email} onChange={set('email')} placeholder="paciente@email.com" />
            </AppFormField>
          </motion.div>

          {/* Endereço */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            <SectionHeader icon={MapPin} title="Endereço" />

            <AppFormField label="Logradouro" htmlFor="endereco" optional>
              <AppInput id="endereco" value={form.endereco} onChange={set('endereco')} placeholder="Rua, número, complemento..." />
            </AppFormField>

            <div className="grid grid-cols-2 gap-4">
              <AppFormField label="Cidade" htmlFor="cidade" optional>
                <AppInput id="cidade" value={form.cidade} onChange={set('cidade')} placeholder="São Paulo" />
              </AppFormField>
              <AppFormField label="Estado" htmlFor="estado" optional>
                <AppInput id="estado" value={form.estado} onChange={set('estado')} placeholder="SP" maxLength={2} className="uppercase" />
              </AppFormField>
            </div>
          </motion.div>

          {/* Observações */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6"
          >
            <SectionHeader icon={FileText} title="Observações" />
            <AppTextarea
              id="observacoes"
              value={form.observacoes}
              onChange={set('observacoes')}
              placeholder="Alergias, histórico médico relevante, preferências de atendimento..."
              rows={4}
            />
          </motion.div>
        </div>

        {/* Sticky actions bar — rodapé ancorado (full-bleed no container, elevação via blur/sombra só, sem borda dura) */}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 rounded-t-2xl bg-surface/85 backdrop-blur-md shadow-[0_-8px_24px_-6px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            onClick={() => router.push('/dashboard/pacientes')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-text-secondary border border-border hover:bg-surface-alt hover:text-text-primary transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-[15px] font-bold text-white hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: 'linear-gradient(135deg, #2f9c85 0%, #1d7a65 100%)',
              boxShadow: '0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
            }}
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
            ) : (
              'Cadastrar Paciente'
            )}
          </button>
        </div>
      </form>

      {/* R-31a §3.1 — nome igual avisa, nunca bloqueia. */}
      <Dialog open={!!duplicatas} onOpenChange={(v) => { if (!v) setDuplicatas(null); }}>
        <DialogContent className="rounded-3xl border-border max-w-md">
          <DialogTitle className="font-heading font-semibold text-xl text-text-primary leading-tight">
            Já existe um paciente com este nome
          </DialogTitle>
          <DialogDescription className="text-text-muted text-sm">
            É a mesma pessoa, ou é outro paciente com nome parecido?
          </DialogDescription>

          <div className="space-y-2 py-2">
            {duplicatas?.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{d.nome}</p>
                  <p className="text-xs text-text-secondary">
                    {d.tem_ficha ? 'Já tem prontuário' : 'Sem prontuário ainda'}
                    {d.telefone ? ` · ${d.telefone}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-border text-text-primary hover:bg-surface-alt shrink-0"
                  onClick={() => router.push(`/dashboard/pacientes/${d.id}`)}
                >
                  Usar este
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setDuplicatas(null)}
              className="flex-1 rounded-xl border-border text-text-primary hover:bg-surface-alt"
            >
              Cancelar
            </Button>
            <Button
              disabled={isPending}
              onClick={() => { setDuplicatas(null); enviar(true); }}
              className="flex-1 rounded-xl bg-teal text-white hover:bg-teal-lt font-semibold"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cadastrar outro'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
