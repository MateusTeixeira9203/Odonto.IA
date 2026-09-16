'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  EDITOR_ACCESS_PERMISSIONS,
  type EditorAccess,
  type MemberAccessEditorResult,
} from '@/server/auth/member-access-editor-contracts';
import type { PrepareMemberAccessResult } from '@/server/auth/prepare-member-access';
import type { TeamMember } from '@/server/auth/list-team';

type LoadAccess = (input: { clinicaIdEsperada: string; membroId: string }) => Promise<MemberAccessEditorResult>;
type SaveAccess = (input: {
  clinicaIdEsperada: string;
  membroId: string;
  versaoEsperada: number;
  acessos: EditorAccess[];
  motivo: string;
  chaveIdempotencia: string;
}) => Promise<PrepareMemberAccessResult>;

type Permission = EditorAccess['permissao'];

type PermissionGroup = {
  title: string;
  description: string;
  permissions: readonly Permission[];
};

const GROUPS: readonly PermissionGroup[] = [
  {
    title: 'Agenda',
    description: 'Editar ou confirmar também exige visualizar a agenda.',
    permissions: ['agenda.ler', 'agenda.editar', 'agenda.confirmar'],
  },
  {
    title: 'Pacientes',
    description: 'Editar também exige visualizar os dados administrativos.',
    permissions: ['pacientes.ler', 'pacientes.editar'],
  },
  {
    title: 'Acompanhamentos e contatos',
    description: 'Gerir acompanhamentos exige visualizá-los; orçamento e WhatsApp são independentes.',
    permissions: ['acompanhamentos.ler', 'acompanhamentos.gerir', 'orcamentos.ler', 'contatos.whatsapp'],
  },
  {
    title: 'Cobranças e financeiro',
    description: 'Recebimentos exigem cobranças; exportar exige leitura financeira.',
    permissions: [
      'cobrancas.ler',
      'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar',
      'financeiro.ler', 'financeiro.exportar',
      'despesas.ler', 'despesas.gerir',
    ],
  },
  {
    title: 'Equipe',
    description: 'Permite consultar as pessoas desta unidade.',
    permissions: ['equipe.ler'],
  },
];

const LABELS: Record<Permission, string> = {
  'agenda.ler': 'Visualizar agenda',
  'agenda.editar': 'Editar agenda',
  'agenda.confirmar': 'Confirmar agenda',
  'pacientes.ler': 'Visualizar pacientes',
  'pacientes.editar': 'Editar pacientes',
  'acompanhamentos.ler': 'Visualizar acompanhamentos',
  'acompanhamentos.gerir': 'Gerir acompanhamentos',
  'orcamentos.ler': 'Visualizar orçamentos',
  'contatos.whatsapp': 'Usar WhatsApp dos contatos',
  'cobrancas.ler': 'Visualizar cobranças',
  'recebimentos.registrar': 'Registrar recebimentos',
  'recebimentos.corrigir': 'Corrigir recebimentos',
  'recebimentos.estornar': 'Estornar recebimentos',
  'financeiro.ler': 'Visualizar financeiro',
  'financeiro.exportar': 'Exportar financeiro',
  'despesas.ler': 'Visualizar despesas',
  'despesas.gerir': 'Gerir despesas',
  'equipe.ler': 'Visualizar equipe',
};

const DEPENDENCIES: Partial<Record<Permission, readonly Permission[]>> = {
  'agenda.editar': ['agenda.ler'],
  'agenda.confirmar': ['agenda.ler'],
  'pacientes.editar': ['pacientes.ler'],
  'acompanhamentos.gerir': ['acompanhamentos.ler'],
  'recebimentos.registrar': ['cobrancas.ler'],
  'recebimentos.corrigir': ['cobrancas.ler'],
  'recebimentos.estornar': ['cobrancas.ler'],
  'financeiro.exportar': ['financeiro.ler'],
  'despesas.gerir': ['despesas.ler'],
};

function isAllowedForMember(member: TeamMember, permission: Permission): boolean {
  return member.papel !== 'protetico' || permission === 'agenda.ler' || permission === 'agenda.confirmar';
}

function orderedAccesses(permissions: ReadonlySet<Permission>): EditorAccess[] {
  return EDITOR_ACCESS_PERMISSIONS
    .filter((permission): permission is Permission => permissions.has(permission))
    .map((permissao) => ({ permissao, escopo: { tipo: 'clinica' } }));
}

function addPermission(current: ReadonlySet<Permission>, permission: Permission): Set<Permission> {
  const next = new Set(current);
  next.add(permission);
  for (const dependency of DEPENDENCIES[permission] ?? []) next.add(dependency);
  return next;
}

function removePermission(current: ReadonlySet<Permission>, permission: Permission): Set<Permission> {
  const next = new Set(current);
  next.delete(permission);
  for (const [candidate, dependencies] of Object.entries(DEPENDENCIES) as Array<[Permission, readonly Permission[]]>) {
    if (dependencies.includes(permission)) next.delete(candidate);
  }
  return next;
}

function accessSet(acessos: readonly EditorAccess[]): Set<Permission> {
  return new Set(acessos.map((acesso) => acesso.permissao));
}

