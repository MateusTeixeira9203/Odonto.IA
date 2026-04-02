'use client';

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, Trash2, Loader2, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { DentIALogo } from '@/components/ui/dent-ia-logo';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { salvarAvatarUrl, removerAvatar } from '../actions';
import type { DentistaRole } from '@/types/database';

const ROLE_LABELS: Record<DentistaRole, string> = {
  admin: 'Administrador',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

interface Props {
  nome: string;
  email: string | null;
  role: DentistaRole;
  clinica: string;
  avatarUrl: string | null;
}

export function PerfilClient({ nome, email, role, clinica, avatarUrl: initialAvatarUrl }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const iniciais = nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5 MB');
      return;
    }

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

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Adiciona cache-buster para forçar reload da imagem
      const urlComCache = `${publicUrl}?t=${Date.now()}`;

      const result = await salvarAvatarUrl(urlComCache);
      if (result.error) throw new Error(result.error);

      setAvatarUrl(urlComCache);
      toast.success('Foto de perfil atualizada!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      // Limpa o input para permitir reenviar o mesmo arquivo
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

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="font-heading text-3xl text-text-primary mb-1">Meu Perfil</h1>
          <p className="text-text-secondary text-sm">Gerencie suas informações pessoais e foto de perfil.</p>
        </div>

        {/* Avatar */}
        <div className="bg-surface rounded-3xl border border-border p-8">
          <h2 className="font-semibold text-text-primary mb-6 text-sm uppercase tracking-widest font-mono">
            Foto de Perfil
          </h2>

          <div className="flex items-center gap-6">
            {/* Preview */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-teal flex items-center justify-center ring-4 ring-teal/20 shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-2xl">{iniciais}</span>
                )}
              </div>

              {/* Overlay de câmera ao hover */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Trocar foto"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
            </div>

            {/* Ações */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleFileChange(e)}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-teal text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-dark transition-all disabled:opacity-60"
                style={{ boxShadow: '0 8px 24px -8px rgba(47,156,133,0.4)' }}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Camera className="w-4 h-4" /> {avatarUrl ? 'Trocar foto' : 'Adicionar foto'}</>
                )}
              </button>

              {avatarUrl && (
                <button
                  onClick={() => void handleRemover()}
                  disabled={removing}
                  className="flex items-center gap-2 text-text-secondary hover:text-red-500 px-4 py-2.5 rounded-xl font-semibold text-sm border border-border hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-60"
                >
                  {removing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Removendo...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Remover foto</>
                  )}
                </button>
              )}

              <p className="text-xs text-text-secondary font-mono">
                JPG, PNG ou WebP · máx. 5 MB
              </p>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="bg-surface rounded-3xl border border-border p-8">
          <h2 className="font-semibold text-text-primary mb-6 text-sm uppercase tracking-widest font-mono">
            Informações da Conta
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-alt">
              <div className="w-9 h-9 rounded-xl bg-teal-pale flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-teal" />
              </div>
              <div>
                <p className="text-xs font-mono text-text-secondary uppercase tracking-widest mb-0.5">Nome</p>
                <p className="font-semibold text-text-primary text-sm">{nome}</p>
              </div>
            </div>

            {email && (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-alt">
                <div className="w-9 h-9 rounded-xl bg-teal-pale flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-teal" />
                </div>
                <div>
                  <p className="text-xs font-mono text-text-secondary uppercase tracking-widest mb-0.5">Email</p>
                  <p className="font-semibold text-text-primary text-sm">{email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-alt">
              <div className="w-9 h-9 rounded-xl bg-teal-pale flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-teal" />
              </div>
              <div>
                <p className="text-xs font-mono text-text-secondary uppercase tracking-widest mb-0.5">Função</p>
                <p className="font-semibold text-text-primary text-sm">{ROLE_LABELS[role]}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-alt">
              <div className="w-9 h-9 rounded-xl bg-teal-pale flex items-center justify-center shrink-0">
                <DentIALogo className="w-4 h-4 text-teal" />
              </div>
              <div>
                <p className="text-xs font-mono text-text-secondary uppercase tracking-widest mb-0.5">Clínica</p>
                <p className="font-semibold text-text-primary text-sm">{clinica}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
