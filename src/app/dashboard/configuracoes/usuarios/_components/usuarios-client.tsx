'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, UserPlus, Mail, Clock, CheckCircle2, XCircle,
  Shield, ChevronLeft, Stethoscope, ClipboardList, Trash2,
  Send, Eye, EyeOff, Copy, Check, KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { DentistaRole } from '@/types/database';
import type { PlanoId } from '@/lib/planos';
import { getLabelContexto } from '@/lib/planos';
import type { UsuarioRow, ConvitePendente } from '../page';
import { deletarUsuario, criarSecretariaAction } from '../actions';

// ── Constantes de role ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<DentistaRole, string> = {
  admin:     'Admin',
  dentista:  'Dentista Agregado',
  secretaria:'Secretária',
};

const ROLE_ICONS: Record<DentistaRole, React.FC<{ className?: string }>> = {
  admin:     ({ className }) => <Shield className={className} />,
  dentista:  ({ className }) => <Stethoscope className={className} />,
  secretaria:({ className }) => <ClipboardList className={className} />,
};

const ROLE_COLORS: Record<DentistaRole, string> = {
  admin:     'bg-teal/10 text-teal',
  dentista:  'bg-teal-pale text-teal dark:bg-teal/20 dark:text-teal-lt',
  secretaria:'bg-surface-alt text-text-secondary',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  usuarios: UsuarioRow[];
  convitesPendentes: ConvitePendente[];
  meuId: string;
  meuRole: DentistaRole;
  limiteDentistas: number;
  convitesRestantes: number;
  plano?: PlanoId;
  asTab?: boolean;
}

// ── Tipos de tab ──────────────────────────────────────────────────────────────

type DialogTab = 'dentista' | 'secretaria';
type DialogStep = 'form' | 'sucesso' | 'convite-link';

// ── Componente principal ──────────────────────────────────────────────────────