export function MemberAccessEditor({
  clinicaId,
  member,
  loadAccess,
  saveAccess,
}: {
  clinicaId: string;
  member: TeamMember;
  loadAccess: LoadAccess;
  saveAccess: SaveAccess;
}) {
  const [result, setResult] = useState<MemberAccessEditorResult | null>(null);
  const [draft, setDraft] = useState<Set<Permission>>(new Set());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  const isEditableMember = member.status === 'ativo' && !member.proprietario;

  useEffect(() => {
    if (!isEditableMember) return;
    let active = true;
    setResult(null);
    setFeedback(null);
    setReason('');
    void loadAccess({ clinicaIdEsperada: clinicaId, membroId: member.membroId }).then((next) => {
      if (!active) return;
      setResult(next);
      if (next.ok) setDraft(accessSet(next.data.acessos));
    }).catch(() => {
      if (active) setResult({ ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar as permissões agora.' });
    });
    return () => { active = false; };
  }, [clinicaId, isEditableMember, loadAccess, member.membroId]);

  const groups = useMemo(() => GROUPS
    .map((group) => ({ ...group, permissions: group.permissions.filter((permission) => isAllowedForMember(member, permission)) }))
    .filter((group) => group.permissions.length > 0), [member]);

  if (member.proprietario) {
    return <AccessNotice title="Permissões do proprietário" message="O proprietário mantém as capacidades-base da clínica. A própria configuração não pode ser alterada nesta área." />;
  }
  if (member.status !== 'ativo') {
    return <AccessNotice title="Permissões indisponíveis" message="Somente pessoas com vínculo ativo podem receber permissões." />;
  }
  if (!result) {
    return <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground" aria-live="polite"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Carregando permissões…</div>;
  }
  if (!result.ok) {
    return <AccessNotice title="Permissões indisponíveis" message={result.mensagem} />;
  }

  const toggle = (permission: Permission, checked: boolean) => {
    setFeedback(null);
    setDraft((current) => checked ? addPermission(current, permission) : removePermission(current, permission));
  };

  const submit = async () => {
    const motivo = reason.trim();
    if (!motivo) {
      setFeedback('Informe o motivo da alteração antes de salvar.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = JSON.stringify({ clinicaId, membroId: member.membroId, versao: result.data.versao, acessos: orderedAccesses(draft), motivo });
      if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
      const saved = await saveAccess({
        clinicaIdEsperada: clinicaId,
        membroId: member.membroId,
        versaoEsperada: result.data.versao,
        acessos: orderedAccesses(draft),
        motivo,
        chaveIdempotencia: attempt.current.key,
      });
      if (!saved.ok) {
        setFeedback(saved.mensagem);
        return;
      }
      attempt.current = null;
      setResult({ ok: true, data: { ...result.data, versao: saved.data.versao, acessos: orderedAccesses(draft) } });
      setReason('');
      setFeedback('Permissões salvas. As alterações valem na próxima operação.');
    } catch {
      setFeedback('Não foi possível salvar as permissões agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-t border-border px-5 py-5" aria-labelledby={`access-editor-${member.membroId}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-pale text-teal-ink"><ShieldCheck className="size-4" aria-hidden="true" /></span>
        <div><h3 id={`access-editor-${member.membroId}`} className="text-sm font-semibold text-foreground">Acessos desta pessoa</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">As permissões abaixo valem para toda a clínica.</p></div>
      </div>
      <div className="mt-5 divide-y divide-border">
        {groups.map((group) => <div key={group.title} className="py-4 first:pt-0">
          <p className="text-sm font-semibold text-foreground">{group.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
          <div className="mt-2">{group.permissions.map((permission) => <label key={permission} className="flex min-h-11 items-center justify-between gap-4 rounded-lg px-2 transition-colors hover:bg-surface-alt">
            <span className="flex items-center gap-3 text-sm text-foreground"><input type="checkbox" className="size-4 accent-[var(--color-teal)]" checked={draft.has(permission)} onChange={(event) => toggle(permission, event.target.checked)} disabled={saving} />{LABELS[permission]}</span><span className="text-xs text-muted-foreground">Toda a clínica</span>
          </label>)}</div>
        </div>)}
      </div>
      <label className="mt-2 block text-sm font-semibold text-foreground" htmlFor={`access-reason-${member.membroId}`}>Motivo da alteração</label>
      <Textarea id={`access-reason-${member.membroId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={saving} placeholder="Ex.: início das atividades na recepção" className="mt-2 min-h-20" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className={cn('text-sm', feedback?.startsWith('Permissões salvas') ? 'text-teal-ink' : 'text-muted-foreground')} aria-live="polite">{feedback}</p><Button type="button" className="min-h-11 focus-visible:ring-ring" onClick={() => { void submit(); }} disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}{saving ? 'Salvando…' : 'Salvar permissões'}</Button></div>
    </section>
  );
}

function AccessNotice({ title, message }: { title: string; message: string }) {
  return <section className="border-t border-border px-5 py-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p></div></div></section>;
}
