'use client';

import { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
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
};

// Paleta de avatar: teal + tons neutros refinados
const AVATAR_COLORS = [
  'bg-teal',
  'bg-teal/70',
  'bg-teal-lt',
  'bg-teal-dark',
  'bg-teal-sym',
  'bg-teal/50',
];

export function PacientesTable({ pacientes, canCreate }: { pacientes: PacienteRow[]; canCreate: boolean }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = pacientes.filter(
    (p) =>
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.telefone ?? '').includes(searchTerm)
  );

  return (
    <>
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        {/* Barra de busca e filtros */}
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-alt/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all text-text-primary placeholder:text-text-secondary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-surface rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors border border-border">
              <Filter className="w-3.5 h-3.5" />
              Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-surface rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors border border-border">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-alt/40 border-b border-border">
                <th className="px-6 py-3.5 text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                  Paciente
                </th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] hidden md:table-cell">
                  Contato
                </th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] hidden lg:table-cell">
                  Cadastrado em
                </th>
                <th className="px-6 py-3.5 text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <Users className="w-10 h-10 text-border mx-auto mb-3" />
                    <p className="text-text-secondary text-sm font-medium">
                      {searchTerm ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}
                    </p>
                    {!searchTerm && (
                      <p className="text-text-secondary text-xs mt-1">
                        {canCreate
                          ? 'Clique em \u201cNovo Paciente\u201d para começar.'
                          : 'Aguarde o cadastro pela recepção.'}
                      </p>
                    )}
                  </td>
                </tr>
              )}
              {filtered.map((paciente, i) => {
                const iniciais = paciente.nome
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                const cor = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const dataCadastro = format(parseISO(paciente.created_at), 'dd/MM/yyyy', {
                  locale: ptBR,
                });

                return (
                  <motion.tr
                    key={paciente.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
                    className="group hover:bg-surface-alt/60 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 ${cor}`}
                        >
                          {iniciais}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-text-primary group-hover:text-teal transition-colors">
                            {paciente.nome}
                          </div>
                          <div className="font-mono text-[10px] text-text-secondary mt-0.5">
                            {paciente.id.slice(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {paciente.telefone && (
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Phone className="w-3 h-3 text-teal" /> {paciente.telefone}
                          </div>
                        )}
                        {paciente.email && (
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Mail className="w-3 h-3 text-teal" /> {paciente.email}
                          </div>
                        )}
                        {!paciente.telefone && !paciente.email && (
                          <span className="text-xs text-text-secondary">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-xs text-text-secondary font-mono">
                        <Calendar className="w-3.5 h-3.5 text-teal shrink-0" /> {dataCadastro}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-border group-hover:text-teal transition-colors" />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary font-mono px-2">
        <div>
          {filtered.length} de {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''}
        </div>
      </div>
    </>
  );
}