export function UsuariosClient({
  usuarios, convitesPendentes, meuId, meuRole,
  limiteDentistas, convitesRestantes, plano, asTab = false,
}: Props): React.JSX.Element {
  const labelContexto = getLabelContexto(plano ?? 'SOLO');
  const da = labelContexto === 'Clínica' ? 'da' : 'do';

  // ── Estado do dialog de adicionar ────────────────────────────────────────
  const [showDialog, setShowDialog]       = useState(false);
  const [tab, setTab]                     = useState<DialogTab>('dentista');
  const [step, setStep]                   = useState<DialogStep>('form');

  // Dentista — convite por link
  const [emailConvite, setEmailConvite]   = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [conviteLink, setConviteLink]     = useState('');
  const [conviteEmailEnviado, setConviteEmailEnviado] = useState(false);
  const [copiedLink, setCopiedLink]       = useState(false);

  // Secretária — criação direta
  const [secNome, setSecNome]             = useState('');
  const [secEmail, setSecEmail]           = useState('');
  const [secSenha, setSecSenha]           = useState('');
  const [showSenha, setShowSenha]         = useState(false);
  const [isCriando, setIsCriando]         = useState(false);
  const [copiedSenha, setCopiedSenha]     = useState(false);

  // ── Estado da lista ───────────────────────────────────────────────────────
  const [pendentes, setPendentes]         = useState<ConvitePendente[]>(convitesPendentes);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [usuariosAtivos, setUsuariosAtivos] = useState<UsuarioRow[]>(usuarios);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioRow | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);


  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetDialog() {
    setTab('dentista');
    setStep('form');
    setEmailConvite('');
    setConviteLink('');
    setConviteEmailEnviado(false);
    setCopiedLink(false);
    setSecNome('');
    setSecEmail('');
    setSecSenha('');
    setShowSenha(false);
    setCopiedSenha(false);
  }

  async function copiarLinkConvite() {
    await navigator.clipboard.writeText(conviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function handleCloseDialog() {
    setShowDialog(false);
    resetDialog();
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function copiarSenha() {
    await navigator.clipboard.writeText(secSenha);
    setCopiedSenha(true);
    setTimeout(() => setCopiedSenha(false), 2000);
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  async function handleEnviarConvite(): Promise<void> {
    if (!emailConvite.trim() || !emailConvite.includes('@')) {
      toast.error('Digite um email válido');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/convite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailConvite.trim(), role: 'dentista' }),
      });

      const data = (await res.json()) as { error?: string; link?: string; emailEnviado?: boolean };

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao enviar convite');
        return;
      }

      // Atualiza lista local sem reload
      const novoConvite: ConvitePendente = {
        id:         crypto.randomUUID(),
        email:      emailConvite.trim(),
        role:       'dentista' as DentistaRole,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };
      setPendentes(prev => [novoConvite, ...prev]);

      // Tela de sucesso com link copiável — garante o compartilhamento mesmo
      // se o e-mail não tiver sido entregue.
      setConviteLink(data.link ?? '');
      setConviteEmailEnviado(data.emailEnviado ?? false);
      setStep('convite-link');
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setIsSending(false);
    }
  }

  async function handleCriarSecretaria(): Promise<void> {
    if (!secNome.trim()) { toast.error('Digite o nome da secretária'); return; }
    if (!secEmail.trim() || !secEmail.includes('@')) { toast.error('Digite um email válido'); return; }
    if (secSenha.length < 8) { toast.error('A senha deve ter no mínimo 8 caracteres'); return; }

    setIsCriando(true);
    try {
      const result = await criarSecretariaAction(
        secNome.trim(),
        secEmail.trim(),
        secSenha,
      );

      if (!result.ok) {
        toast.error(result.error ?? 'Erro ao criar secretária');
        return;
      }

      // Avança para tela de sucesso com credenciais
      setStep('sucesso');

      // Adiciona na lista local
      const nova: UsuarioRow = {
        id:         crypto.randomUUID(),
        nome:       secNome.trim(),
        email:      secEmail.trim(),
        role:       'secretaria' as DentistaRole,
        ativo:      true,
        created_at: new Date().toISOString(),
      };
      setUsuariosAtivos(prev => [...prev, nova]);
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setIsCriando(false);
    }
  }

  async function handleCancelarConvite(conviteId: string): Promise<void> {
    setDeletingId(conviteId);
    try {
      const res = await fetch(`/api/convite/${conviteId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Erro ao cancelar convite'); return; }
      setPendentes(prev => prev.filter(c => c.id !== conviteId));
      toast.success('Convite cancelado');
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeletarUsuario(): Promise<void> {
    if (!confirmDelete) return;
    setIsDeletingUser(true);
    try {
      await deletarUsuario(confirmDelete.id);
      setUsuariosAtivos(prev => prev.filter(u => u.id !== confirmDelete.id));
      toast.success(`${confirmDelete.nome} foi removido ${da} ${labelContexto.toLowerCase()}`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir usuário');
    } finally {
      setIsDeletingUser(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={asTab ? 'space-y-6' : 'p-8 max-w-3xl mx-auto space-y-8'}>
      {!asTab && (
        <Link
          href="/dashboard/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          Configurações
        </Link>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          {asTab
            ? <h2 className="font-heading font-bold text-xl text-text-primary">Equipe</h2>
            : <h1 className="font-heading font-bold text-3xl text-text-primary">Equipe</h1>
          }
          <p className="text-text-secondary text-sm mt-1">
            Gerencie dentistas e secretárias {da} {labelContexto.toLowerCase()}
          </p>
          <p className="text-xs text-text-secondary mt-1 font-mono">
            {convitesRestantes > 0
              ? `${convitesRestantes} vaga${convitesRestantes !== 1 ? 's' : ''} disponível${convitesRestantes !== 1 ? 'is' : ''} de ${limiteDentistas} dentistas`
              : `Limite de ${limiteDentistas} dentistas atingido`}
          </p>
        </div>

        {meuRole === 'admin' && (
          <Button
            onClick={() => { resetDialog(); setShowDialog(true); }}
            className="bg-gradient-to-r from-teal to-teal-lt text-white gap-2 shrink-0 rounded-xl shadow-[0_6px_20px_rgba(47,156,133,0.35)] hover:-translate-y-0.5 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar
          </Button>
        )}
      </motion.div>

      {/* Lista de membros */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-surface rounded-3xl border border-border"
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <Users className="w-4 h-4 text-teal" />
          <h2 className="font-semibold text-text-primary text-sm">
            Membros {da} {labelContexto.toLowerCase()} ({usuariosAtivos.length})
          </h2>
        </div>

        <div className="divide-y divide-border">
          {usuariosAtivos.map((u) => {
            const RoleIcon = ROLE_ICONS[u.role];
            const isSelf   = u.id === meuId;

            return (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-teal-pale dark:bg-teal/20 flex items-center justify-center shrink-0">
                  <span className="text-teal font-bold text-sm">
                    {u.nome.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary text-sm truncate">{u.nome}</span>
                    {isSelf && <span className="text-xs text-text-secondary">(você)</span>}
                  </div>
                  {u.email && (
                    <p className="text-xs text-text-secondary truncate mt-0.5">{u.email}</p>
                  )}
                </div>

                {/* Role badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                  <RoleIcon className="w-3 h-3" />
                  {ROLE_LABELS[u.role]}
                </span>

                {/* Status */}
                <div className="flex items-center gap-1">
                  {u.ativo
                    ? <CheckCircle2 className="w-4 h-4 text-teal" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  }
                </div>

                {/* Remover — só admin */}
                {meuRole === 'admin' && !isSelf && (
                  <button
                    onClick={() => setConfirmDelete(u)}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={`Remover ${da} ${labelContexto.toLowerCase()}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Convites pendentes */}
      {pendentes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface rounded-3xl border border-border"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Clock className="w-4 h-4 text-text-secondary" />
            <h2 className="font-semibold text-text-primary text-sm">
              Convites pendentes ({pendentes.length})
            </h2>
          </div>

          <div className="divide-y divide-border">
            {pendentes.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-9 h-9 rounded-full bg-teal-pale dark:bg-teal/15 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary text-sm truncate">{c.email}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Expira em {formatDate(c.expires_at)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize shrink-0">
                  {ROLE_LABELS[c.role]}
                </Badge>
                {meuRole === 'admin' && (
                  <button
                    onClick={() => void handleCancelarConvite(c.id)}
                    disabled={deletingId === c.id}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    title="Cancelar convite"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── AlertDialog de confirmação de exclusão ── */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold text-xl">Remover membro?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <span className="font-medium text-text-primary">{confirmDelete?.nome}</span>
              {' '}será removido {da} {labelContexto.toLowerCase()} e não conseguirá mais fazer login.
              Fichas, orçamentos e agendamentos vinculados serão preservados.
              <br /><br />
              <span className="font-medium text-red-600">Esta ação é irreversível.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeletarUsuario()}
              disabled={isDeletingUser}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {isDeletingUser ? 'Removendo...' : 'Sim, remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog principal de adicionar membro ── */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <AnimatePresence mode="wait">

            {/* ── TELA DE SUCESSO — Secretária criada ── */}
            {step === 'sucesso' ? (
              <motion.div
                key="sucesso"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="py-2"
              >
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}>
                    <CheckCircle2 className="w-7 h-7 text-teal" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-heading font-bold text-xl text-text-primary">
                      Secretária criada!
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Compartilhe as credenciais com {secNome.split(' ')[0]}
                    </p>
                  </div>
                </div>

                {/* Credenciais */}
                <div className="rounded-2xl border border-border bg-surface-alt p-4 space-y-3 mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1">Email</p>
                    <p className="text-sm font-medium text-text-primary font-mono">{secEmail}</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1">Senha</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary font-mono">
                        {showSenha ? secSenha : '••••••••'}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setShowSenha(v => !v)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                        >
                          {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => void copiarSenha()}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors"
                          title="Copiar senha"
                        >
                          {copiedSenha
                            ? <Check className="w-3.5 h-3.5 text-teal" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-text-secondary text-center mb-6">
                  No primeiro login, o sistema vai pedir para ela trocar a senha.
                </p>

                <Button
                  onClick={handleCloseDialog}
                  className="w-full bg-teal hover:bg-teal-dark text-white rounded-xl"
                >
                  Concluir
                </Button>
              </motion.div>
            ) : step === 'convite-link' ? (

              /* ── TELA DE SUCESSO — Convite criado (link copiável) ── */
              <motion.div
                key="convite-link"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="py-2"
              >
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--color-teal) 12%, transparent)' }}>
                    <CheckCircle2 className="w-7 h-7 text-teal" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-heading font-bold text-xl text-text-primary">
                      Convite criado!
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      {conviteEmailEnviado
                        ? <>Enviamos um e-mail para <span className="font-medium text-text-primary">{emailConvite}</span>. Você também pode compartilhar o link direto.</>
                        : 'Copie o link abaixo e envie para o dentista (ex: WhatsApp). O convite expira em 7 dias.'}
                    </p>
                  </div>
                </div>

                {!conviteEmailEnviado && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300 mb-4">
                    O e-mail automático não foi entregue agora. Use o link abaixo para compartilhar manualmente.
                  </div>
                )}

                {/* Link do convite */}
                <div className="rounded-2xl border border-border bg-surface-alt p-4 mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1.5">Link do convite</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-text-primary font-mono truncate">
                      {conviteLink}
                    </p>
                    <button
                      onClick={() => void copiarLinkConvite()}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors shrink-0"
                      title="Copiar link"
                    >
                      {copiedLink
                        ? <Check className="w-4 h-4 text-teal" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleCloseDialog}
                  className="w-full bg-teal hover:bg-teal-dark text-white rounded-xl"
                >
                  Concluir
                </Button>
              </motion.div>
            ) : (

              /* ── TELA DE FORMULÁRIO ── */
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="py-1"
              >
                <DialogHeader className="mb-4">
                  <DialogTitle className="font-heading font-semibold text-xl">Adicionar membro</DialogTitle>
                  <DialogDescription>
                    Escolha o tipo de acesso para o novo membro {da} {labelContexto.toLowerCase()}.
                  </DialogDescription>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl bg-surface-alt mb-5">
                  {(['dentista', 'secretaria'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        tab === t
                          ? 'bg-surface text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t === 'dentista'
                        ? <><Stethoscope className="w-3.5 h-3.5" /> Dentista</>
                        : <><ClipboardList className="w-3.5 h-3.5" /> Secretária</>
                      }
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {/* ── Form Dentista ── */}
                  {tab === 'dentista' && (
                    <motion.div
                      key="form-dentista"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <div className="rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-secondary">
                        O dentista recebe um <span className="font-medium text-text-primary">link por email</span> (que você também pode copiar e enviar) e cria a própria conta. O convite expira em 7 dias.
                      </div>

                      <div>
                        <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                          Email do dentista
                        </Label>
                        <Input
                          type="email"
                          placeholder="dentista@email.com"
                          value={emailConvite}
                          onChange={(e) => setEmailConvite(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleEnviarConvite(); }}
                          className="mt-1.5"
                          autoFocus
                        />
                      </div>

                      {convitesRestantes <= 0 && (
                        <p className="text-xs text-red-500">
                          Limite de dentistas atingido. Remova um dentista para convidar outro.
                        </p>
                      )}

                      <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1" onClick={handleCloseDialog}>
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1 bg-teal hover:bg-teal-dark text-white gap-2 rounded-xl"
                          onClick={() => void handleEnviarConvite()}
                          disabled={isSending || convitesRestantes <= 0}
                        >
                          <Send className="w-4 h-4" />
                          {isSending ? 'Enviando...' : 'Enviar convite'}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Form Secretária ── */}
                  {tab === 'secretaria' && (
                    <motion.div
                      key="form-secretaria"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3"
                    >
                      <div className="rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-text-secondary">
                        A conta é criada <span className="font-medium text-text-primary">imediatamente</span>. Você repassa as credenciais para ela. No primeiro login, o sistema pede troca de senha.
                      </div>

                      <div>
                        <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                          Nome completo
                        </Label>
                        <Input
                          placeholder="Maria Silva"
                          value={secNome}
                          onChange={(e) => setSecNome(e.target.value)}
                          className="mt-1.5"
                          autoFocus
                        />
                      </div>

                      <div>
                        <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                          Email
                        </Label>
                        <Input
                          type="email"
                          placeholder="secretaria@email.com"
                          value={secEmail}
                          onChange={(e) => setSecEmail(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                          Senha inicial
                        </Label>
                        <div className="relative mt-1.5">
                          <Input
                            type={showSenha ? 'text' : 'password'}
                            placeholder="Mínimo 8 caracteres"
                            value={secSenha}
                            onChange={(e) => setSecSenha(e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSenha(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                          >
                            {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {secSenha.length > 0 && secSenha.length < 8 && (
                          <p className="text-xs text-red-500 mt-1">Mínimo 8 caracteres</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1" onClick={handleCloseDialog}>
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1 bg-teal hover:bg-teal-dark text-white gap-2 rounded-xl"
                          onClick={() => void handleCriarSecretaria()}
                          disabled={isCriando}
                        >
                          <KeyRound className="w-4 h-4" />
                          {isCriando ? 'Criando...' : 'Criar conta'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}
