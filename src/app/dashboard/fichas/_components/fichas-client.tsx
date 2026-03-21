'use client';

import { useState } from 'react';
import { FileText, Search, Calendar, Stethoscope, FileImage, Filter } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FichaRow } from '../page';

const TIPOS = ['Todas', 'Avaliação', 'Evolução', 'Retorno', 'Urgência', 'Procedimento'] as const;

const TYPE_ICON: Record<string, React.ElementType> = {
  Exame: FileImage,
  Avaliação: FileText,
  Evolução: Stethoscope,
};

export function FichasClient({ fichas }: { fichas: FichaRow[] }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todas');

  const filtered = fichas.filter((f) => {
    const nome = f.paciente?.nome ?? '';
    const queixa = f.queixa_principal ?? '';
    const matchesSearch =
      nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      queixa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.anotacoes ?? '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      activeFilter === 'Todas' || queixa.toLowerCase().includes(activeFilter.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  const counts: Record<string, number> = {
    Todas: fichas.length,
  };
  for (const tipo of TIPOS.slice(1)) {
    counts[tipo] = fichas.filter((f) =>
      (f.queixa_principal ?? '').toLowerCase().includes(tipo.toLowerCase())
    ).length;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="font-heading text-4xl text-foreground mb-2">Fichas Clínicas</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Histórico de evoluções e prontuários.
          </p>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 space-y-4"
        >
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm">
            <h3 className="font-heading text-lg mb-4 text-foreground flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal" /> Filtros Rápidos
            </h3>
            <div className="space-y-2">
              {TIPOS.map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setActiveFilter(tipo)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    activeFilter === tipo
                      ? 'bg-teal/10 text-teal'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tipo === 'Todas' ? 'Todas as Fichas' : tipo}</span>
                  <span className="font-mono text-[10px] bg-card border border-border/40 px-2 py-0.5 rounded-full">
                    {counts[tipo] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lista */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 space-y-4"
        >
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por paciente ou queixa..."
              className="w-full pl-11 pr-4 py-3 bg-card border border-border shadow-sm rounded-xl text-sm outline-none focus:border-teal transition-colors font-sans text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filtered.length === 0 && (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {searchTerm
                  ? 'Nenhuma ficha encontrada com esses termos.'
                  : 'Nenhuma ficha cadastrada ainda.'}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {filtered.map((ficha, i) => {
              const tipo = ficha.queixa_principal ?? 'Atendimento';
              const Icon = TYPE_ICON[tipo] ?? Stethoscope;
              const data = format(parseISO(ficha.created_at), "dd 'de' MMM 'de' yyyy", {
                locale: ptBR,
              });
              const nomeMedico = ficha.dentista?.nome ?? '—';
              const inicial = nomeMedico.split(' ')[1]?.[0] ?? nomeMedico[0] ?? '?';

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  key={ficha.id}
                  onClick={() => router.push(`/dashboard/pacientes/${ficha.paciente_id}`)}
                  className="bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-teal/10 group-hover:text-teal transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground group-hover:text-teal transition-colors">
                          {ficha.paciente?.nome ?? '—'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {ficha.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal">
                            {tipo}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                              ficha.status === 'aberta'
                                ? 'bg-teal/10 text-teal'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {ficha.status === 'aberta' ? 'Aberta' : 'Concluída'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded-md">
                      <Calendar className="w-3 h-3" />
                      {data}
                    </div>
                  </div>

                  {ficha.anotacoes && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 pl-13 line-clamp-2">
                      {ficha.anotacoes}
                    </p>
                  )}

                  <div className="pl-13 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-black flex items-center justify-center text-[8px] font-bold">
                      {inicial.toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{nomeMedico}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground font-medium px-1">
            Exibindo {filtered.length} de {fichas.length} ficha
            {fichas.length !== 1 ? 's' : ''}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
