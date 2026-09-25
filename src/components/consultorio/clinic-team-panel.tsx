'use client';

import { useActionState, useState } from 'react';
import { BadgeCheck, MailPlus, ShieldCheck, Stethoscope, UserRoundCog, Users } from 'lucide-react';

import { inviteTeamMember, type InviteState } from '@/app/consultorio/equipe/actions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ClinicTeamMember } from '@/server/consultorio/team';
import type { ClinicRepassesData } from '@/server/financeiro/repasses';

const initial: InviteState = { ok: false, message: '' };

export function ClinicTeamPanel({ members, canInvite, repasses, message }: { members: ClinicTeamMember[]; canInvite: boolean; repasses?: ClinicRepassesData | null; message?: string }): React.JSX.Element {
  const [inviteKind, setInviteKind] = useState<'dentista' | 'gestao' | null>(null);
  const [state, action, pending] = useActionState(inviteTeamMember, initial);
  const activeClinical = members.filter((member) => member.status === 'ativo' && member.atuaClinicamente);
  const configuredAgreements = activeClinical.filter((member) => member.dentistaId && repasses?.profissionais.some((person) => person.dentistaId === member.dentistaId && person.acordo)).length;
  const managementMembers = members.filter((member) => member.status === 'ativo' && (member.proprietario || member.papel === 'gestor')).length;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal">Minha equipe</p><h2 className="mt-1 font-heading text-[28px] font-normal text-foreground">Contratos e acessos continuam aqui.</h2><p className="mt-1 text-sm text-muted-foreground">O contrato define a modalidade de repasse; a permissão define quem registra custos.</p></div>
        {canInvite && <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => setInviteKind('dentista')}><Stethoscope className="size-4" />Adicionar dentista</Button><Button className="min-h-11" onClick={() => setInviteKind('gestao')}><MailPlus className="size-4" />Adicionar gestão</Button></div>}
      </div>
      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 xl:grid-cols-4"><TeamMetric label="Profissionais ativos" value={activeClinical.length} /><TeamMetric label="Contratos vigentes" value={configuredAgreements} /><TeamMetric label="Aguardando contrato" value={Math.max(0, activeClinical.length - configuredAgreements)} /><TeamMetric label="Gestores" value={managementMembers} /></section>
      {message && <section role="alert" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{message}</section>}
      <section className="grid gap-4 lg:grid-cols-2">
        {members.length === 0 && !message ? <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">Nenhum membro ativo encontrado.</div> : members.map((member) => { const agreement = member.dentistaId ? repasses?.profissionais.find((person) => person.dentistaId === member.dentistaId)?.acordo : null; return <article key={member.membroId} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-pale text-teal">{roleIcon(member)}</span><div className="min-w-0"><h3 className="truncate font-semibold text-foreground">{member.nome}</h3><p className="mt-1 truncate text-sm text-muted-foreground">{member.email ?? 'E-mail não informado'}</p></div></div><span className={member.status === 'ativo' ? 'rounded-full bg-teal-pale px-2.5 py-1 text-xs font-semibold text-teal' : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'}>{member.status === 'ativo' ? 'Ativo' : member.status === 'convite_pendente' ? 'Convite pendente' : member.status}</span></div><div className="mt-5 flex flex-wrap gap-2"><Tag>{roleLabel(member)}</Tag>{member.atuaClinicamente && <Tag>Atende pacientes</Tag>}{member.proprietario && <Tag>Responsável pela clínica</Tag>}</div>{member.atuaClinicamente && member.status === 'ativo' && <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acordo de repasse</p><p className={agreement ? 'mt-1 text-sm font-medium text-teal' : 'mt-1 text-sm text-muted-foreground'}>{agreement ? repasseLabel(agreement) : 'Pendente de configuração'}</p></div>}</article>; })}
      </section>

      <Dialog open={inviteKind !== null} onOpenChange={(open) => !open && setInviteKind(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{inviteKind === 'dentista' ? 'Adicionar dentista' : 'Adicionar gestão'}</DialogTitle><DialogDescription>A pessoa recebe um link individual e cria a própria senha.</DialogDescription></DialogHeader>
          <form action={action} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">Nome<Input className="mt-2" name="nome" minLength={2} maxLength={120} required /></label>
            <label className="block text-sm font-medium text-foreground">E-mail<Input className="mt-2" name="email" type="email" required /></label>
            {inviteKind === 'dentista' ? <input type="hidden" name="tipo" value="dentista" /> : <label className="block text-sm font-medium text-foreground">Função<select name="tipo" className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="gestor">Gestor</option><option value="responsavel_tecnico">Responsável técnico</option></select></label>}
            {state.message && <p role="status" className={state.ok ? 'text-sm text-teal' : 'text-sm text-destructive'}>{state.message}</p>}
            <Button type="submit" className="w-full min-h-11" disabled={pending}>{pending ? 'Enviando…' : 'Enviar convite'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function roleIcon(member: ClinicTeamMember): React.JSX.Element {
  if (member.proprietario) return <BadgeCheck className="size-5" />;
  if (member.papel === 'gestor') return <UserRoundCog className="size-5" />;
  if (member.papel === 'secretaria') return <ShieldCheck className="size-5" />;
  if (member.atuaClinicamente) return <Stethoscope className="size-5" />;
  return <Users className="size-5" />;
}
function roleLabel(member: ClinicTeamMember): string {
  if (member.proprietario) return 'Proprietário';
  if (member.papel === 'gestor') return 'Gestor';
  if (member.papel === 'responsavel_tecnico') return 'Responsável técnico';
  if (member.papel === 'dentista') return 'Dentista';
  if (member.papel === 'secretaria') return 'Secretaria';
  if (member.atuaClinicamente) return 'Dentista';
  return member.papel;
}
function Tag({ children }: { children: React.ReactNode }): React.JSX.Element { return <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">{children}</span>; }
function TeamMetric({ label, value }: { label: string; value: number }): React.JSX.Element { return <div><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p></div>; }
function repasseLabel(acordo: NonNullable<ClinicRepassesData['profissionais'][number]['acordo']>): string { if (acordo.modalidade === 'percentual_recebido') return `${acordo.percentual?.toLocaleString('pt-BR')}% dos recebimentos confirmados`; if (acordo.modalidade === 'diaria') return `Diária de R$ ${(acordo.valorFixo ?? 0).toLocaleString('pt-BR')}`; return `Mensal de R$ ${(acordo.valorFixo ?? 0).toLocaleString('pt-BR')}`; }
