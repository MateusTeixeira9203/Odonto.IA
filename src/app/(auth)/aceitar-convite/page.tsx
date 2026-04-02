'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function AceitarConviteForm() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Fluxo PKCE: sessão já foi criada antes de mostrar o formulário
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
        if (err) {
          setError('Link expirado ou inválido. Solicite um novo convite.');
        } else {
          setSessionReady(true);
        }
      })
      .finally(() => setExchanging(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Fluxo token_hash: sem pré-processamento — sessão é criada no submit
  useEffect(() => {
    if (!code && !token_hash) {
      setError('Link inválido. Solicite um novo convite.');
    }
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

    // Neste ponto a sessão está ativa (seja via code ou token_hash)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError('Erro ao recuperar dados do usuário.');
      setLoading(false);
      return;
    }

    const clinicaId = user.user_metadata?.clinica_id as string | undefined;

    // Remover convite pendente (best-effort)
    if (clinicaId) {
      await supabase
        .from('convites')
        .delete()
        .eq('email', user.email ?? '')
        .eq('clinica_id', clinicaId);
    }

    // Salvar nome nos metadados + definir senha.
    // O registro em `dentistas` é criado pelo dashboard/layout via service role.
    const { error: updateError } = await supabase.auth.updateUser({
      password: senha,
      data: { nome },
    });
    if (updateError) {
      setError('Erro ao definir senha. Tente novamente.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  // Estados de carregamento / erro antes de mostrar o formulário
  if (!code && !token_hash) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-surface p-8 rounded-2xl shadow-lg text-center">
          <p className="text-red-600 mb-4">Link inválido</p>
          <Button onClick={() => router.push('/login')}>Ir para login</Button>
        </div>
      </div>
    );
  }

  if (exchanging) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 bg-surface rounded-2xl shadow-lg animate-pulse h-64" />
      </div>
    );
  }

  if (error && !sessionReady && !token_hash) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-surface p-8 rounded-2xl shadow-lg text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/login')}>Ir para login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-surface rounded-2xl shadow-lg">
        <h1 className="text-2xl font-serif text-center">Complete seu cadastro</h1>
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Criar conta e acessar'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AceitarConvite() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 bg-surface rounded-2xl shadow-lg animate-pulse h-64" />
      </div>
    }>
      <AceitarConviteForm />
    </Suspense>
  );
}
