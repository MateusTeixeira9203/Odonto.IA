import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getConviteByToken } from '@/server/services/invites';
import { getGovernanceInviteByToken } from '@/server/services/governance-invites';
import { InviteAuthClient, AcceptButton, WrongAccountButton } from './_components/invite-client';
import { AuthEntryShell } from '@/components/auth/auth-entry-shell';
import { Building2, Clock, UserCheck, XCircle } from 'lucide-react';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ConvitePage({ params }: Props) {
  const { token } = await params;
  const inviteDentista = await getConviteByToken(token);
  const inviteGovernanca = inviteDentista ? null : await getGovernanceInviteByToken(token);
  const invite = inviteDentista ?? inviteGovernanca;

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
    <AuthEntryShell
      eyebrow="Convite de clínica"
      title={isInvalid ? 'Este convite não está disponível.' : 'Entre para fazer parte da equipe.'}
      description={isInvalid ? 'Confira o estado do convite abaixo.' : 'Confirme a clínica, use o email convidado e aceite o vínculo explicitamente.'}
    >
      <div className="w-full">
        <div className="bg-surface/90 rounded-2xl border border-border shadow-sm p-6 sm:p-8 backdrop-blur-sm">
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
                  Para ingressar como {inviteGovernanca?.role === 'responsavel_tecnico' ? 'responsável técnico' : inviteGovernanca?.role === 'gestor' ? 'gestor' : 'dentista'} na clínica
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

                {inviteDentista?.convidadoPorNome && (
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-teal shrink-0" />
                    <div>
                      <p className="text-xs text-text-secondary font-mono uppercase tracking-widest">Convidado por</p>
                      <p className="text-sm font-semibold text-text-primary">{inviteDentista.convidadoPorNome}</p>
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
                  <AcceptButton token={token} governanceRole={inviteGovernanca?.role ?? null} />
                </div>
              )}

              {/* Usuário autenticado com email errado */}
              {user && user.email?.toLowerCase() !== invite.email.toLowerCase() && (
                <div className="space-y-3">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-700">
                    Você está logado como <strong>{user.email}</strong>, mas este convite é para{' '}
                    <strong>{invite.email}</strong>.
                  </div>
                  <WrongAccountButton />
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
    </AuthEntryShell>
  );
}
