'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronRight, LogOut, Moon, RefreshCw, Search, Sun, UsersRound, X } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogout } from '@/hooks/use-logout';
import { cn } from '@/lib/utils';
import type { TeamMember, TeamPage, TeamResult } from '@/server/auth/list-team';

type TeamFailure = Extract<TeamResult, { ok: false }>;

type LoadPage = (input: {
  clinicaIdEsperada: string;
  apos?: string | null;
}) => Promise<TeamResult>;

type TeamWorkspaceProps = {
  initialResult: TeamResult;
  canAttend: boolean;
  loadPage: LoadPage;
};

const ROLE_LABEL: Record<TeamMember['papel'], string> = {
  admin: 'Administrador legado',
  dentista: 'Dentista',
  secretaria: 'Recepção',
  protetico: 'Protético',
  gestor: 'Gestor',
};

const STATUS_LABEL: Record<TeamMember['status'], string> = {
  ativo: 'Ativo',
  pendente: 'Pendente',
  suspenso: 'Suspenso',
  removido: 'Removido',
};

function personInitials(member: TeamMember): string {
  const words = member.nome.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word.at(0)).join('');
  return (initials || member.email.slice(0, 2)).toLocaleUpperCase('pt-BR');
}

function memberLabel(member: TeamMember): string {
  return member.proprietario ? 'Proprietário' : ROLE_LABEL[member.papel];
}

function attendanceLabel(member: TeamMember): string {
  return member.atuaClinicamente ? 'Atende nesta unidade' : 'Não atende';
}

function EmptyState() {
  return (
    <div className="px-5 py-10 text-center">
      <UsersRound className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-foreground">Nenhuma pessoa nesta unidade</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
        A consulta foi concluída e não há vínculos para mostrar.
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2 px-2 pb-2" aria-label="Carregando mais pessoas" aria-live="polite">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex min-h-[76px] items-center gap-3 rounded-xl px-3">
          <div className="size-10 animate-pulse rounded-full bg-surface-alt motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-32 animate-pulse rounded bg-surface-alt motion-reduce:animate-none" /><div className="h-3 w-44 animate-pulse rounded bg-surface-alt motion-reduce:animate-none" /></div>
        </div>
      ))}
    </div>
  );
}

function ReadError({
  error,
  onRetry,
  retrying,
}: {
  error: TeamFailure;
  onRetry: (() => void) | null;
  retrying: boolean;
}) {
  const requiresRefresh = error.codigo === 'SEM_ACESSO' || error.codigo === 'CONTEXTO_ALTERADO';

  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-8 text-center" aria-live="assertive">
      <p className="font-heading text-2xl text-foreground">Equipe indisponível</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-muted-foreground">{error.mensagem}</p>
      <div className="mt-5 flex justify-center">
        {requiresRefresh || !onRetry ? (
          <Button variant="outline" className="min-h-11 focus-visible:border-ring focus-visible:ring-ring" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {requiresRefresh ? 'Atualizar página' : 'Tentar novamente'}
          </Button>
        ) : (
          <Button variant="outline" className="min-h-11 focus-visible:border-ring focus-visible:ring-ring" onClick={onRetry} disabled={retrying}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {retrying ? 'Consultando…' : 'Tentar novamente'}
          </Button>
        )}
      </div>
    </section>
  );
}

function ManagementThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!mounted) {
    return <span className="size-11 rounded-lg border border-border bg-surface-alt" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      className="grid size-11 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Alternar tema"
    >
      {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  );
}

function ManagementSidebar() {
  return (
    <aside className="dark fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-border bg-brand-charcoal px-4 py-8 text-foreground lg:flex" aria-label="Meu Consultório">
      <div className="px-3 font-heading text-[27px] leading-none tracking-[-0.03em]">Odonto.<span className="text-teal-ink">IA</span></div>
      <p className="mt-12 px-3 font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Meu Consultório</p>
      <nav className="mt-2 grid gap-1 text-sm font-semibold" aria-label="Seções planejadas">
        <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground"><span className="size-1.5 rounded-full bg-current" />Visão geral</span>
        <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground"><span className="size-1.5 rounded-full bg-current" />Recepção</span>
        <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground"><span className="size-1.5 rounded-full bg-current" />Financeiro</span>
        <span className="flex min-h-11 items-center gap-2 rounded-lg bg-teal-pale px-3 text-teal-ink"><span className="size-1.5 rounded-full bg-current" />Equipe</span>
        <span className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-muted-foreground"><span className="size-1.5 rounded-full bg-current" />Configurações</span>
      </nav>
    </aside>
  );
}

