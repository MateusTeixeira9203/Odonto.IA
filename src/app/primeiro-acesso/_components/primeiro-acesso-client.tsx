'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { alterarSenhaPrimeiroAcesso } from '../actions';

export function PrimeiroAcessoClient() {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (novaSenha.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    const result = await alterarSenhaPrimeiroAcesso(novaSenha);

    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    // Sessão já foi atualizada server-side (updateUser + refreshSession + revalidatePath).
    // router.refresh() descarta o cache de server components da aba atual antes de navegar,
    // garantindo que nenhum fragmento stale de /primeiro-acesso ou /dashboard persista.
    router.refresh();
    router.push('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Aviso */}
      <div className="flex items-start gap-3 bg-teal/5 border border-teal/20 rounded-xl p-4">
        <ShieldCheck className="w-5 h-5 text-teal shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary leading-relaxed">
          Uma senha temporária foi usada para criar seu acesso. Por segurança, defina agora sua senha pessoal.
        </p>
      </div>

      {/* Nova senha */}
      <div>
        <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
          Nova senha
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type={showNova ? 'text' : 'password'}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => setShowNova(!showNova)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            {showNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirmar senha */}
      <div>
        <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
          Confirmar senha
        </label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type={showConfirmar ? 'text' : 'password'}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repita a nova senha"
            required
            className="bg-surface-alt border border-border rounded-xl pl-11 pr-11 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirmar(!showConfirmar)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white rounded-xl font-bold py-3.5 hover:bg-teal-dark transition-all mt-2 disabled:opacity-60"
        style={{ boxShadow: '0 10px 30px -10px rgba(47,156,133,0.4)' }}
      >
        {loading ? 'Salvando...' : 'Definir senha e entrar'}
      </button>
    </form>
  );
}
