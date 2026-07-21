'use client';

import * as React from 'react';
import { CheckSquare, Square, Clock, Loader2, Clipboard, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'motion/react';
import { DexLoader } from '@/components/ui/dex-loader';

type ProcedimentoItem = {
  fichaId: string;
  fichaDate: string;
  queixa: string;
  tooth: number;
  noteIndex: number;
  descricao: string;
  key: string;
};

type FichaResumida = {
  id: string;
  data_atendimento: string;
  queixa_principal: string | null;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  procedimentos_concluidos: string[];
};

interface PendenciasTabProps {
  patientId: string;
  clinicaId: string;
}

export function PendenciasTab({ patientId, clinicaId }: PendenciasTabProps) {
  const [items, setItems] = React.useState<ProcedimentoItem[]>([]);
  const [concluidos, setConcluidos] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);

  const fetchPendencias = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fichas')
        .select('id, data_atendimento, queixa_principal, dentes_afetados, dentes_observacoes, procedimentos_concluidos')
        .eq('paciente_id', patientId)
        .eq('clinica_id', clinicaId)
        .order('data_atendimento', { ascending: false });

      if (error) throw error;

      const fichas = (data as unknown as FichaResumida[]) ?? [];
      const allItems: ProcedimentoItem[] = [];
      const allConcluidos = new Set<string>();

      for (const ficha of fichas) {
        const done = ficha.procedimentos_concluidos ?? [];
        done.forEach((k) => allConcluidos.add(`${ficha.id}::${k}`));

        for (const tooth of ficha.dentes_afetados ?? []) {
          const raw = ficha.dentes_observacoes?.[String(tooth)] ?? '';
          const parts = raw.split('\n').filter(Boolean);
          parts.forEach((note, i) => {
            allItems.push({
              fichaId: ficha.id,
              fichaDate: ficha.data_atendimento,
              queixa: ficha.queixa_principal ?? 'Evolução',
              tooth,
              noteIndex: i,
              descricao: note,
              key: `${tooth}_${i}`,
            });
          });
        }
      }

      setItems(allItems);
      setConcluidos(allConcluidos);
    } catch (err) {
      console.error('Erro ao buscar pendências:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId, clinicaId]);

  React.useEffect(() => {
    void fetchPendencias();
  }, [fetchPendencias]);

  const handleToggle = async (item: ProcedimentoItem): Promise<void> => {
    const globalKey = `${item.fichaId}::${item.key}`;
    const isDone = concluidos.has(globalKey);
    setTogglingKey(globalKey);

    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('fichas')
        .select('procedimentos_concluidos')
        .eq('id', item.fichaId)
        .single();

      const current: string[] = (data as { procedimentos_concluidos: string[] } | null)?.procedimentos_concluidos ?? [];
      const newConcluidos = isDone
        ? current.filter((k) => k !== item.key)
        : [...current, item.key];

      const { error } = await supabase
        .from('fichas')
        .update({ procedimentos_concluidos: newConcluidos })
        .eq('id', item.fichaId)
        .eq('clinica_id', clinicaId);

      if (!error) {
        setConcluidos((prev) => {
          const next = new Set(prev);
          if (isDone) next.delete(globalKey);
          else next.add(globalKey);
          return next;
        });
      }
    } catch (err) {
      console.error('Erro ao atualizar procedimento:', err);
    } finally {
      setTogglingKey(null);
    }
  };

  if (isLoading) {
    return (
      <DexLoader className="py-20" />
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <Clipboard className="w-10 h-10 text-text-secondary/30 mx-auto mb-3" />
        <p className="text-text-secondary text-sm">
          Nenhum procedimento registrado nas fichas ainda.
        </p>
        <p className="text-text-secondary text-xs mt-1">
          Adicione dentes e procedimentos nas fichas clínicas para acompanhar aqui.
        </p>
      </div>
    );
  }

  const pendentes = items.filter((p) => !concluidos.has(`${p.fichaId}::${p.key}`));
  const realizados = items.filter((p) => concluidos.has(`${p.fichaId}::${p.key}`));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 text-center">
          <p className="text-2xl font-bold text-amber-600 font-mono">{pendentes.length}</p>
          <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Pendente{pendentes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 font-mono">{realizados.length}</p>
          <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider">Realizado{realizados.length !== 1 ? 's' : ''}</p>
        </div>
        {items.length > 0 && (
          <div className="ml-auto bg-surface-alt rounded-xl px-4 py-3 text-center border border-border/40">
            <p className="text-sm font-bold text-text-primary font-mono">
              {Math.round((realizados.length / items.length) * 100)}%
            </p>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Progresso</p>
          </div>
        )}
      </div>

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-bold text-sm text-text-primary">Pendentes</h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {pendentes.length}
            </span>
          </div>
          <AnimatePresence>
            {pendentes.map((item) => (
              <ProcedimentoRow
                key={`${item.fichaId}_${item.key}`}
                item={item}
                done={false}
                loading={togglingKey === `${item.fichaId}::${item.key}`}
                onToggle={() => void handleToggle(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Realizados */}
      {realizados.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-bold text-sm text-text-secondary">Realizados</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {realizados.length}
            </span>
          </div>
          <AnimatePresence>
            {realizados.map((item) => (
              <ProcedimentoRow
                key={`${item.fichaId}_${item.key}`}
                item={item}
                done={true}
                loading={togglingKey === `${item.fichaId}::${item.key}`}
                onToggle={() => void handleToggle(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ProcedimentoRow({
  item,
  done,
  loading,
  onToggle,
}: {
  item: ProcedimentoItem;
  done: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  // data_atendimento é 'YYYY-MM-DD' — formata na mão (não via `new Date()`, que
  // parseia como UTC meia-noite e desloca um dia pra trás em fusos negativos).
  const [anoF, mesF, diaF] = item.fichaDate.split('-');
  const date = `${diaF}/${mesF}/${anoF}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-alt/50 transition-colors border-b border-border/20 last:border-b-0"
    >
      <button
        onClick={onToggle}
        disabled={loading}
        className="shrink-0 transition-transform hover:scale-110"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-teal" />
        ) : done ? (
          <CheckSquare className="w-4 h-4 text-emerald-500" />
        ) : (
          <Square className="w-4 h-4 text-text-secondary hover:text-teal transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${done ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
          {item.descricao}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="font-mono text-[10px] font-bold text-teal">D{item.tooth}</span>
          <span className="text-[10px] text-text-secondary truncate max-w-[180px]">{item.queixa}</span>
          <span className="flex items-center gap-1 text-[10px] text-text-secondary shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {date}
          </span>
        </div>
      </div>

      {done && (
        <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="w-3 h-3 text-emerald-500" />
        </div>
      )}
    </motion.div>
  );
}
