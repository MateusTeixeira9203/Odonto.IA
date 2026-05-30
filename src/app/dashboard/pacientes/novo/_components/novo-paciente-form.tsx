'use client';

import { useState, useTransition, useRef } from 'react';
import { Loader2, User, Upload, X, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { createPaciente } from '../actions';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppLabel } from '@/components/ui/app-label';
import { AppFormField } from '@/components/ui/app-form-field';
import { BackHeader } from '@/components/ui/back-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  isSecretaria: boolean;
  dentistas: { id: string; nome: string }[];
  clinicaId: string;
}

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function NovoPacienteForm({ isSecretaria, dentistas, clinicaId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    avatar_url: '',
  });

  const [dentistaId, setDentistaId] = useState<string>('');

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setError('Selecione apenas imagens (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 5 MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);
    try {
      const supabase = createClient();
      const storagePath = `pacientes/${clinicaId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, { upsert: false });
      if (storageErr) throw storageErr;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      setForm((prev) => ({ ...prev, avatar_url: urlData.publicUrl }));
    } catch (err) {
      console.error('Erro ao fazer upload da foto:', err);
      setError('Erro ao fazer upload da foto. Tente novamente.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.nome.trim()) {
      setError('O nome do paciente é obrigatório.');
      return;
    }

    if (isSecretaria && !dentistaId) {
      setError('Selecione o dentista responsável pelo paciente.');
      return;
    }

    if (form.cpf) {
      const digits = form.cpf.replace(/\D/g, '');
      if (digits.length !== 11) {
        setError('CPF inválido. Digite os 11 dígitos.');
        return;
      }
    }

    if (form.telefone) {
      const digits = form.telefone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Telefone inválido. Digite DDD + número (mínimo 10 dígitos).');
        return;
      }
    }

    startTransition(async () => {
      const result = await createPaciente({
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        data_nascimento: form.data_nascimento || null,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
        observacoes: form.observacoes.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        dentistaId: isSecretaria ? dentistaId : undefined,
      });

      if (result.success) {
        router.push('/dashboard/pacientes');
      } else {
        setError(result.error ?? 'Erro ao cadastrar paciente.');
      }
    });
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

          {/* Error banner (form-level) */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 bg-coral/5 border border-coral/20
                           rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 text-coral shrink-0" />
                <p className="text-sm font-medium text-coral">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Atribuição — secretária only */}
          {isSecretaria && dentistas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface rounded-2xl border border-border shadow-sm p-6"
            >
              <h2 className="font-heading text-xl text-text-primary mb-5">Atribuição</h2>
              <AppFormField label="Dentista Responsável" htmlFor="dentista-select" required>
                <Select value={dentistaId} onValueChange={(v) => v && setDentistaId(v)}>
                  <SelectTrigger
                    id="dentista-select"
                    className="rounded-xl border-border bg-surface text-text-primary
                               focus:ring-2 focus:ring-teal/20 focus:border-teal/60 h-auto py-3"
                  >
                    <SelectValue placeholder="Selecione o dentista responsável..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {dentistas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AppFormField>
            </motion.div>
          )}

          {/* Dados Pessoais */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-surface-alt border border-border
                              flex items-center justify-center overflow-hidden shrink-0">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-text-muted" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <AppLabel optional>Foto de Perfil</AppLabel>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => void handleAvatarSelect(e)}
                />
                {form.avatar_url ? (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatar_url: '' }))}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border
                               bg-surface-alt text-sm font-medium text-text-secondary
                               hover:text-coral hover:border-coral/30 transition-colors"
                  >
                    <X className="w-4 h-4" /> Remover foto
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed
                               border-border bg-surface-alt text-sm font-medium text-text-secondary
                               hover:border-teal hover:text-teal transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingAvatar ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Selecionar foto</>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="h-px bg-border" />

            <h2 className="font-heading text-xl text-text-primary">Dados Pessoais</h2>

            <AppFormField label="Nome Completo" htmlFor="nome" required>
              <AppInput
                id="nome"
                value={form.nome}
                onChange={set('nome')}
                placeholder="Ex: Maria Almeida"
              />
            </AppFormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AppFormField label="CPF" htmlFor="cpf" optional>
                <AppInput
                  id="cpf"
                  value={form.cpf}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cpf: formatCpf(e.target.value) }))
                  }
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="font-mono"
                />
              </AppFormField>
              <AppFormField label="Data de Nascimento" htmlFor="data_nascimento" optional>
                <AppInput
                  id="data_nascimento"
                  type="date"
                  value={form.data_nascimento}
                  onChange={set('data_nascimento')}
                />
              </AppFormField>
            </div>
          </motion.div>

          {/* Contato */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            <h2 className="font-heading text-xl text-text-primary">Contato</h2>

            <AppFormField label="Telefone / WhatsApp" htmlFor="telefone" optional>
              <AppInput
                id="telefone"
                value={form.telefone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, telefone: formatPhone(e.target.value) }))
                }
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
            </AppFormField>

            <AppFormField label="Email" htmlFor="email" optional>
              <AppInput
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="paciente@email.com"
              />
            </AppFormField>
          </motion.div>

          {/* Endereço */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-5"
          >
            <h2 className="font-heading text-xl text-text-primary">Endereço</h2>

            <AppFormField label="Logradouro" htmlFor="endereco" optional>
              <AppInput
                id="endereco"
                value={form.endereco}
                onChange={set('endereco')}
                placeholder="Rua, número, complemento..."
              />
            </AppFormField>

            <div className="grid grid-cols-2 gap-4">
              <AppFormField label="Cidade" htmlFor="cidade" optional>
                <AppInput
                  id="cidade"
                  value={form.cidade}
                  onChange={set('cidade')}
                  placeholder="São Paulo"
                />
              </AppFormField>
              <AppFormField label="Estado" htmlFor="estado" optional>
                <AppInput
                  id="estado"
                  value={form.estado}
                  onChange={set('estado')}
                  placeholder="SP"
                  maxLength={2}
                  className="uppercase"
                />
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
            <h2 className="font-heading text-xl text-text-primary mb-5">Observações</h2>
            <AppTextarea
              id="observacoes"
              value={form.observacoes}
              onChange={set('observacoes')}
              placeholder="Alergias, histórico médico relevante, preferências de atendimento..."
              rows={4}
            />
          </motion.div>
        </div>

        {/* Sticky actions bar — spec 10.7 */}
        <div
          className="sticky bottom-0 z-10 bg-surface border-t border-border py-4
                     flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={() => router.push('/dashboard/pacientes')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
                       text-sm font-semibold text-text-secondary border border-border
                       hover:bg-surface-alt hover:text-text-primary transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || isUploadingAvatar}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl
                       text-[15px] font-bold text-white
                       hover:-translate-y-0.5 active:scale-[0.98] transition-all
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            style={{
              background: 'linear-gradient(135deg, #2f9c85 0%, #1d7a65 100%)',
              boxShadow:
                '0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Cadastrar Paciente'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
