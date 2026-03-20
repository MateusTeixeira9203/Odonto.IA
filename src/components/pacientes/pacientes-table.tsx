'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, UserPlus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/dentai';
import type { Paciente } from '@/types/database';

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-teal text-white',
  'bg-teal-lt text-white',
  'bg-teal-dark text-white',
  'bg-teal/70 text-white',
];

function getAvatarColor(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// ── Status derivado ───────────────────────────────────────────────────────────
function derivarStatus(paciente: Paciente): { label: string; className: string } {
  const diasDesdeCreation = (Date.now() - new Date(paciente.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (diasDesdeCreation < 7) {
    return { label: 'Novo', className: 'bg-teal/10 text-teal' };
  }
  return { label: 'Ativo', className: 'bg-teal-pale text-teal-dark' };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PacientesTableProps {
  pacientes: Paciente[];
}

export function PacientesTable({ pacientes }: PacientesTableProps): React.JSX.Element {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);

  const pacientesFiltrados = pacientes.filter((p) => {
    const termo = busca.toLowerCase();
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.cpf ?? '').toLowerCase().includes(termo) ||
      (p.telefone ?? '').toLowerCase().includes(termo)
    );
  });

  function abrirDialogNovaFicha(paciente: Paciente): void {
    setPacienteSelecionado(paciente);
    setDialogAberto(true);
  }

  function confirmarNovaFicha(): void {
    if (!pacienteSelecionado) return;
    setDialogAberto(false);
    router.push(`/dashboard/fichas/nova?paciente_id=${pacienteSelecionado.id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Busca */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
        />
        <input
          type="search"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-sm h-10 pl-9 pr-3 bg-surface-alt rounded-xl font-sans text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-teal/40 transition-all border border-border"
        />
      </div>

      {/* Tabela */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-alt/50">
              <th className="text-left px-5 py-3.5 font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary">
                Paciente
              </th>
              <th className="text-left px-5 py-3.5 font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary hidden sm:table-cell">
                Status
              </th>
              <th className="text-left px-5 py-3.5 font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary hidden md:table-cell">
                Telefone
              </th>
              <th className="text-left px-5 py-3.5 font-mono text-[0.6rem] uppercase tracking-widest text-text-secondary hidden lg:table-cell">
                Último atendimento
              </th>
              <th className="w-10 px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {pacientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-56 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Users size={40} className="text-text-muted" />
                    <div className="space-y-1">
                      <p className="font-serif text-base text-text-primary">
                        {busca ? 'Nenhum paciente encontrado' : 'Nenhum paciente ainda'}
                      </p>
                      <p className="font-sans text-sm text-text-secondary">
                        {busca
                          ? 'Tente buscar por outro nome, CPF ou telefone'
                          : 'Cadastre seu primeiro paciente para começar'}
                      </p>
                    </div>
                    {!busca && (
                      <Link href="/dashboard/pacientes/novo">
                        <Button variant="primary" size="sm">
                          <UserPlus className="size-3.5" />
                          Cadastrar paciente
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pacientesFiltrados.map((paciente) => {
                const status = derivarStatus(paciente);
                return (
                  <tr
                    key={paciente.id}
                    onClick={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
                    className="border-b border-border last:border-b-0 hover:bg-surface-alt/60 transition-colors cursor-pointer group"
                  >
                    {/* Paciente — avatar + nome */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold ${getAvatarColor(paciente.nome)}`}>
                          {getIniciais(paciente.nome)}
                        </div>
                        <div>
                          <p className="font-sans text-sm font-semibold text-text-primary leading-tight">
                            {paciente.nome}
                          </p>
                          {paciente.cpf && (
                            <p className="font-mono text-xs text-text-secondary mt-0.5">
                              {paciente.cpf}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>

                    {/* Telefone */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {paciente.telefone ? (
                        <span className="font-mono text-sm text-text-secondary">{paciente.telefone}</span>
                      ) : (
                        <span className="text-text-muted text-sm">—</span>
                      )}
                    </td>

                    {/* Último atendimento */}
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="font-mono text-sm text-text-secondary">
                        {format(new Date(paciente.updated_at), 'dd/MM/yyyy')}
                      </span>
                    </td>

                    {/* Seta */}
                    <td className="px-5 py-3.5">
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-teal transition-colors" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Rodapé com contagem */}
        {pacientesFiltrados.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-surface-alt/30 flex items-center justify-between">
            <p className="font-mono text-xs text-text-secondary">
              {pacientesFiltrados.length} de {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''}
            </p>
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="font-mono text-xs text-teal hover:text-teal-dark transition-colors"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialog de confirmação Nova Ficha */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nova Ficha</DialogTitle>
            <DialogDescription>
              Criar uma nova ficha para{' '}
              <strong>{pacienteSelecionado?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarNovaFicha}>
              Criar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
