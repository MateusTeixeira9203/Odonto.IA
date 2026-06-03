'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, FileText,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface FichaItem {
  data: string;
  queixa: string;
  anotacoes: string;
  dentes: number[];
}

interface OrcamentoItem {
  total: number;
  status: string;
  itens: string[];
}

interface EtapaItem {
  id: string;
  titulo: string;
  dente: string | null;
  descricao_simples: string | null;
  status: string;
  ordem: number;
}

interface Planejamento {
  id: string;
  titulo: string;
  etapas: EtapaItem[];
}

interface ConsultationSidebarProps {
  agendamentoId: string;
  pacienteNome: string;
  idadeStr: string | null;
  observacoes: string | null;
  observacoesAgendamento: string | null;
  ultimaQueixa: string | null;
  ultimasAnotacoes: string | null;
  fichas: FichaItem[];
  orcamentos: OrcamentoItem[];
  alertasClinicos: string[];
  planejamento: Planejamento | null;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConsultationSidebar({
  pacienteNome,
  idadeStr,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  alertasClinicos,
  planejamento,
}: ConsultationSidebarProps) {
  const [fichasExpanded, setFichasExpanded] = useState(false);

  return (
    <>
      <aside className="w-full md:w-64 shrink-0 border-b border-border md:border-b-0 md:border-r bg-surface overflow-y-auto flex flex-col max-h-64 md:max-h-none">

        {/* 1. Identificação */}
        <div className="p-5 border-b border-border">
          <div className="font-heading text-lg text-text-primary leading-tight">{pacienteNome}</div>
          {idadeStr && <div className="text-xs text-text-secondary mt-0.5">{idadeStr}</div>}
          {observacoesAgendamento && (
            <div className="mt-2 text-xs text-text-secondary italic">"{observacoesAgendamento}"</div>
          )}
        </div>

        {/* 2. Alertas clínicos */}
        {alertasClinicos.length > 0 && (
          <div className="p-4 border-b border-border" style={{ background: 'rgba(239,68,68,0.04)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-coral shrink-0" />
              <span className="text-[10px] font-bold text-coral uppercase tracking-widest">Alertas</span>
            </div>
            <div className="space-y-1">
              {alertasClinicos.map((a, i) => (
                <p key={i} className="text-xs text-coral leading-relaxed">{a}</p>
              ))}
            </div>
          </div>
        )}

        {/* 3. Progresso do tratamento */}
        {planejamento && (
          <div className="p-4 border-b border-border">
            <span className="text-[10px] font-bold text-teal uppercase tracking-widest block mb-2">
              Tratamento ativo
            </span>
            <p className="text-xs font-semibold text-text-primary mb-3 leading-tight">{planejamento.titulo}</p>

            {/* Barra de progresso */}
            {(() => {
              const total = planejamento.etapas.length;
              const concluidas = planejamento.etapas.filter(e => e.status === 'concluido').length;
              const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
              return (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-text-secondary">{concluidas}/{total} etapas</span>
                    <span className="text-[10px] font-bold text-teal">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Lista de etapas com marcação HOJE */}
            <div className="space-y-1.5">
              {planejamento.etapas.slice(0, 6).map((etapa, idx) => {
                const isPrimeiraPendente = etapa.status !== 'concluido' &&
                  planejamento.etapas.slice(0, idx).every(e => e.status === 'concluido');
                return (
                  <div key={etapa.id} className={`flex items-center gap-2 ${isPrimeiraPendente ? 'bg-teal/5 rounded-lg px-2 py-1 -mx-2' : ''}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      etapa.status === 'concluido' ? 'bg-teal' :
                      isPrimeiraPendente ? 'bg-teal animate-pulse' :
                      'bg-border'
                    }`} />
                    <span className={`text-[11px] leading-tight flex-1 ${
                      etapa.status === 'concluido' ? 'line-through text-text-secondary' :
                      isPrimeiraPendente ? 'text-teal font-semibold' :
                      'text-text-primary'
                    }`}>
                      {etapa.titulo}{etapa.dente ? ` — ${etapa.dente}` : ''}
                    </span>
                    {isPrimeiraPendente && (
                      <span className="text-[9px] font-black text-teal uppercase tracking-wide shrink-0">HOJE</span>
                    )}
                  </div>
                );
              })}
              {planejamento.etapas.length > 6 && (
                <p className="text-[10px] text-text-secondary ml-3.5">+{planejamento.etapas.length - 6} etapas</p>
              )}
            </div>
          </div>
        )}

        {/* 4. Última visita */}
        {(ultimaQueixa || ultimasAnotacoes || (fichas[0]?.dentes?.length ?? 0) > 0) && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                Última visita{fichas[0]?.data ? ` · ${fichas[0].data}` : ''}
              </span>
            </div>
            {ultimaQueixa && (
              <p className="text-xs font-semibold text-text-primary mb-1 leading-tight">{ultimaQueixa}</p>
            )}
            {ultimasAnotacoes && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{ultimasAnotacoes}</p>
            )}
            {(fichas[0]?.dentes?.length ?? 0) > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {fichas[0].dentes.map(d => (
                  <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-alt border border-border text-text-secondary">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Histórico colapsado */}
        {fichas.length > 1 && (
          <div className="p-4">
            <button onClick={() => setFichasExpanded(v => !v)} className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-text-secondary" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                  Histórico ({fichas.length - 1} anteriores)
                </span>
              </div>
              {fichasExpanded
                ? <ChevronUp className="w-3 h-3 text-text-secondary" />
                : <ChevronDown className="w-3 h-3 text-text-secondary" />
              }
            </button>
            <AnimatePresence>
              {fichasExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    {fichas.slice(1).map((f, i) => (
                      <div key={i} className="bg-surface-alt rounded-xl p-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-mono text-text-secondary">{f.data}</span>
                          {f.dentes.length > 0 && (
                            <span className="text-[10px] font-mono text-teal">{f.dentes.join(', ')}</span>
                          )}
                        </div>
                        {f.queixa && <p className="text-[11px] font-semibold text-text-primary">{f.queixa}</p>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </aside>
    </>
  );
}