function TeamScreenFrame({
  clinicaNome,
  canAttend,
  isLoggingOut,
  onLogout,
  children,
}: {
  clinicaNome?: string;
  canAttend: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  const initials = clinicaNome?.slice(0, 2).toLocaleUpperCase('pt-BR') ?? 'GE';

  return (
    <div className="min-h-screen [--background:var(--color-bg)] [--card:var(--color-surface)] [--foreground:var(--color-text-primary)] [--muted-foreground:var(--color-text-secondary)] bg-background text-foreground">
      <ManagementSidebar />
      <main className="px-4 pt-4 pb-8 sm:px-6 sm:pt-6 lg:ml-[248px] lg:px-12 lg:pt-8 lg:pb-14">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-pale font-mono text-xs text-teal-ink" aria-hidden="true">{initials}</span>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{clinicaNome ?? 'Gestão'}</p><p className="mt-0.5 text-xs text-muted-foreground">{clinicaNome ? 'Unidade em consulta' : 'Acesso à gestão'}</p></div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <span className="inline-flex min-h-11 items-center rounded-lg border border-border bg-teal-pale px-3 text-sm font-semibold text-teal-ink">Gestão</span>
            {canAttend ? <Link href="/dashboard/meu-dia" className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">Atendimento</Link> : null}
            <ManagementThemeToggle />
            <Button variant="outline" className="min-h-11 focus-visible:border-ring focus-visible:ring-ring" onClick={onLogout} disabled={isLoggingOut}><LogOut className="size-4" aria-hidden="true" />{isLoggingOut ? 'Saindo…' : 'Sair'}</Button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function TeamWorkspace({ initialResult, canAttend, loadPage }: TeamWorkspaceProps) {
  const [page, setPage] = useState<TeamPage | null>(() => initialResult.ok ? initialResult.data : null);
  const [members, setMembers] = useState<TeamMember[]>(() => initialResult.ok ? initialResult.data.membros : []);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialResult.ok ? initialResult.data.membros.at(0)?.membroId ?? null : null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<TeamFailure | null>(() => initialResult.ok ? null : initialResult);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const memberButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const { logout, isLoggingOut } = useLogout();

  function selectMember(memberId: string) {
    setSelectedId(memberId);
    if (!window.matchMedia('(max-width: 1279px)').matches) return;
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      detailRef.current?.focus({ preventScroll: true });
    });
  }

  function closeDetails() {
    const previousSelectedId = selectedId;
    setSelectedId(null);

    window.requestAnimationFrame(() => {
      const focusTarget = previousSelectedId ? memberButtonRefs.current.get(previousSelectedId) : null;
      const fallbackTarget = listHeadingRef.current;
      const target = focusTarget ?? fallbackTarget;
      if (!target) return;

      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });
  }

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return members;
    return members.filter((member) => member.nome.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [members, query]);

  const selectedMember = members.find((member) => member.membroId === selectedId) ?? null;

  async function requestPage(apos: string | null, mode: 'replace' | 'append') {
    if (!page) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await loadPage({ clinicaIdEsperada: page.clinicaId, apos });
      if (!result.ok) {
        setPage(null);
        setMembers([]);
        setSelectedId(null);
        setError(result);
        return;
      }

      setPage(result.data);
      setMembers((current) => {
        if (mode === 'replace') return result.data.membros;
        const knownIds = new Set(current.map((member) => member.membroId));
        return [...current, ...result.data.membros.filter((member) => !knownIds.has(member.membroId))];
      });
      setSelectedId((current) => current ?? result.data.membros.at(0)?.membroId ?? null);
    } catch {
      setPage(null);
      setMembers([]);
      setSelectedId(null);
      setError({ ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar a equipe. Tente novamente.' });
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (!page) {
    return (
      <TeamScreenFrame canAttend={false} isLoggingOut={isLoggingOut} onLogout={() => { void logout(); }}>
        <section aria-labelledby="team-workspace-title"><p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Meu Consultório · Gestão</p><h1 id="team-workspace-title" className="mt-2 font-heading text-4xl leading-none tracking-[-0.02em] text-foreground sm:text-[42px]">Equipe</h1><div className="mt-6"><ReadError error={error ?? { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível consultar a equipe. Tente novamente.' }} onRetry={null} retrying={false} /></div></section>
      </TeamScreenFrame>
    );
  }

  const hasNextPage = page.proximo !== null;

  return (
    <TeamScreenFrame clinicaNome={page.clinicaNome} canAttend={canAttend} isLoggingOut={isLoggingOut} onLogout={() => { void logout(); }}>
      <section aria-labelledby="team-workspace-title">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Meu Consultório · Gestão</p>
          <h1 id="team-workspace-title" className="mt-2 font-heading text-4xl leading-none tracking-[-0.02em] text-foreground sm:text-[42px]">Equipe</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">Veja quem atua na unidade e consulte a função e a situação de cada pessoa.</p>
        </div>
      </header>

      {error ? <div className="mb-4"><ReadError error={error} onRetry={() => requestPage(null, 'replace')} retrying={isLoadingMore} /></div> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(340px,0.9fr)_minmax(440px,1.1fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-labelledby="team-list-title">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
            <div><h2 ref={listHeadingRef} id="team-list-title" tabIndex={-1} className="font-heading text-[26px] leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Pessoas</h2><p className="mt-2 text-sm text-muted-foreground">{members.length} {members.length === 1 ? 'pessoa' : 'pessoas'} carregadas</p></div>
          </div>
          <div className="border-b border-border p-4"><div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar entre pessoas carregadas" aria-label="Buscar entre pessoas carregadas" aria-describedby="team-search-help" className="min-h-11 pl-10 placeholder:text-foreground/70 focus-visible:border-ring focus-visible:ring-ring" /></div><p id="team-search-help" className="mt-2 text-xs leading-5 text-muted-foreground">A busca filtra as pessoas carregadas. Use “Carregar mais” para ampliar a consulta.</p></div>
          {members.length === 0 ? <EmptyState /> : (
            <div className="max-h-[440px] overflow-y-auto p-2 sm:max-h-[560px]" aria-label="Pessoas da equipe">
              {visibleMembers.map((member) => {
                const selected = member.membroId === selectedId;
                return <button key={member.membroId} ref={(node) => {
                  if (node) memberButtonRefs.current.set(member.membroId, node);
                  else memberButtonRefs.current.delete(member.membroId);
                }} type="button" aria-pressed={selected} onClick={() => selectMember(member.membroId)} className={cn('grid min-h-[88px] w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl px-3 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:min-h-[76px] sm:grid-cols-[40px_minmax(0,1fr)_auto]', selected && 'bg-surface-alt shadow-[inset_3px_0_0_var(--color-teal)]')}>
                  <span className={cn('row-span-2 grid size-10 place-items-center rounded-full bg-surface-alt text-xs font-bold text-foreground/80 sm:row-span-1', selected && 'bg-teal-pale text-teal-ink')}>{personInitials(member)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{member.nome}</span><span className="mt-1 block truncate text-xs text-foreground/80">{member.email} · {attendanceLabel(member)}</span></span>
                  <span className={cn('col-start-2 w-fit max-w-full truncate rounded-full bg-surface-alt px-2 py-1 font-mono text-[10px] tracking-wide text-foreground/80 sm:col-auto', member.proprietario && 'bg-teal-pale text-teal-ink')}>{memberLabel(member)}</span>
                </button>;
              })}
              {visibleMembers.length === 0 ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma pessoa encontrada para esta busca.</p> : null}
            </div>
          )}
          {isLoadingMore ? <LoadingRows /> : null}
          {hasNextPage ? <div className="border-t border-border p-3"><Button variant="outline" className="min-h-11 w-full focus-visible:border-ring focus-visible:ring-ring" onClick={() => requestPage(page.proximo, 'append')} disabled={isLoadingMore}>{isLoadingMore ? 'Carregando…' : 'Carregar mais'}<ChevronRight className="size-4" aria-hidden="true" /></Button></div> : null}
        </section>

        <aside ref={detailRef} tabIndex={-1} className="overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-labelledby="member-detail-title">
          {selectedMember ? <>
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5"><div className="min-w-0"><p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Informações da pessoa</p><h2 id="member-detail-title" className="mt-1 break-words font-heading text-[26px] leading-none text-foreground [overflow-wrap:anywhere]">{selectedMember.nome}</h2></div><Button variant="outline" size="icon" className="min-h-11 min-w-11 focus-visible:border-ring focus-visible:ring-ring xl:hidden" onClick={closeDetails} aria-label="Fechar detalhes"><X className="size-4" aria-hidden="true" /></Button></div>
            <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-border px-5 py-5"><span className="grid size-12 place-items-center rounded-full bg-surface-alt text-sm font-bold text-foreground/80">{personInitials(selectedMember)}</span><div className="min-w-0"><p className="break-words text-base font-bold text-foreground [overflow-wrap:anywhere]">{selectedMember.nome}</p><p className="mt-1 break-words text-sm text-foreground/80 [overflow-wrap:anywhere]">{selectedMember.email}</p><div className="mt-3 flex flex-wrap gap-2"><span className={cn('rounded-full bg-surface-alt px-2 py-1 font-mono text-[10px] tracking-wide text-foreground/80', selectedMember.proprietario && 'bg-teal-pale text-teal-ink')}>{memberLabel(selectedMember)}</span>{selectedMember.proprietario ? <span className="rounded-full bg-surface-alt px-2 py-1 font-mono text-[10px] tracking-wide text-foreground/80">{ROLE_LABEL[selectedMember.papel]}</span> : null}<span className="rounded-full bg-surface-alt px-2 py-1 text-xs text-foreground/80">{attendanceLabel(selectedMember)}</span><span className="rounded-full bg-surface-alt px-2 py-1 text-xs text-foreground/80">{STATUS_LABEL[selectedMember.status]}</span></div></div></div>
            <div className="px-5 py-5"><p className="text-sm font-semibold text-foreground">Permissões</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Permissões e convites serão disponibilizados nesta área.</p></div>
          </> : <div className="px-5 py-12 text-center"><UsersRound className="mx-auto size-5 text-muted-foreground" aria-hidden="true" /><h2 id="member-detail-title" className="mt-3 font-heading text-2xl text-foreground">Selecione uma pessoa</h2><p className="mt-2 text-sm leading-5 text-muted-foreground">Os detalhes de função e atuação aparecem aqui.</p></div>}
        </aside>
      </div>
      </section>
    </TeamScreenFrame>
  );
}
