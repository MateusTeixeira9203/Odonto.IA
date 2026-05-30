'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Calendar, Users, Wallet, Plus, Loader2,
  User, ArrowRight, Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Recent patients persistence (localStorage) ───────────────────────────────

const RECENT_KEY = 'odontoia_recentes_pacientes';

export function saveRecentPatient(patient: { id: string; nome: string }) {
  if (typeof window === 'undefined') return;
  try {
    const stored: { id: string; nome: string; ts: number }[] =
      JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    const updated = [
      { id: patient.id, nome: patient.nome, ts: Date.now() },
      ...stored.filter(p => p.id !== patient.id),
    ].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function loadRecentPatients(): { id: string; nome: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as { id: string; nome: string; ts: number }[])
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map(({ id, nome }) => ({ id, nome }));
  } catch { return []; }
}

type CommandGroup = 'navigate' | 'action' | 'patient';

type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  sub?: string;
  icon: React.ElementType;
  action: () => void;
};

interface Props {
  open: boolean;
  onClose: () => void;
  clinicaId: string;
}

const GROUP_LABEL: Record<CommandGroup, string> = {
  patient:  'Pacientes',
  action:   'Ações',
  navigate: 'Navegar',
};

export function CommandPalette({ open, onClose, clinicaId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [patients, setPatients] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [recentPatients, setRecentPatients] = useState<{ id: string; nome: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setPatients([]);
      // Carrega recentes do localStorage ao abrir
      setRecentPatients(loadRecentPatients());
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Patient search — debounced 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (query.length < 2) {
      setPatients([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const supabase = createClient();
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, telefone')
        .eq('clinica_id', clinicaId)
        .ilike('nome', `%${query}%`)
        .limit(6)
        .abortSignal(controller.signal);
      if (!controller.signal.aborted) {
        setPatients(data ?? []);
        setSearching(false);
      }
    }, 300);
  }, [query, clinicaId]);

  const navigate = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  const staticItems: CommandItem[] = [
    {
      id: 'novo-agendamento',
      group: 'action',
      label: 'Novo Agendamento',
      sub: 'Abrir agenda e criar consulta',
      icon: Plus,
      action: () => navigate('/dashboard/agendamentos?novo=1'),
    },
    {
      id: 'novo-paciente',
      group: 'action',
      label: 'Novo Paciente',
      sub: 'Cadastrar paciente',
      icon: User,
      action: () => navigate('/dashboard/pacientes/novo'),
    },
    {
      id: 'agenda',
      group: 'navigate',
      label: 'Agenda',
      sub: 'Ver agendamentos do dia',
      icon: Calendar,
      action: () => navigate('/dashboard/agendamentos'),
    },
    {
      id: 'pacientes',
      group: 'navigate',
      label: 'Pacientes',
      sub: 'Buscar e gerenciar pacientes',
      icon: Users,
      action: () => navigate('/dashboard/pacientes'),
    },
    {
      id: 'financeiro',
      group: 'navigate',
      label: 'Financeiro',
      sub: 'Fluxo de caixa e despesas',
      icon: Wallet,
      action: () => navigate('/dashboard/financeiro'),
    },
  ];

  const filteredStatic = query.length < 2
    ? staticItems
    : staticItems.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.sub?.toLowerCase().includes(query.toLowerCase()) ?? false)
      );

  const patientItems: CommandItem[] = patients.map(p => ({
    id: `patient-${p.id}`,
    group: 'patient' as const,
    label: p.nome,
    sub: p.telefone ?? 'Ver ficha do paciente',
    icon: User,
    action: () => {
      saveRecentPatient({ id: p.id, nome: p.nome });
      navigate(`/dashboard/pacientes/${p.id}`);
    },
  }));

  const recentItems: CommandItem[] = recentPatients.map(r => ({
    id: `recent-${r.id}`,
    group: 'patient' as const,
    label: r.nome,
    sub: 'Acesso recente',
    icon: Clock,
    action: () => navigate(`/dashboard/pacientes/${r.id}`),
  }));

  // Flat list for keyboard navigation
  const allItems = query.length >= 2
    ? [...patientItems, ...filteredStatic]
    : [...recentItems, ...filteredStatic];

  const total = allItems.length;

  // Keyboard navigation within palette
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, total - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        allItems[selectedIdx]?.action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedIdx, allItems, total]);

  // Reset selection on results change
  useEffect(() => { setSelectedIdx(0); }, [query, patients.length]);

  // Group static items for display
  const actionItems = filteredStatic.filter(i => i.group === 'action');
  const navigateItems = filteredStatic.filter(i => i.group === 'navigate');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.18, type: 'spring', damping: 22, stiffness: 320 }}
            className="fixed top-[18vh] left-1/2 -translate-x-1/2 z-[61] w-full max-w-[520px] px-4"
          >
            <div className="bg-surface rounded-2xl border border-border shadow-[0_24px_80px_-12px_rgba(0,0,0,0.4)] overflow-hidden">

              {/* Search bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                {searching
                  ? <Loader2 className="w-4 h-4 text-teal animate-spin shrink-0" />
                  : <Search className="w-4 h-4 text-text-secondary shrink-0" />
                }
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar paciente, página ou ação..."
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-secondary text-sm outline-none"
                />
                <kbd className="hidden sm:flex text-[10px] font-mono text-text-secondary border border-border rounded px-1.5 py-0.5 leading-none">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[340px] overflow-y-auto py-1.5">
                {allItems.length === 0 && !searching && query.length >= 2 && (
                  <div className="px-4 py-8 text-center text-sm text-text-secondary">
                    Nenhum resultado para <span className="font-semibold text-text-primary">"{query}"</span>
                  </div>
                )}

                {/* Recentes (quando sem busca ativa) */}
                {query.length < 2 && recentItems.length > 0 && (
                  <SectionGroup label="Recentes">
                    {recentItems.map((cmd, i) => (
                      <CmdRow
                        key={cmd.id}
                        cmd={cmd}
                        selected={i === selectedIdx}
                        onExecute={cmd.action}
                        onHover={() => setSelectedIdx(i)}
                      />
                    ))}
                  </SectionGroup>
                )}

                {/* Patients (resultados de busca) */}
                {query.length >= 2 && patientItems.length > 0 && (
                  <SectionGroup label={GROUP_LABEL.patient}>
                    {patientItems.map((cmd, i) => (
                      <CmdRow
                        key={cmd.id}
                        cmd={cmd}
                        selected={i === selectedIdx}
                        onExecute={cmd.action}
                        onHover={() => setSelectedIdx(i)}
                      />
                    ))}
                  </SectionGroup>
                )}

                {/* Actions */}
                {actionItems.length > 0 && (
                  <SectionGroup label={query.length < 2 ? GROUP_LABEL.action : undefined}>
                    {actionItems.map((cmd) => {
                      const idx = allItems.indexOf(cmd);
                      return (
                        <CmdRow
                          key={cmd.id}
                          cmd={cmd}
                          selected={idx === selectedIdx}
                          onExecute={cmd.action}
                          onHover={() => setSelectedIdx(idx)}
                        />
                      );
                    })}
                  </SectionGroup>
                )}

                {/* Navigate */}
                {navigateItems.length > 0 && (
                  <SectionGroup label={query.length < 2 ? GROUP_LABEL.navigate : undefined}>
                    {navigateItems.map((cmd) => {
                      const idx = allItems.indexOf(cmd);
                      return (
                        <CmdRow
                          key={cmd.id}
                          cmd={cmd}
                          selected={idx === selectedIdx}
                          onExecute={cmd.action}
                          onHover={() => setSelectedIdx(idx)}
                        />
                      );
                    })}
                  </SectionGroup>
                )}
              </div>

              {/* Footer hints */}
              <div className="flex items-center gap-5 px-4 py-2.5 border-t border-border bg-surface-alt/40">
                <KbdHint keys={['↑', '↓']} label="navegar" />
                <KbdHint keys={['↵']} label="abrir" />
                <KbdHint keys={['esc']} label="fechar" />
                <span className="ml-auto text-[10px] text-text-secondary/50">⌘K</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary/60">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

function CmdRow({ cmd, selected, onExecute, onHover }: {
  cmd: CommandItem;
  selected: boolean;
  onExecute: () => void;
  onHover: () => void;
}) {
  const Icon = cmd.icon;
  return (
    <button
      onClick={onExecute}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        selected ? 'bg-teal/8' : 'hover:bg-surface-alt'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        selected ? 'bg-teal/15 text-teal' : 'bg-surface-alt text-text-secondary'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold transition-colors ${selected ? 'text-teal' : 'text-text-primary'}`}>
          {cmd.label}
        </p>
        {cmd.sub && (
          <p className="text-[11px] text-text-secondary truncate">{cmd.sub}</p>
        )}
      </div>
      <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${
        selected ? 'text-teal opacity-100' : 'opacity-0'
      }`} />
    </button>
  );
}

function KbdHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-text-secondary">
      {keys.map(k => (
        <kbd key={k} className="border border-border rounded px-1 py-0.5 font-mono leading-none text-[10px]">{k}</kbd>
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  );
}
