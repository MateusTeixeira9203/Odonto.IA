'use client';

import { useState, useTransition, useRef } from 'react';
import { ArrowLeft, Loader2, User, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { createPaciente } from '../actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
      const storagePath = `avatares/${clinicaId}/${Date.now()}_${file.name}`;
      const { error: storageErr } = await supabase.storage
        .from('fichas')
        .upload(storagePath, file, { upsert: false });
      if (storageErr) throw storageErr;
      const { data: urlData } = supabase.storage.from('fichas').getPublicUrl(storagePath);
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
    <div className="p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-10">
        <button
          onClick={() => router.push('/dashboard/pacientes')}
          className="p-2 hover:bg-card rounded-xl transition-colors border border-transparent hover:border-border/40"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-1">Novo Paciente</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Preencha os dados cadastrais do paciente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dentista responsável — somente secretária */}
        {isSecretaria && dentistas.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
            <h2 className="font-heading text-xl text-foreground mb-2">Atribuição</h2>
            <div className="space-y-2">
              <Label className="text-foreground">
                Dentista Responsável <span className="text-red-500">*</span>
              </Label>
              <Select value={dentistaId} onValueChange={(v) => v && setDentistaId(v)}>
                <SelectTrigger className="rounded-xl bg-muted border-border text-foreground">
                  <SelectValue placeholder="Selecione o dentista responsável..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {dentistas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Dados Pessoais */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-foreground">
                Foto de Perfil <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted text-sm font-medium text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  <X className="w-4 h-4" /> Remover foto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border bg-muted text-sm font-medium text-muted-foreground hover:border-teal hover:text-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

          <h2 className="font-heading text-xl text-foreground mb-2">Dados Pessoais</h2>

          <div className="space-y-2">
            <Label htmlFor="nome" className="text-foreground">
              Nome Completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={set('nome')}
              placeholder="Ex: Maria Almeida"
              className="rounded-xl bg-muted border-border text-foreground"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-foreground">
                CPF
              </Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => setForm((p) => ({ ...p, cpf: formatCpf(e.target.value) }))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                className="rounded-xl bg-muted border-border text-foreground font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_nascimento" className="text-foreground">
                Data de Nascimento
              </Label>
              <Input
                id="data_nascimento"
                type="date"
                value={form.data_nascimento}
                onChange={set('data_nascimento')}
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-xl text-foreground mb-2">Contato</h2>

          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-foreground">
              Telefone / WhatsApp
            </Label>
            <Input
              id="telefone"
              value={form.telefone}
              onChange={(e) => setForm((p) => ({ ...p, telefone: formatPhone(e.target.value) }))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              className="rounded-xl bg-muted border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="paciente@email.com"
              className="rounded-xl bg-muted border-border text-foreground"
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-heading text-xl text-foreground mb-2">Endereço</h2>

          <div className="space-y-2">
            <Label htmlFor="endereco" className="text-foreground">
              Logradouro
            </Label>
            <Input
              id="endereco"
              value={form.endereco}
              onChange={set('endereco')}
              placeholder="Rua, número, complemento..."
              className="rounded-xl bg-muted border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cidade" className="text-foreground">
                Cidade
              </Label>
              <Input
                id="cidade"
                value={form.cidade}
                onChange={set('cidade')}
                placeholder="São Paulo"
                className="rounded-xl bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado" className="text-foreground">
                Estado
              </Label>
              <Input
                id="estado"
                value={form.estado}
                onChange={set('estado')}
                placeholder="SP"
                maxLength={2}
                className="rounded-xl bg-muted border-border text-foreground uppercase"
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-heading text-xl text-foreground mb-4">Observações</h2>
          <textarea
            id="observacoes"
            value={form.observacoes}
            onChange={set('observacoes')}
            placeholder="Alergias, histórico médico relevante, preferências de atendimento..."
            rows={4}
            className="w-full bg-muted border-none rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-teal/20 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pb-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard/pacientes')}
            className="px-6 py-3 rounded-xl border border-border text-foreground hover:bg-muted text-sm font-bold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-teal text-white rounded-xl font-bold text-sm hover:bg-teal-lt transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Salvando...' : 'Cadastrar Paciente'}
          </button>
        </div>
      </form>
    </div>
  );
}
