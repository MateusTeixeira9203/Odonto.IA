'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Users,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PacienteRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
  data_nascimento: string | null;
  followup_pendente?: boolean;
};

type SortCol = 'nome' | 'created_at';

interface CurrentParams {
  q: string;
  sort: SortCol;
  order: 'asc' | 'desc';
  page: number;
}

interface PacientesTableProps {
  pacientes: PacienteRow[];
  total: number;
  canCreate: boolean;
  currentParams: CurrentParams;
}

const PAGE_SIZE = 25;

const AVATAR_COLORS = [
  'bg-teal',
  'bg-teal/70',
  'bg-teal-lt',
  'bg-teal-dark',
  'bg-teal-sym',
  'bg-teal/50',
] as const;

function getPaginationPages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | null)[] = [1];
  if (current > 3) pages.push(null);
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}

export function PacientesTable({
  pacientes,
  total,
  canCreate,
  currentParams,
}: PacientesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState(currentParams.q);
  const [filterFollowup, setFilterFollowup] = useState(false);

  // Multi-user: atualiza quando a janela recupera foco (throttle 60s)
  useEffect(() => {
    let lastRefresh = Date.now();
    const handler = () => {
      const now = Date.now();
      if (now - lastRefresh > 60_000) {
        lastRefresh = now;
        startTransition(() => router.refresh());
      }
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [router]);

  const pacientesFiltrados = filterFollowup
    ? pacientes.filter(p => p.followup_pendente)
    : pacientes;

  const { q, sort, order, page } = currentParams;

  // Sync input when server re-renders with new params (e.g., browser back)
  useEffect(() => {
    setInputValue(q);
  }, [q]);

  const navigate = useCallback(
    (overrides: Partial<CurrentParams>) => {
      const merged: CurrentParams = { q, sort, order, page, ...overrides };
      const params = new URLSearchParams();
      if (merged.q) params.set('q', merged.q);
      if (merged.sort !== 'nome') params.set('sort', merged.sort);
      if (merged.order !== 'asc') params.set('order', merged.order);
      if (merged.page > 1) params.set('page', String(merged.page));
      const qs = params.toString();
      startTransition(() => {
        router.push(`/dashboard/pacientes${qs ? `?${qs}` : ''}`);
      });
    },
    [q, sort, order, page, router],
  );

  // Debounced search — 300ms after user stops typing
  useEffect(() => {
    if (inputValue === q) return;
    const timer = setTimeout(() => {
      navigate({ q: inputValue, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, q, navigate]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);
  const paginationPages = getPaginationPages(page, totalPages);

  const isEmpty = pacientes.length === 0;
  const isSearchEmpty = isEmpty && !!q;
  const isDataEmpty = isEmpty && !q;

  function handleSort(col: SortCol) {
    if (sort === col) {
      navigate({ order: order === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      navigate({ sort: col, order: 'asc', page: 1 });
    }
  }

  function SortIndicator({ col }: { col: SortCol }) {
    if (sort !== col) {
      return (
        <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
      );
    }
    return order === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-teal" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-teal" />
    );
  }

  return (
    <div className={isPending ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">

        {/* Toolbar — search only (no stub buttons) */}
        <div className="p-4 border-b border-border bg-surface-alt/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar por nome, email ou telefone..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-surface
                         text-sm text-text-primary placeholder:text-text-muted
                         focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal/60
                         transition-all"
            />
            <AnimatePresence>
              {inputValue && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.1 }}
                  onClick={() => setInputValue('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary
                             hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Quick filter: follow-up */}
          {pacientes.some(p => p.followup_pendente) && (
            <button
              onClick={() => setFilterFollowup(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                filterFollowup
                  ? 'bg-teal/10 border-teal/30 text-teal'
                  : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-teal/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filterFollowup ? 'bg-teal' : 'bg-text-secondary/40'}`} />
              Follow-up
              {filterFollowup && (
                <span className="font-mono">({pacientesFiltrados.length})</span>
              )}
            </button>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt/40">
                <th
                  onClick={() => handleSort('nome')}
                  className="px-6 py-3.5 text-left cursor-pointer group"
                >
                  <span className="flex items-center gap-1 text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors">
                    Paciente
                    <SortIndicator col="nome" />
                  </span>
                </th>
                <th className="px-6 py-3.5 text-left hidden lg:table-cell">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    Contato
                  </span>
                </th>
                <th
                  onClick={() => handleSort('created_at')}
                  className="px-6 py-3.5 text-left cursor-pointer group"
                >
                  <span className="flex items-center gap-1 text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors">
                    Cadastrado em
                    <SortIndicator col="created_at" />
                  </span>
                </th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isSearchEmpty && (
                <tr>
                  <td colSpan={4} className="px-6 py-16">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Search className="w-8 h-8 text-text-secondary opacity-20" />
                      <p className="text-sm font-semibold text-text-primary">
                        Nenhum resultado para &ldquo;{q}&rdquo;
                      </p>
                      <p className="text-xs text-text-secondary">
                        Tente termos diferentes ou{' '}
                        <button
                          onClick={() => setInputValue('')}
                          className="text-teal font-semibold hover:underline"
                        >
                          limpe a busca
                        </button>
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {isDataEmpty && (
                <tr>
                  <td colSpan={4} className="py-16">
                    <div className="flex flex-col items-center justify-center text-center px-6">
                      <div className="w-14 h-14 rounded-2xl bg-teal/10 border border-teal/20
                                      flex items-center justify-center mb-5">
                        <Users className="w-6 h-6 text-teal" />
                      </div>
                      <p className="font-heading font-semibold text-xl text-text-primary mb-1">
                        Nenhum paciente ainda
                      </p>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {canCreate
                          ? 'Cadastre o primeiro paciente para começar.'
                          : 'Aguarde o cadastro pela recepção.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              <AnimatePresence initial={false}>
                {pacientesFiltrados.map((paciente, i) => {
                  const iniciais = paciente.nome
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const dataCadastro = format(
                    parseISO(paciente.created_at),
                    'dd/MM/yyyy',
                    { locale: ptBR },
                  );

                  return (
                    <motion.tr
                      key={paciente.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() =>
                        router.push(`/dashboard/pacientes/${paciente.id}`)
                      }
                      className="group hover:bg-surface-alt/60 transition-colors cursor-pointer
                                 border-l-2 border-transparent hover:border-l-teal/30"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center
                                       text-white font-bold text-xs shrink-0 ${cor}`}
                          >
                            {iniciais}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors">
                                {paciente.nome}
                              </span>
                              {paciente.followup_pendente && (
                                <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider bg-teal/10 text-teal px-1.5 py-0.5 rounded-full leading-none">
                                  follow-up
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-text-secondary mt-0.5">
                              {paciente.id.slice(0, 8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="space-y-1">
                          {paciente.telefone && (
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <span className="w-5 h-5 rounded-md bg-surface-alt flex items-center justify-center shrink-0">
                                <Phone className="w-3 h-3 text-teal" />
                              </span>
                              {paciente.telefone}
                            </div>
                          )}
                          {paciente.email && (
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <span className="w-5 h-5 rounded-md bg-surface-alt flex items-center justify-center shrink-0">
                                <Mail className="w-3 h-3 text-teal" />
                              </span>
                              {paciente.email}
                            </div>
                          )}
                          {!paciente.telefone && !paciente.email && (
                            <span className="text-xs text-text-secondary">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
                          <span className="w-5 h-5 rounded-md bg-surface-alt flex items-center justify-center shrink-0">
                            <Calendar className="w-3 h-3 text-teal" />
                          </span>
                          {dataCadastro}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-border group-hover:text-teal transition-colors ml-auto" />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Mobile card list — spec 9.9 */}
        <div className="md:hidden divide-y divide-border">
          {isSearchEmpty && (
            <div className="flex flex-col items-center gap-2 py-12 px-6 text-center">
              <Search className="w-8 h-8 text-text-secondary opacity-20" />
              <p className="text-sm font-semibold text-text-primary">
                Nenhum resultado para &ldquo;{q}&rdquo;
              </p>
              <button
                onClick={() => setInputValue('')}
                className="text-xs text-teal font-semibold hover:underline"
              >
                Limpar busca
              </button>
            </div>
          )}
          {isDataEmpty && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6">
              <div className="w-12 h-12 rounded-2xl bg-teal/10 border border-teal/20
                              flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-teal" />
              </div>
              <p className="font-heading font-semibold text-lg text-text-primary mb-1">
                Nenhum paciente ainda
              </p>
              <p className="text-xs text-text-secondary">
                {canCreate
                  ? 'Cadastre o primeiro paciente.'
                  : 'Aguarde o cadastro pela recepção.'}
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {pacientes.map((paciente, i) => {
              const iniciais = paciente.nome
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <motion.div
                  key={paciente.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() =>
                    router.push(`/dashboard/pacientes/${paciente.id}`)
                  }
                  className="flex items-center gap-3 p-4 hover:bg-surface-alt/60 transition-colors cursor-pointer group"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center
                               text-white font-bold text-xs shrink-0 ${cor}`}
                  >
                    {iniciais}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors truncate">
                      {paciente.nome}
                    </p>
                    <p className="text-xs text-text-secondary truncate mt-0.5">
                      {paciente.telefone ?? paciente.email ?? 'Sem contato'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-border group-hover:text-teal transition-colors shrink-0" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pagination footer — spec 9.4 */}
        {(totalPages > 1 || !isEmpty) && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border flex-wrap gap-3">
            <p className="text-xs text-text-secondary">
              {total > 0 ? (
                <>
                  <span className="font-mono font-semibold text-text-primary">
                    {rangeFrom}–{rangeTo}
                  </span>{' '}
                  de{' '}
                  <span className="font-mono font-semibold text-text-primary">
                    {total}
                  </span>{' '}
                  paciente{total !== 1 ? 's' : ''}
                  {q && ` encontrado${total !== 1 ? 's' : ''}`}
                </>
              ) : null}
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate({ page: page - 1 })}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {paginationPages.map((p, idx) =>
                  p === null ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-8 text-center text-xs text-text-secondary select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => navigate({ page: p })}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        p === page
                          ? 'bg-teal text-white'
                          : 'text-text-secondary hover:bg-surface-alt'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  onClick={() => navigate({ page: page + 1 })}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-alt
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
