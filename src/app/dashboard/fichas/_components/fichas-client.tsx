'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  FileText,
  Plus,
  ClipboardList,
  Stethoscope,
  ScanLine,
  LayoutList,
} from 'lucide-react';
import { motion } from 'motion/react';

// ── Tipo ─────────────────────────────────────────────────────────────────────
export type FichaComPaciente = {
  id: string;
  status: 'aberta' | 'concluida';
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  paciente_id: string;
  dentista_id: string;
  paciente: { id: string; nome: string } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
type TipoFicha = 'Avaliação' | 'Evolução' | 'Exame' | 'Geral';

function derivarTipo(queixaPrincipal: string | null): TipoFicha {
  if (!queixaPrincipal) return 'Geral';
  const q = queixaPrincipal.toLowerCase();
  if (q.includes('avalia')) return 'Avaliação';
  if (q.includes('retorno') || q.includes('procedimento') || q.includes('rotina') || q.includes('urgên') || q.includes('urgenc')) return 'Evolução';
  if (q.includes('exame') || q.includes('radiogra') || q.includes('imagem')) return 'Exame';
  return 'Geral';
}

const TIPO_BADGE: Record<TipoFicha, { label: string; className: string }> = {
  'Avaliação': { label: 'Avaliação', className: 'bg-teal/10 text-teal' },
  'Evolução': { label: 'Evolução', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  'Exame': { label: 'Exame', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  'Geral': { label: 'Consulta', className: 'bg-surface-alt text-text-secondary' },
};

const AVATAR_COLORS = [
  'bg-teal text-white',
  'bg-teal-lt text-white',
  'bg-teal-dark text-white',
  'bg-teal/70 text-white',
];

function getAvatarColor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ── Filtros ───────────────────────────────────────────────────────────────────
type FiltroTipo = 'todas' | 'avaliacao' | 'evolucao' | 'exame';
type FiltroStatus = 'todos' | 'aberta' | 'concluida';

// ── Componente ────────────────────────────────────────────────────────────────
interface Props {
  fichas: FichaComPaciente[];
}

export function FichasClient({ fichas }: Props): React.JSX.Element {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');

  const fichasFiltradas = fichas.filter((ficha) => {
    if (busca) {
      const nome = ficha.paciente?.nome.toLowerCase() ?? '';
      if (!nome.includes(busca.toLowerCase())) return false;
    }
    if (filtroTipo !== 'todas') {
      const tipo = derivarTipo(ficha.queixa_principal);
      const map: Record<FiltroTipo, TipoFicha> = { todas: 'Geral', avaliacao: 'Avaliação', evolucao: 'Evolução', exame: 'Exame' };
      if (tipo !== map[filtroTipo]) return false;
    }
    if (filtroStatus !== 'todos' && ficha.status !== filtroStatus) return false;
    return true;
  });

  const counts = {
    todas: fichas.length,
    avaliacao: fichas.filter((f) => derivarTipo(f.queixa_principal) === 'Avaliação').length,
    evolucao: fichas.filter((f) => derivarTipo(f.queixa_principal) === 'Evolução').length,
    exame: fichas.filter((f) => derivarTipo(f.queixa_principal) === 'Exame').length,
    abertas: fichas.filter((f) => f.status === 'aberta').length,
    concluidas: fichas.filter((f) => f.status === 'concluida').length,
  };

  const filtrosTipo: { id: FiltroTipo; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'todas', label: 'Todas', icon: LayoutList, count: counts.todas },
    { id: 'avaliacao', label: 'Avaliações', icon: Stethoscope, count: counts.avaliacao },
    { id: 'evolucao', label: 'Evoluções', icon: ClipboardList, count: counts.evolucao },
    { id: 'exame', label: 'Exames / Imagens', icon: ScanLine, count: counts.exame },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-7xl mx-auto w-full"
    >
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-serif text-4xl text-text-primary mb-2">Fichas Clínicas</h1>
          <p className="text-text-secondary text-sm font-medium">
            {fichas.length} ficha{fichas.length !== 1 ? 's' : ''} registrada{fichas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/fichas/nova"
          className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-teal-dark transition-all shadow-lg self-start md:self-center premium-shadow"
        >
          <Plus className="w-4 h-4" />
          Nova Ficha
        </Link>
      </header>

      <div className="flex gap-6">
        {/* Sidebar de filtros */}
        <aside className="w-52 shrink-0 space-y-5">
          <div className="space-y-1">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary px-2 mb-2">Tipo</p>
            {filtrosTipo.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltroTipo(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filtroTipo === id ? 'bg-teal/10 text-teal' : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                <span className={`font-mono text-xs shrink-0 ${filtroTipo === id ? 'text-teal' : 'text-text-muted'}`}>{count}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1 border-t border-border pt-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary px-2 mb-2">Status</p>
            {([
              { id: 'todos', label: 'Todos', count: fichas.length },
              { id: 'aberta', label: 'Em aberto', count: counts.abertas },
              { id: 'concluida', label: 'Concluídas', count: counts.concluidas },
            ] as { id: FiltroStatus; label: string; count: number }[]).map(({ id, label, count }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltroStatus(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filtroStatus === id ? 'bg-teal/10 text-teal' : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
                }`}
              >
                <span className="flex-1 text-left">{label}</span>
                <span className={`font-mono text-xs shrink-0 ${filtroStatus === id ? 'text-teal' : 'text-text-muted'}`}>{count}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar por nome do paciente…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-surface-alt border border-border rounded-xl font-sans text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/40 transition-all"
            />
          </div>

          {fichasFiltradas.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-3 py-16">
              <FileText className="w-10 h-10 text-text-muted" />
              <div className="text-center">
                <p className="font-serif text-base text-text-primary">
                  {busca || filtroTipo !== 'todas' || filtroStatus !== 'todos' ? 'Nenhuma ficha encontrada' : 'Nenhuma ficha ainda'}
                </p>
                <p className="font-sans text-sm text-text-secondary mt-1">
                  {busca || filtroTipo !== 'todas' || filtroStatus !== 'todos' ? 'Tente outros filtros' : 'Crie a primeira ficha para registrar atendimentos'}
                </p>
              </div>
              {!busca && filtroTipo === 'todas' && filtroStatus === 'todos' && (
                <Link href="/dashboard/fichas/nova" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white">
                  <Plus className="w-4 h-4" /> Nova Ficha
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {fichasFiltradas.map((ficha) => {
                const pacienteNome = ficha.paciente?.nome ?? 'Paciente';
                const tipo = derivarTipo(ficha.queixa_principal);
                const tipoBadge = TIPO_BADGE[tipo];
                const avatarColor = getAvatarColor(pacienteNome);
                const iniciais = getIniciais(pacienteNome);
                const fichaIdCurto = ficha.id.split('-')[0].toUpperCase();

                return (
                  <button
                    key={ficha.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/pacientes/${ficha.paciente?.id ?? ficha.paciente_id}?tab=fichas`)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-surface-alt/60 transition-colors text-left group"
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 font-mono text-xs font-bold ${avatarColor}`}>
                      {iniciais}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-sans text-sm font-semibold text-text-primary">{pacienteNome}</p>
                        <span className="font-mono text-[0.6rem] text-text-secondary border border-border rounded px-1.5 py-0.5">#{fichaIdCurto}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium uppercase tracking-wide ${tipoBadge.className}`}>
                          {tipoBadge.label}
                        </span>
                      </div>
                      {(ficha.queixa_principal || ficha.anotacoes) && (
                        <p className="font-sans text-xs text-text-secondary mt-0.5 line-clamp-1">{ficha.queixa_principal ?? ficha.anotacoes}</p>
                      )}
                      <p className="font-mono text-[0.65rem] text-text-muted mt-1">
                        {format(new Date(ficha.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        ficha.status === 'aberta'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                          : 'bg-teal-pale text-teal-dark border-teal/20'
                      }`}>
                        {ficha.status === 'aberta' ? 'Aberta' : 'Concluída'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {fichasFiltradas.length > 0 && (
            <p className="text-right font-mono text-xs text-text-muted">{fichasFiltradas.length} de {fichas.length}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
