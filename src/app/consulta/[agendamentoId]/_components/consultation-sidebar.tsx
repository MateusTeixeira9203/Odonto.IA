'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock, FileText, CreditCard, Bot, Sparkles, Loader2,
  ChevronDown, ChevronUp, AlertTriangle, Activity, HelpCircle,
  ClipboardList, Copy, Check, X,
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

interface BriefingData {
  resumo: string;
  alertas: string[];
  pendencias: string[];
  historico_relevante: string[];
  perguntas_sugeridas: string[];
  tratamento_ativo: string | null;
  pacienteNome: string;
  hora: string;
  cached: boolean;
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

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionsSection({ perguntas }: { perguntas: string[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="pt-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-widest hover:text-text-primary transition-colors"
      >
        <HelpCircle className="w-3 h-3" />
        Perguntas sugeridas
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {perguntas.map((p, i) => (
                <p key={i} className="text-[11px] text-text-secondary leading-relaxed pl-3 border-l-2 border-border">
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExplicarDialog({
  planejamento,
  pacienteNome,
  onClose,
}: {
  planejamento: Planejamento;
  pacienteNome: string;
  onClose: () => void;
}) {
  const [explicacao, setExplicacao] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const etapas = planejamento.etapas
      .filter(e => e.status !== 'concluido')
      .slice(0, 5)
      .map(e => `${e.titulo}${e.dente ? ` (dente ${e.dente})` : ''}`);

    fetch('/api/dex/explicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        procedimento: planejamento.titulo,
        etapas,
        pacienteNome,
      }),
    })
      .then(r => r.json() as Promise<{ explicacao?: string; error?: string }>)
      .then(d => { if (!cancelled) setExplicacao(d.explicacao ?? null); })
      .catch(() => { if (!cancelled) setExplicacao(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [planejamento, pacienteNome]);

  const handleCopy = async () => {
    if (!explicacao) return;
    await navigator.clipboard.writeText(explicacao);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Explicação para {pacienteNome}</p>
              <p className="text-[10px] text-text-secondary truncate max-w-[200px]">{planejamento.titulo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-teal" />
            Gerando explicação...
          </div>
        ) : explicacao ? (
          <div>
            <p className="text-sm text-text-secondary leading-relaxed">{explicacao}</p>
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => void handleCopy()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-teal hover:bg-teal-dark transition-all"
              >
                {copied
                  ? <><Check className="w-4 h-4" /> Copiado!</>
                  : <><Copy className="w-4 h-4" /> Copiar texto</>
                }
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary italic py-4 text-center">Não foi possível gerar a explicação.</p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConsultationSidebar({
  agendamentoId,
  pacienteNome,
  idadeStr,
  observacoes,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  orcamentos,
  alertasClinicos,
  planejamento,
}: ConsultationSidebarProps) {
  const [fichasExpanded, setFichasExpanded] = useState(false);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [showExplicar, setShowExplicar] = useState(false);

  // Fix: useEffect para evitar side-effect no render + cleanup para prevenir state update pós-unmount
  useEffect(() => {
    let cancelled = false;
    setBriefingLoading(true);

    fetch(`/api/dex/briefing?agendamentoId=${agendamentoId}`)
      .then(r => r.json() as Promise<BriefingData & { error?: string }>)
      .then(d => { if (!cancelled && !d.error) setBriefing(d); })
      .catch(() => { if (!cancelled) setBriefing(null); })
      .finally(() => { if (!cancelled) setBriefingLoading(false); });

    return () => { cancelled = true; };
  }, [agendamentoId]);

  return (
    <>
      <aside className="w-full md:w-72 lg:w-80 shrink-0 border-b border-border md:border-b-0 md:border-r bg-surface overflow-y-auto flex flex-col max-h-64 md:max-h-none">

        {/* Patient name */}
        <div className="p-5 border-b border-border">
          <div className="font-heading text-xl text-text-primary mb-0.5">{pacienteNome}</div>
          {idadeStr && <div className="text-xs text-text-secondary font-medium">{idadeStr}</div>}
        </div>

        {/* Clinical alerts (from fichas — alergias/medicamentos) */}
        {alertasClinicos.length > 0 && (
          <div className="p-4 border-b border-border bg-coral/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-coral shrink-0" />
              <span className="text-[10px] font-bold text-coral uppercase tracking-widest">Alertas Clínicos</span>
            </div>
            <div className="space-y-1">
              {alertasClinicos.map((alerta, i) => (
                <p key={i} className="text-xs text-coral leading-relaxed">{alerta}</p>
              ))}
            </div>
          </div>
        )}

        {/* DEX Briefing — structured */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: '#2f9c85' }}>
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] font-bold text-teal uppercase tracking-widest flex items-center gap-1.5">
              Briefing DEX
              {!briefingLoading && briefing && <Sparkles className="w-3 h-3" />}
              {!briefingLoading && briefing?.cached && (
                <span className="text-[9px] font-normal text-text-secondary normal-case tracking-normal">• cache</span>
              )}
            </span>
          </div>

          {briefingLoading ? (
            <div className="space-y-2">
              <div className="h-3 rounded-md bg-surface-alt animate-pulse" />
              <div className="h-3 rounded-md bg-surface-alt animate-pulse w-4/5" />
              <div className="h-3 rounded-md bg-surface-alt animate-pulse w-3/5" />
            </div>
          ) : briefing ? (
            <div className="space-y-3">

              {/* Resumo */}
              {briefing.resumo && (
                <p className="text-xs text-text-secondary leading-relaxed">{briefing.resumo}</p>
              )}

              {/* Alertas IA */}
              {briefing.alertas.length > 0 && (
                <div className="space-y-1.5">
                  {briefing.alertas.map((alerta, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-coral shrink-0 mt-0.5" />
                      <span className="text-[11px] text-coral leading-tight">{alerta}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pendências */}
              {briefing.pendencias.length > 0 && (
                <div className="space-y-1.5">
                  {briefing.pendencias.map((p, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <ClipboardList className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-text-secondary leading-tight">{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tratamento ativo (do briefing) */}
              {briefing.tratamento_ativo && (
                <div className="rounded-lg px-2.5 py-1.5 bg-teal-pale">
                  <span className="text-[11px] text-teal font-medium">{briefing.tratamento_ativo}</span>
                </div>
              )}

              {/* Perguntas sugeridas */}
              {briefing.perguntas_sugeridas.length > 0 && (
                <QuestionsSection perguntas={briefing.perguntas_sugeridas} />
              )}
            </div>
          ) : (
            <p className="text-xs text-text-secondary italic">Não foi possível gerar o briefing.</p>
          )}
        </div>

        {/* Motivo do agendamento */}
        {observacoesAgendamento && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Motivo</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{observacoesAgendamento}</p>
          </div>
        )}

        {/* Última consulta */}
        {(ultimaQueixa || ultimasAnotacoes) && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Última consulta</span>
            </div>
            {ultimaQueixa && <p className="text-xs font-semibold text-text-primary mb-1">{ultimaQueixa}</p>}
            {ultimasAnotacoes && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">{ultimasAnotacoes}</p>
            )}
          </div>
        )}

        {/* Observações do paciente */}
        {observacoes && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Observações</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{observacoes}</p>
          </div>
        )}

        {/* Planejamento ativo + botão Explicar */}
        {planejamento && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tratamento Ativo</span>
              </div>
              <button
                onClick={() => setShowExplicar(true)}
                className="flex items-center gap-1 text-[10px] font-semibold text-teal hover:opacity-80 transition-opacity"
                title="Gerar explicação para o paciente"
              >
                <Bot className="w-3 h-3" />
                Explicar
              </button>
            </div>
            <p className="text-xs font-semibold text-text-primary mb-2 truncate">{planejamento.titulo}</p>
            <div className="space-y-1.5">
              {planejamento.etapas.slice(0, 5).map(etapa => (
                <div key={etapa.id} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    etapa.status === 'concluido' ? 'bg-teal' :
                    etapa.status === 'pendente'  ? 'bg-amber-400' :
                    'bg-border'
                  }`} />
                  <span className={`text-[11px] leading-tight ${
                    etapa.status === 'concluido' ? 'line-through text-text-secondary' : 'text-text-primary'
                  }`}>
                    {etapa.titulo}{etapa.dente ? ` — ${etapa.dente}` : ''}
                  </span>
                </div>
              ))}
              {planejamento.etapas.length > 5 && (
                <p className="text-[10px] text-text-secondary ml-3.5">+{planejamento.etapas.length - 5} etapas</p>
              )}
            </div>
          </div>
        )}

        {/* Histórico de fichas */}
        <div className="p-4 border-b border-border">
          <button onClick={() => setFichasExpanded(v => !v)} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                Histórico ({fichas.length})
              </span>
            </div>
            {fichasExpanded
              ? <ChevronUp className="w-3.5 h-3.5 text-text-secondary" />
              : <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
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
                <div className="mt-3 space-y-3">
                  {fichas.length === 0 && (
                    <p className="text-xs text-text-secondary italic">Nenhuma consulta anterior.</p>
                  )}
                  {fichas.map((f, i) => (
                    <div key={i} className="bg-surface-alt rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-text-secondary">{f.data}</span>
                        {f.dentes.length > 0 && (
                          <span className="text-[10px] font-mono text-teal">{f.dentes.join(', ')}</span>
                        )}
                      </div>
                      {f.queixa && <p className="text-xs font-semibold text-text-primary mb-0.5">{f.queixa}</p>}
                      {f.anotacoes && (
                        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{f.anotacoes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Orçamentos */}
        {orcamentos.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-3.5 h-3.5 text-text-secondary" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Orçamentos</span>
            </div>
            <div className="space-y-2">
              {orcamentos.map((o, i) => (
                <div key={i} className="bg-surface-alt rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      R$ {o.total.toFixed(2).replace('.', ',')}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      o.status === 'aprovado'
                        ? 'bg-teal-pale text-teal'
                        : 'bg-surface-alt text-text-secondary border border-border'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                  {o.itens.length > 0 && (
                    <p className="text-xs text-text-secondary line-clamp-2">{o.itens.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Explicar ao paciente — dialog overlay */}
      <AnimatePresence>
        {showExplicar && planejamento && (
          <ExplicarDialog
            planejamento={planejamento}
            pacienteNome={pacienteNome}
            onClose={() => setShowExplicar(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
