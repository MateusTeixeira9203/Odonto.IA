'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Lock, Mail, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { aceitarConviteAction, aceitarConviteGovernancaAction } from '../actions';
import { authCallbackUrl } from '@/lib/auth/return-path';
import { GoogleIcone } from '@/components/landing/icones';
import { EspecialidadeChips } from '@/components/ui/especialidade-chips';
import type { Especialidade } from '@/lib/especialidades';

interface Props {
  token: string;
  inviteEmail: string;
}

type Tab = 'login' | 'cadastro';

export function InviteAuthClient({ token, inviteEmail }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('login');
  const [email] = useState(inviteEmail);
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Credenciais inválidas. Tente novamente.');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast.error('Informe seu nome.'); return; }
    if (password.length < 8) { toast.error('Senha deve ter pelo menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
          emailRedirectTo: authCallbackUrl(window.location.origin, `/convite/${token}`),
        },
      });
      if (error) {
        if (error.message.includes('already')) {
          toast.error('Este email já tem uma conta. Faça login na outra aba.');
        } else {
          toast.error('Erro ao criar conta. Tente novamente.');
        }
        return;
      }
      if (!data.session) {
        window.location.href = `/verifique-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/convite/${token}`)}`;
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(): Promise<void> {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authCallbackUrl(window.location.origin, `/convite/${token}`),
      },
    });

    if (error) {
      toast.error('Não foi possível entrar com Google. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'login'
              ? 'bg-teal-ink text-surface'
              : 'bg-surface text-text-secondary hover:bg-surface-alt'
          }`}
        >
          Já tenho conta
        </button>
        <button
          type="button"
          onClick={() => setTab('cadastro')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            tab === 'cadastro'
              ? 'bg-teal-ink text-surface'
              : 'bg-surface text-text-secondary hover:bg-surface-alt'
          }`}
        >
          Criar conta
        </button>
      </div>

      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface disabled:opacity-60"
      >
        <span className="size-5 shrink-0 [&>svg]:size-full">
          <GoogleIcone />
        </span>
        Continuar com Google
      </button>

      {tab === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="email"
                value={email}
                readOnly
                className="bg-surface-alt border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary w-full opacity-70 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-ink text-surface rounded-xl font-bold py-3.5 hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? 'Entrando...' : (<>Entrar para continuar <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCadastro} className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                className="bg-surface-alt border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="email"
                value={email}
                readOnly
                className="bg-surface-alt border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary w-full opacity-70 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-ink text-surface rounded-xl font-bold py-3.5 hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? 'Criando conta...' : (<>Criar conta para continuar <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Botão de aceite (usuário já autenticado) ─────────────────────────────────

interface AcceptProps {
  token: string;
  governanceRole: 'gestor' | 'responsavel_tecnico' | null;
}

export function AcceptButton({ token, governanceRole }: AcceptProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cro, setCro] = useState('');
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    if (governanceRole === 'responsavel_tecnico' && (!cro.trim() || especialidades.length === 0)) {
      setError('Informe CRO e ao menos uma especialidade para assumir como responsável técnico.');
      setLoading(false);
      return;
    }
    const result = governanceRole
      ? await aceitarConviteGovernancaAction({
        token,
        cro: governanceRole === 'responsavel_tecnico' ? cro.trim() : null,
        especialidade: governanceRole === 'responsavel_tecnico' ? especialidades : [],
      })
      : await aceitarConviteAction(token);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {governanceRole === 'responsavel_tecnico' && (
        <div className="space-y-4 rounded-xl border border-border bg-surface-alt p-4">
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">CRO</label>
            <input
              value={cro}
              onChange={(event) => setCro(event.target.value)}
              placeholder="CRO-SP 12345"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">Especialidades</label>
            <EspecialidadeChips selected={especialidades} onChange={setEspecialidades} />
          </div>
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full bg-teal-ink text-surface rounded-xl font-bold py-3.5 hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
      >
            {loading ? 'Processando...' : (<>Aceitar convite <ArrowRight className="w-4 h-4" /></>)}
      </button>
    </div>
  );
}

export function WrongAccountButton(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function switchAccount(): Promise<void> {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void switchAccount()}
      className="w-full rounded-xl border border-border bg-surface py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-alt disabled:opacity-60"
    >
      {loading ? 'Saindo...' : 'Entrar com o email convidado'}
    </button>
  );
}
