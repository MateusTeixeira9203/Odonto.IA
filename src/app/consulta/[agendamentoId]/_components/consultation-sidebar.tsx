'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, History, Pill,
  StickyNote, Clock, Activity,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface FichaItem {
  data: string;
  queixa: string;
  anotacoes: string;
  dentes: number[];
  procedimentos: string[];
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getIniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Separa alertas por tipo para exibição visual diferenciada
function parseAlertas(alertas: string[]) {
  const alergias: string[] = [];
  const medicamentos: string[] = [];
  const historico: string[] = [];
  for (const a of alertas) {
    if (a.startsWith('⚠️ Alergia:')) alergias.push(a.replace('⚠️ Alergia:', '').trim());
    else if (a.startsWith('💊 Medicamentos:')) medicamentos.push(a.replace('💊 Medicamentos:', '').trim());
    else if (a.startsWith('🏥 Histórico:')) historico.push(a.replace('🏥 Histórico:', '').trim());
  }
  return { alergias, medicamentos, historico };
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SidebarSection({
  children,
  accent = 'teal',
}: {
  children: React.ReactNode;
  accent?: 'red' | 'amber' | 'teal' | 'neutral';
}) {
  const borderColors: Record<string, string> = {
    red:     'rgba(239,68,68,0.50)',
    amber:   'rgba(245,158,11,0.50)',
    teal:    'rgba(47,156,133,0.40)',
    neutral: 'rgba(0,0,0,0.08)',
  };
  return (
    <div
      className="mx-3 mt-2.5 rounded-xl p-3 border border-border/40 bg-surface-alt/30 border-l-2"
      style={{ borderLeftColor: borderColors[accent] }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
  color = 'text-text-secondary',
}: {
  icon: React.ElementType;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon className={`w-3 h-3 shrink-0 ${color}`} />
      <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${color}`}>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConsultationSidebar({
  pacienteNome,
  idadeStr,
  observacoes,
  observacoesAgendamento,
  ultimaQueixa,
  ultimasAnotacoes,
  fichas,
  alertasClinicos,
  planejamento,
}: ConsultationSidebarProps) {
  const [fichasExpanded, setFichasExpanded] = useState(false);

  const iniciais = getIniciais(pacienteNome);
  const { alergias, medicamentos, historico } = parseAlertas(alertasClinicos);
  const temAlertas = alertasClinicos.length > 0;

  // Progresso do tratamento (a ficha É o tratamento e evolui)
  const etapas = planejamento?.etapas ?? [];
  const etapasFalta = etapas.filter(e => e.status !== 'concluido');
  const etapasFeito = etapas.filter(e => e.status === 'concluido');
  const totalEtapas = etapas.length;
  const progresso = totalEtapas > 0 ? Math.round((etapasFeito.length / totalEtapas) * 100) : 0;
  const temPlanejamento = totalEtapas > 0;

  const temUltimaVisita =
    !!(ultimaQueixa || ultimasAnotacoes ||
      (fichas[0]?.dentes?.length ?? 0) > 0 ||
      (fichas[0]?.procedimentos?.length ?? 0) > 0);

  return (
    <aside className="w-full md:w-[360px] shrink-0 border-b border-border md:border-b-0 md:border-r bg-surface overflow-y-auto flex flex-col max-h-[320px] md:max-h-none">

      {/* ── 1. Identificação ─────────────────────────────────────────── */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold select-none shrink-0 relative"
            style={{
              background: temAlertas ? 'rgba(239,68,68,0.12)' : 'rgba(47,156,133,0.12)',
              color: temAlertas ? '#ef4444' : '#2f9c85',
              boxShadow: `0 0 0 2px ${temAlertas ? 'rgba(239,68,68,0.20)' : 'rgba(47,156,133,0.18)'}`,
            }}
          >
            {iniciais}
            {temAlertas && (
              <span
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-surface flex items-center justify-center"
                style={{ background: '#ef4444' }}
              >
                <AlertTriangle className="w-2 h-2 text-white" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-sm text-text-primary leading-tight truncate">
              {pacienteNome}
            </p>
            {idadeStr && (
              <p className="text-[11px] text-text-secondary mt-0.5">{idadeStr}</p>
            )}
          </div>
        </div>

        {/* Observação do agendamento */}
        {observacoesAgendamento && (
          <div
            className="mt-2.5 rounded-lg px-2.5 py-2 text-xs text-text-secondary italic leading-relaxed border-l-2"
            style={{
              background: 'rgba(47,156,133,0.05)',
              borderLeftColor: 'rgba(47,156,133,0.30)',
            }}
          >
            &quot;{observacoesAgendamento}&quot;
          </div>
        )}

        {/* Observações do perfil do paciente */}
        {observacoes && (
          <div
            className="mt-2 rounded-lg px-2.5 py-2 text-[11px] text-text-secondary leading-relaxed border border-border/40 flex items-start gap-1.5"
            style={{ background: 'rgba(0,0,0,0.02)' }}
          >
            <StickyNote className="w-3 h-3 shrink-0 mt-0.5 text-text-secondary/50" />
            <span className="italic">{observacoes}</span>
          </div>
        )}
      </div>

      {/* ── 2. Alertas clínicos ───────────────────────────────────────── */}
      {temAlertas && (
        <SidebarSection accent="red">
          <SectionTitle icon={AlertTriangle} label="Alertas clínicos" color="text-red-500 dark:text-red-400" />
          <div className="space-y-2">
            {alergias.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/70 mb-1">Alergias</p>
                <div className="flex flex-wrap gap-1">
                  {alergias.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                      style={{
                        background: 'rgba(239,68,68,0.10)',
                        borderColor: 'rgba(239,68,68,0.25)',
                        color: '#ef4444',
                      }}
                    >
                      ⚠️ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {medicamentos.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary/50 mb-1">Medicamentos</p>
                {medicamentos.map((m, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Pill className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-text-secondary leading-relaxed">{m}</p>
                  </div>
                ))}
              </div>
            )}
            {historico.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary/50 mb-1">Histórico médico</p>
                {historico.map((h, i) => (
                  <p key={i} className="text-[11px] text-text-secondary leading-relaxed">{h}</p>
                ))}
              </div>
            )}
          </div>
        </SidebarSection>
      )}

      {/* ── 3. Progresso do tratamento ────────────────────────────────── */}
      <SidebarSection accent="teal">
        <SectionTitle icon={Activity} label="Tratamento" color="text-teal/70" />
        {temPlanejamento ? (
          <>
            {/* Barra de progresso */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 rounded-full bg-border/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: '#2f9c85' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progresso}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[10px] font-bold font-mono text-teal shrink-0">
                {etapasFeito.length}/{totalEtapas}
              </span>
            </div>

            {/* Falta */}
            {etapasFalta.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600/70 dark:text-amber-400/70 mb-1.5">Falta</p>
                <div className="space-y-1.5">
                  {etapasFalta.slice(0, 4).map((etapa, idx) => {
                    const isPrimeira = idx === 0;
                    return (
                      <div key={etapa.id} className="flex items-center gap-2">
                        {isPrimeira ? (
                          <motion.div
                            className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                            style={{ borderColor: '#f59e0b' }}
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                          />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-border/50 shrink-0" />
                        )}
                        <span className={`text-xs leading-tight flex-1 ${
                          isPrimeira ? 'font-semibold text-text-primary' : 'text-text-secondary'
                        }`}>
                          {etapa.titulo}{etapa.dente ? ` · ${etapa.dente}` : ''}
                        </span>
                        {isPrimeira && (
                          <span
                            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                          >
                            HOJE
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {etapasFalta.length > 4 && (
                    <p className="text-[10px] text-text-secondary/50 pl-5">
                      +{etapasFalta.length - 4} restantes
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Feito */}
            {etapasFeito.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary/50 mb-1.5">Feito</p>
                <div className="space-y-1">
                  {etapasFeito.slice(0, 4).map(etapa => (
                    <div key={etapa.id} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal shrink-0" />
                      <span className="text-xs leading-tight flex-1 line-through text-text-secondary/70">
                        {etapa.titulo}{etapa.dente ? ` · ${etapa.dente}` : ''}
                      </span>
                    </div>
                  ))}
                  {etapasFeito.length > 4 && (
                    <p className="text-[10px] text-text-secondary/50 pl-5">
                      +{etapasFeito.length - 4} concluídas
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-text-secondary/60 italic">Tratamento ainda não iniciado.</p>
        )}
      </SidebarSection>

      {/* ── 4. Última visita ──────────────────────────────────────────── */}
      {temUltimaVisita && (
        <SidebarSection accent="teal">
          <SectionTitle
            icon={Clock}
            label={`Última visita${fichas[0]?.data ? ` · ${fichas[0].data}` : ''}`}
            color="text-teal/70"
          />

          {/* Queixa principal */}
          {ultimaQueixa && (
            <p className="text-sm font-semibold text-text-primary mb-2 leading-snug">{ultimaQueixa}</p>
          )}

          {/* Procedimentos realizados */}
          {(fichas[0]?.procedimentos?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {fichas[0].procedimentos.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border"
                  style={{
                    background: 'rgba(47,156,133,0.08)',
                    borderColor: 'rgba(47,156,133,0.22)',
                    color: '#2f9c85',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Anotações */}
          {ultimasAnotacoes && (
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-4 mb-2">
              {ultimasAnotacoes}
            </p>
          )}

          {/* Chips de dentes */}
          {(fichas[0]?.dentes?.length ?? 0) > 0 && (
            <div className="flex gap-1 flex-wrap">
              {fichas[0].dentes.map(d => (
                <span
                  key={d}
                  className="inline-flex items-center justify-center w-7 h-6 rounded-md text-[10px] font-bold font-mono border"
                  style={{
                    background: 'rgba(47,156,133,0.07)',
                    borderColor: 'rgba(47,156,133,0.20)',
                    color: '#2f9c85',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </SidebarSection>
      )}

      {/* ── 5. Histórico colapsado ────────────────────────────────────── */}
      {fichas.length > 1 && (
        <div className="mx-3 mt-2.5 mb-3 rounded-xl border border-border/40 overflow-hidden">
          <button
            onClick={() => setFichasExpanded(v => !v)}
            className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-surface-alt/50 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <History className="w-3 h-3 text-text-secondary/40" />
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-text-secondary/40">
                Histórico · {fichas.length - 1} anterior{fichas.length - 1 > 1 ? 'es' : ''}
              </span>
            </div>
            {fichasExpanded
              ? <ChevronUp className="w-3 h-3 text-text-secondary/30" />
              : <ChevronDown className="w-3 h-3 text-text-secondary/30" />
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
                <div className="px-3 pb-3 space-y-2 border-t border-border/40">
                  {fichas.slice(1).map((f, i) => (
                    <div key={i} className="bg-surface rounded-lg border border-border/30 p-2.5 mt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-mono text-text-secondary/50">{f.data}</span>
                        {f.dentes.length > 0 && (
                          <span className="text-[10px] font-mono text-teal/60">{f.dentes.join(', ')}</span>
                        )}
                      </div>
                      {f.queixa && (
                        <p className="text-[11px] font-semibold text-text-primary leading-tight mb-1.5">{f.queixa}</p>
                      )}
                      {f.procedimentos.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {f.procedimentos.map((p, j) => (
                            <span
                              key={j}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border"
                              style={{
                                background: 'rgba(47,156,133,0.06)',
                                borderColor: 'rgba(47,156,133,0.15)',
                                color: '#2f9c85',
                              }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Espaço inferior quando não há histórico */}
      {fichas.length <= 1 && <div className="pb-3" />}
    </aside>
  );
}
