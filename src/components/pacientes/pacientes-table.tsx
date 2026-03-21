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

const AVATAR_COLORS = [
  'bg-teal',
  'bg-zinc-800',
  'bg-zinc-600',
  'bg-zinc-700',
  'bg-teal',
  'bg-zinc-500',
];

export function PacientesTable({ pacientes }: { pacientes: PacienteRow[] }) {
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
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              className="w-full pl-10 pr-4 py-2.5 bg-muted border-none rounded-xl text-sm focus:ring-2 focus:ring-teal/20 transition-all text-foreground placeholder:text-muted-foreground/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl text-xs font-bold text-foreground hover:bg-accent transition-colors border border-border/40">
              <Filter className="w-3.5 h-3.5" />
              Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl text-xs font-bold text-foreground hover:bg-accent transition-colors border border-border/40">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                  Paciente
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] hidden md:table-cell">
                  Contato
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] hidden lg:table-cell">
                  Cadastrado em
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    {searchTerm ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => router.push(`/dashboard/pacientes/${paciente.id}`)}
                    className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm ${cor}`}
                        >
                          {iniciais}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground group-hover:text-teal transition-colors">
                            {paciente.nome}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            {paciente.id.slice(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="space-y-1">
                        {paciente.telefone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {paciente.telefone}
                          </div>
                        )}
                        {paciente.email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" /> {paciente.email}
                          </div>
                        )}
                        {!paciente.telefone && !paciente.email && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" /> {dataCadastro}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-teal transition-colors" />
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-2">
        <div>
          Exibindo {filtered.length} de {pacientes.length} paciente
          {pacientes.length !== 1 ? 's' : ''}
        </div>
      </div>
    </>
  );
}
