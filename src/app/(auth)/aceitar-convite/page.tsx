'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DentIALogo } from '@/components/ui/dent-ia-logo';
import { criarDentistaConvidado } from './actions';

function AceitarConviteForm() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const code       = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const supabase   = createClient();
  const exchanged  = useRef(false);

  // Fluxo PKCE: troca o código por sessão assim que a página carrega
  useEffect(() => {
    if (!code || exchanged.current) return;
    exchanged.current = true;
    setExchanging(true);

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error: err }) => {
        if (err) setError('Link expirado ou inválido. Solicite um novo convite.');
        else setSessionReady(true);
      })
      .finally(() => setExchanging(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!code && !token_hash) setError('Link inválido. Solicite um novo convite.');
  }, [code, token_hash]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Fluxo token_hash: cria sessão agora
    if (token_hash && !sessionReady) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'invite',
      });
      if (verifyError) {
        setError('Link expirado ou inválido. Solicite um novo convite.');
        setLoading(false);
        return;
      }
    }

    // Define senha e salva nome nos metadados
    const { error: updateError } = await supabase.auth.updateUser({
      password: senha,
      data: { nome },
    });
    if (updateError) {
      setError('Erro ao definir senha. Tente novamente.');
      setLoading(false);
      return;
    }

    // Cria registro em dentistas via server action (service role)
    const result = await criarDentistaConvidado(nome);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  // Link inválido (sem token)
  if (!code && !token_hash) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-teal">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <DentIALogo className="w-12 h-12 text-white" />
              <span className="font-heading text-3xl text-white tracking-widest">
                DENT <em className="font-serif">IA</em>
              </span>
            </div>
            <p className="font-serif text-2xl text-white text-center italic px-12">
              Do atendimento ao orçamento, em segundos.
            </p>
          </div>
        </div>
        <div className="flex-1 bg-bg flex flex-col items-center justify-center min-h-screen px-12">
          <div className="w-full max-w-md bg-surface rounded-3xl border border-border p-8 text-center">
            <p className="text-text-secondary mb-6">Link inválido ou expirado. Solicite um novo convite ao administrador.</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-teal text-white rounded-xl font-bold py-3 px-6 hover:bg-teal-dark transition-all"
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Carregando troca de código PKCE
  if (exchanging) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-full max-w-md space-y-4 px-4">
          <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
          <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
          <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
        </div>
      </div>
    );
  }

  // Erro no código PKCE
  if (error && !sessionReady && !token_hash) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-teal">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <DentIALogo className="w-12 h-12 text-white" />
              <span className="font-heading text-3xl text-white tracking-widest">
                DENT <em className="font-serif">IA</em>
              </span>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-bg flex flex-col items-center justify-center min-h-screen px-12">
          <div className="w-full max-w-md bg-surface rounded-3xl border border-border p-8 text-center">
            <p className="text-text-secondary mb-6">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-teal text-white rounded-xl font-bold py-3 px-6 hover:bg-teal-dark transition-all"
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Formulário principal
  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — igual ao login */}
      <div className="hidden md:flex flex-col items-center justify-center w-1/2 min-h-screen bg-teal">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <DentIALogo className="w-12 h-12 text-white" />
            <span className="font-heading text-3xl text-white tracking-widest">
              DENT <em className="font-serif">IA</em>
            </span>
          </div>
          <p className="font-serif text-2xl text-white text-center italic px-12">
            Do atendimento ao orçamento, em segundos.
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 bg-bg flex flex-col items-center justify-center min-h-screen px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h1 className="font-serif text-4xl text-text-primary mb-2">Complete seu cadastro</h1>
          <p className="text-text-secondary text-sm font-medium mb-8">
            Defina seu nome e senha para acessar a clínica.
          </p>

          <div className="bg-surface rounded-3xl border border-border shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required
                  disabled={loading}
                  className="bg-surface-alt border border-border rounded-xl px-4 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all placeholder:text-text-secondary"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-text-secondary uppercase tracking-widest mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading}
                  className="bg-surface-alt border border-border rounded-xl px-4 py-3 text-sm text-text-primary w-full focus:ring-2 focus:ring-teal/20 outline-none transition-all"
                />
                <p className="mt-1 text-xs text-text-secondary font-mono">Mínimo 8 caracteres</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-teal text-white rounded-xl font-bold py-3 w-full hover:bg-teal-dark transition-all mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 10px 30px -10px rgba(47, 156, 133, 0.4)' }}
              >
                {loading ? 'Salvando...' : (
                  <>Criar conta e acessar <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              {error && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function AceitarConvite() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="h-12 rounded-xl bg-surface-alt animate-pulse" />
          <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
          <div className="h-11 rounded-xl bg-surface-alt animate-pulse" />
        </div>
      </div>
    }>
      <AceitarConviteForm />
    </Suspense>
  );
}
