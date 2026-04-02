'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  ChevronLeft,
  Stethoscope,
  ClipboardList,
  Trash2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { DentistaRole } from '@/types/database';
import type { UsuarioRow, ConvitePendente } from '../page';
import { deletarUsuario } from '../actions';

const ROLE_LABELS: Record<DentistaRole, string> = {
  admin: 'Admin',
  dentista: 'Dentista',
  secretaria: 'Secretária',
};

const ROLE_ICONS: Record<DentistaRole, React.FC<{ className?: string }>> = {
  admin: ({ className }) => <Shield className={className} />,
  dentista: ({ className }) => <Stethoscope className={className} />,
  secretaria: ({ className }) => <ClipboardList className={className} />,
};

const ROLE_COLORS: Record<DentistaRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  dentista: 'bg-teal-pale text-teal dark:bg-teal/20 dark:text-teal-lt',
  secretaria: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

interface Props {
  usuarios: UsuarioRow[];
  convitesPendentes: ConvitePendente[];
  meuId: string;
  meuRole: DentistaRole;
  limiteDentistas: number;
  convitesRestantes: number;
}

export function UsuariosClient({ usuarios, convitesPendentes, meuId, meuRole, limiteDentistas, convitesRestantes }: Props): React.JSX.Element {
  const [showConviteDialog, setShowConviteDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'dentista' | 'secretaria'>('dentista');
  const [isSending, setIsSending] = useState(false);
  const [pendentes, setPendentes] = useState<ConvitePendente[]>(convitesPendentes);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usuariosAtivos, setUsuariosAtivos] = useState<UsuarioRow[]>(usuarios);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioRow | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  async function handleEnviarConvite(): Promise<void> {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Digite um email válido');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao enviar convite');
        return;
      }

      toast.success(`Convite enviado para ${email}`);
      setEmail('');
      setShowConviteDialog(false);

      // Adiciona convite na lista local (sem reload)
      const novoConvite: ConvitePendente = {
        id: crypto.randomUUID(),
        email: email.trim(),
        role: role as DentistaRole,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };
      setPendentes((prev) => [novoConvite, ...prev]);
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setIsSending(false);
    }
  }

  async function handleCancelarConvite(conviteId: string): Promise<void> {
    setDeletingId(conviteId);
    try {
      const res = await fetch(`/api/convite/${conviteId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Erro ao cancelar convite');
        return;
      }
      setPendentes((prev) => prev.filter((c) => c.id !== conviteId));
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
      setUsuariosAtivos((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      toast.success(`${confirmDelete.nome} foi removido da clínica`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir usuário');
    } finally {
      setIsDeletingUser(false);
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <Link
        href="/dashboard/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors font-semibold"
      >
        <ChevronLeft className="w-4 h-4" />
        Configurações
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="font-serif text-3xl text-text-primary dark:text-white">Equipe</h1>
          <p className="text-text-secondary dark:text-zinc-400 text-sm mt-1">
            Gerencie dentistas e secretárias da clínica
          </p>
          <p className="text-xs text-text-secondary dark:text-zinc-500 mt-1 font-mono">
            {convitesRestantes > 0
              ? `${convitesRestantes} vaga${convitesRestantes !== 1 ? 's' : ''} disponível${convitesRestantes !== 1 ? 'is' : ''} de ${limiteDentistas}`
              : `Limite de ${limiteDentistas} dentistas atingido`}
          </p>
        </div>
        <Button
          onClick={() => setShowConviteDialog(true)}
          className="bg-teal hover:bg-teal-dark text-white gap-2 shrink-0"
          style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
        >
          <UserPlus className="w-4 h-4" />
          Convidar
        </Button>
      </motion.div>

      {/* Lista de usuários ativos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-surface dark:bg-zinc-900 rounded-2xl border border-border dark:border-zinc-800"
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border dark:border-zinc-800">
          <Users className="w-4 h-4 text-teal" />
          <h2 className="font-semibold text-text-primary dark:text-white text-sm">
            Membros da clínica ({usuariosAtivos.length})
          </h2>
        </div>

        <div className="divide-y divide-border dark:divide-zinc-800">
          {usuariosAtivos.map((u) => {
            const RoleIcon = ROLE_ICONS[u.role];
            const isSelf = u.id === meuId;
            return (
              <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-teal-pale dark:bg-teal/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-teal font-bold text-sm">
                    {u.nome.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary dark:text-white text-sm truncate">
                      {u.nome}
                    </span>
                    {isSelf && (
                      <span className="text-xs text-text-secondary dark:text-zinc-500">(você)</span>
                    )}
                  </div>
                  {u.email && (
                    <p className="text-xs text-text-secondary dark:text-zinc-400 truncate mt-0.5">
                      {u.email}
                    </p>
                  )}
                </div>

                {/* Role badge */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                  <RoleIcon className="w-3 h-3" />
                  {ROLE_LABELS[u.role]}
                </span>

                {/* Status */}
                <div className="flex items-center gap-1">
                  {u.ativo ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>

                {/* Excluir — apenas admin, não pode excluir a si mesmo */}
                {meuRole === 'admin' && !isSelf && (
                  <button
                    onClick={() => setConfirmDelete(u)}
                    className="p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Excluir usuário"
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
          className="bg-surface dark:bg-zinc-900 rounded-2xl border border-border dark:border-zinc-800"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border dark:border-zinc-800">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-text-primary dark:text-white text-sm">
              Convites pendentes ({pendentes.length})
            </h2>
          </div>

          <div className="divide-y divide-border dark:divide-zinc-800">
            {pendentes.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-amber-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary dark:text-white text-sm truncate">
                    {c.email}
                  </p>
                  <p className="text-xs text-text-secondary dark:text-zinc-400 mt-0.5">
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

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl">Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <span className="font-medium text-text-primary dark:text-white">{confirmDelete?.nome}</span>
              {' '}será removido permanentemente da clínica e não conseguirá mais fazer login.
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
              {isDeletingUser ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de convite */}
      <Dialog open={showConviteDialog} onOpenChange={setShowConviteDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Convidar usuário</DialogTitle>
            <DialogDescription>
              Envie um email com link de cadastro. O convite expira em 7 dias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                Email
              </Label>
              <Input
                type="email"
                placeholder="usuario@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleEnviarConvite(); }}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                Papel
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'dentista' | 'secretaria')}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dentista">Dentista</SelectItem>
                  <SelectItem value="secretaria">Secretária</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConviteDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-teal hover:bg-teal-dark text-white gap-2"
                onClick={() => void handleEnviarConvite()}
                disabled={isSending}
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
