'use client';

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, Trash2, Loader2, User } from 'lucide-react';
import { DentIALogo } from '@/components/ui/dent-ia-logo';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { salvarAvatarUrl, removerAvatar, salvarPerfil, salvarNomeClinica } from '../actions';
import type { DentistaRole } from '@/types/database';
import Image from 'next/image';

const ROLE_LABELS: Record<DentistaRole, string> = {
  admin: 'Administrador',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

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

interface Props {
  nome: string;
  email: string | null;
  role: DentistaRole;
  clinica: string;
  avatarUrl: string | null;
  cro: string | null;
  especialidade: string | null;
  telefone: string | null;
  cpf: string | null;
}

export function PerfilClient({ nome, email, role, clinica, avatarUrl: initialAvatarUrl, cro, especialidade, telefone, cpf }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formNome, setFormNome]                   = useState(nome);
  const [formTelefone, setFormTelefone]           = useState(telefone ?? '');
  const [formCro, setFormCro]                     = useState(cro ?? '');
  const [formEspecialidade, setFormEspecialidade] = useState(especialidade ?? '');
  const [formCpf, setFormCpf]                     = useState(cpf ?? '');
  const [formClinica, setFormClinica]             = useState(clinica);

  const iniciais = nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isAdmin        = role === 'admin';
  const showProfissional = role === 'admin' || role === 'dentista';

  const inputClass =
    'w-full font-sans text-sm px-3 py-2.5 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem (JPG, PNG, WebP)'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 5 MB'); return; }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const urlComCache = `${publicUrl}?t=${Date.now()}`;

      const result = await salvarAvatarUrl(urlComCache);
      if (result.error) throw new Error(result.error);

      setAvatarUrl(urlComCache);
      toast.success('Foto de perfil atualizada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemover() {
    setRemoving(true);
    try {
      const result = await removerAvatar();
      if (result.error) throw new Error(result.error);
      setAvatarUrl(null);
      toast.success('Foto removida');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover foto');
    } finally {
      setRemoving(false);
    }
  }

  async function handleSalvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const [perfilResult, clinicaResult] = await Promise.all([
        salvarPerfil({
          nome:          formNome.trim(),
          telefone:      formTelefone.trim(),
          cro:           formCro.trim(),
          especialidade: formEspecialidade.trim(),
          cpf:           formCpf.trim(),
        }),
        // Atualiza nome da clínica só se admin e se mudou
        isAdmin && formClinica.trim() !== clinica
          ? salvarNomeClinica(formClinica.trim())
          : Promise.resolve({}),
      ]);

      if (perfilResult.error) throw new Error(perfilResult.error);
      if ('error' in clinicaResult && clinicaResult.error) throw new Error(clinicaResult.error as string);

      toast.success('Perfil salvo com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="font-heading text-3xl text-text-primary mb-1">Meu Perfil</h1>
          <p className="text-text-secondary text-sm">Gerencie suas informações pessoais e foto de perfil.</p>
        </div>

        {/* Layout duas colunas: sidebar à esquerda, formulário à direita */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          {/* Coluna esquerda: avatar + info da conta */}
          <div className="space-y-4">

            {/* Card do avatar */}
            <div className="bg-surface rounded-3xl border border-border p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-teal flex items-center justify-center ring-4 ring-teal/20 shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={nome} width={96} height={96} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-2xl">{iniciais}</span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Trocar foto"
                  >
                    {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                  </button>
                </div>

                <div>
                  <p className="font-semibold text-text-primary text-sm">{formNome || nome}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{ROLE_LABELS[role]}</p>
                </div>

                <div className="w-full space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void handleFileChange(e)} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 bg-teal text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-teal-dark transition-all disabled:opacity-60"
                    style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Camera className="w-4 h-4" /> {avatarUrl ? 'Trocar foto' : 'Adicionar foto'}</>}
                  </button>
                  {avatarUrl && (
                    <button
                      onClick={() => void handleRemover()}
                      disabled={removing}
                      className="w-full flex items-center justify-center gap-2 text-text-secondary hover:text-red-500 px-4 py-2 rounded-xl font-semibold text-sm border border-border hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-60"
                    >
                      {removing ? <><Loader2 className="w-4 h-4 animate-spin" /> Removendo...</> : <><Trash2 className="w-4 h-4" /> Remover foto</>}
                    </button>
                  )}
                  <p className="text-xs text-text-secondary font-mono">JPG, PNG ou WebP · máx. 5 MB</p>
                </div>
              </div>
            </div>

            {/* Card da conta (somente leitura) */}
            <div className="bg-surface rounded-3xl border border-border p-6 space-y-4">
              <h2 className="font-semibold text-text-primary text-xs uppercase tracking-widest font-mono">Conta</h2>

              <div>
                <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest mb-1">Email</p>
                <p className="text-sm font-medium text-text-primary break-all">{email ?? '—'}</p>
              </div>

              <div>
                <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest mb-1">Função</p>
                <p className="text-sm font-medium text-text-primary">{ROLE_LABELS[role]}</p>
              </div>

              {!isAdmin && (
                <div>
                  <p className="text-[10px] font-mono text-text-secondary uppercase tracking-widest mb-1">Clínica</p>
                  <div className="flex items-center gap-2">
                    <DentIALogo className="w-3.5 h-3.5 text-teal shrink-0" />
                    <p className="text-sm font-medium text-text-primary">{clinica}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: formulário editável */}
          <div className="bg-surface rounded-3xl border border-border p-8">
            <h2 className="font-semibold text-text-primary mb-6 text-sm uppercase tracking-widest font-mono">
              Dados Pessoais
            </h2>

            <form onSubmit={(e) => void handleSalvarPerfil(e)} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                  Telefone
                </label>
                <input
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  disabled={saving}
                  className={inputClass}
                />
              </div>

              {/* Dados profissionais — dentista e admin */}
              {showProfissional && (
                <>
                  <div className="pt-2 pb-1 border-t border-border">
                    <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">Dados Profissionais</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">CRO</label>
                      <input
                        value={formCro}
                        onChange={(e) => setFormCro(e.target.value)}
                        placeholder="Ex: CRO-SP 12345"
                        disabled={saving}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">CPF</label>
                      <input
                        value={formCpf}
                        onChange={(e) => setFormCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        disabled={saving}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">Especialidade</label>
                    <select
                      value={formEspecialidade}
                      onChange={(e) => setFormEspecialidade(e.target.value)}
                      disabled={saving}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      {ESPECIALIDADES.map((esp) => (
                        <option key={esp} value={esp}>{esp}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Nome da clínica — editável só para admin */}
              {isAdmin && (
                <>
                  <div className="pt-2 pb-1 border-t border-border">
                    <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">Clínica</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-widest">
                      Nome da clínica
                    </label>
                    <div className="relative">
                      <DentIALogo className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal pointer-events-none" />
                      <input
                        value={formClinica}
                        onChange={(e) => setFormClinica(e.target.value)}
                        placeholder="Nome da clínica"
                        disabled={saving}
                        className={`${inputClass} pl-8`}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-teal hover:bg-teal-lt text-white py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><User className="w-4 h-4" /> Salvar perfil</>}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
