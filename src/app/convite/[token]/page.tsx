import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getConviteByToken } from '@/server/services/invites';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { InviteAuthClient, AcceptButton } from './_components/invite-client';
import { NeuralBackground } from '@/components/layout/NeuralBackground';
import { Building2, Clock, UserCheck, XCircle } from 'lucide-react';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ConvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await getConviteByToken(token);

  // Convite expirado → página dedicada
  if (
    invite &&
    (invite.status === 'expirado' || new Date(invite.expiresAt) < new Date())
  ) {
    redirect('/convite-expirado');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isInvalid = !invite || invite.status !== 'pendente';

  return (
    <div
      className="relative min-h-screen bg-bg flex flex-col items-center justify-center p-4"
      style={{
        '--color-bg': '#f5f3ef',
        '--color-surface': '#ffffff',
        '--color-surface-alt': '#eceae4',
        '--color-border': '#d4d1ca',
        '--color-text-primary': '#0d0d0d',
        '--color-text-secondary': '#8a8a8a',
      } as React.CSSProperties}
    >
      <NeuralBackground />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-4 shadow-lg">
            <OdontoIALogo className="w-7 h-7" />
          </div>
          <p className="text-text-secondary text-sm font-medium font-mono uppercase tracking-widest">
            Odonto.IA
          </p>
        </div>

        <div className="bg-surface rounded-3xl border border-border shadow-sm p-8">
          {/* Convite inválido / expirado / cancelado */}
          {isInvalid && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-coral/10 mb-2">
                <XCircle className="w-7 h-7 text-coral" />
              </div>
              <h1 className="font-heading font-semibold text-2xl text-text-primary">Convite inválido</h1>
              <p className="text-text-secondary text-sm leading-relaxed">
                {!invite
                  ? 'Este link de convite não existe ou foi removido.'
                  : invite.status === 'aceito'
                    ? 'Este convite já foi aceito.'
                    : invite.status === 'cancelado'
                      ? 'Este convite foi cancelado pelo administrador.'
                      : 'Este convite expirou. Peça ao administrador que envie um novo.'}
              </p>
            </div>
          )}

          {/* Convite válido */}
          {!isInvalid && invite && (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <h1 className="font-heading font-semibold text-2xl text-text-primary mb-1">
                  Você foi convidado
                </h1>
                <p className="text-text-secondary text-sm">
                  Para ingressar como dentista na clínica
                </p>
              </div>

              {/* Info da clínica */}
              <div className="bg-surface-alt rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-teal shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary font-mono uppercase tracking-widest">Clínica</p>
                    <p className="text-sm font-semibold text-text-primary">{invite.clinicaNome}</p>
                  </div>
                </div>

                {invite.convidadoPorNome && (
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-teal shrink-0" />
                    <div>
                      <p className="text-xs text-text-secondary font-mono uppercase tracking-widest">Convidado por</p>
                      <p className="text-sm font-semibold text-text-primary">{invite.convidadoPorNome}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-text-secondary shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary font-mono uppercase tracking-widest">Expira em</p>
                    <p className="text-sm text-text-primary">
                      {new Date(invite.expiresAt).toLocaleDateString('pt-BR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Usuário autenticado com email correto */}
              {user && user.email?.toLowerCase() === invite.email.toLowerCase() && (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary text-center">
                    Logado como <span className="font-medium text-text-primary">{user.email}</span>
                  </p>
                  <AcceptButton token={token} />
                </div>
              )}

              {/* Usuário autenticado com email errado */}
              {user && user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-700">
                  Você está logado como <strong>{user.email}</strong>, mas este convite é para{' '}
                  <strong>{invite.email}</strong>. Faça logout e entre com o email correto.
                </div>
              )}

              {/* Usuário não autenticado */}
              {!user && (
                <InviteAuthClient token={token} inviteEmail={invite.email} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
