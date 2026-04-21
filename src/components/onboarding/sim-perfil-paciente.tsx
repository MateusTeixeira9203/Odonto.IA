'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Image as ImageIcon, CircleDollarSign, Mic, Sparkles, User, Phone, Calendar, Stethoscope, Presentation } from 'lucide-react';

// ── Typing hook ───────────────────────────────────────────────────────────────
function useTypingText(text: string, startDelay: number, speed = 40): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      let i = 0;
      interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [text, startDelay, speed]);
  return displayed;
}

// ── Tab IDs ───────────────────────────────────────────────────────────────────
type TabId = 'fichas' | 'documentos' | 'planejamento' | 'orcamentos';

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'fichas',       label: 'Fichas Clínicas', icon: FileText          },
  { id: 'documentos',   label: 'Documentos',       icon: ImageIcon         },
  { id: 'planejamento', label: 'Planejamento',      icon: Presentation      },
  { id: 'orcamentos',   label: 'Orçamentos',        icon: CircleDollarSign  },
];

// ── Orçamento items ───────────────────────────────────────────────────────────
const ORC_ITEMS = [
  { descricao: 'Restauração — Dente 46', valor: 320 },
  { descricao: 'Limpeza (Profilaxia)',    valor: 150 },
  { descricao: 'Raio-X Periapical',       valor: 80  },
];
const ORC_TOTAL = ORC_ITEMS.reduce((s, i) => s + i.valor, 0);

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ── Document mockups ──────────────────────────────────────────────────────────
const DOCS = [
  { label: 'Raio-X Periapical', date: 'hoje',          color: '#e0f2fe', icon: '🦷', border: '#bae6fd' },
  { label: 'Foto Clínica',       date: '15/04',         color: '#f0fdf4', icon: '📷', border: '#bbf7d0' },
  { label: 'Ficha em PDF',       date: '10/04',         color: '#fef9c3', icon: '📄', border: '#fef08a' },
  { label: 'Foto Inicial',       date: '28/03',         color: '#fce7f3', icon: '📷', border: '#f9a8d4' },
];

// ── Main component ────────────────────────────────────────────────────────────

const EVOLUCAO = 'Paciente relata dor ao mastigar no lado direito. Verificado desgaste em dente 46 com necessidade de restauração. Solicitado raio-x periapical.';

// Timeline
// 0ms       : perfil header + tab "fichas" ativo
// 400ms     : evolução começa a ser digitada
// typing    : ~5.5s (EVOLUCAO.length * 40ms + 400ms)
// TYPING_END+200  : dente 46 badge aparece
// TYPING_END+1400 : tab "documentos" clicada
// TYPING_END+2200 : grid de docs aparece
// TYPING_END+4000 : tab "planejamento" clicada
// TYPING_END+4600 : spinner de geração IA aparece
// TYPING_END+6000 : seção 1 aparece
// TYPING_END+7200 : seção 2 aparece
// TYPING_END+8600 : tab "orcamentos" clicada
// TYPING_END+9400 : itens aparecem um por um
// TYPING_END+12000: total + badge IA
// TYPING_END+13500: fecha

interface SimPerfilPacienteProps { onComplete?: () => void }

export function SimPerfilPaciente({ onComplete }: SimPerfilPacienteProps) {
  const [visible,        setVisible]        = useState(true);
  const [activeTab,      setActiveTab]      = useState<TabId>('fichas');
  const [showTooth,      setShowTooth]      = useState(false);
  const [showGenBtn,     setShowGenBtn]     = useState(false);
  const [showDocs,       setShowDocs]       = useState(false);
  const [visibleSections,setVisibleSections] = useState(0);
  const [visibleOrc,     setVisibleOrc]     = useState(0);
  const [showTotal,      setShowTotal]      = useState(false);
  const [showAI,         setShowAI]         = useState(false);
  const [tabPulse,       setTabPulse]       = useState<TabId | null>(null);

  const evolucao = useTypingText(EVOLUCAO, 400, 42);

  const TYPING_END = 400 + EVOLUCAO.length * 42;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      // Ficha tab — tooth badge
      setTimeout(() => setShowTooth(true),  TYPING_END + 200),

      // Fichas — dente 46 → botão gerar orçamento
      setTimeout(() => setShowGenBtn(true),                                   TYPING_END + 1400),

      // Switch to Documentos
      setTimeout(() => setTabPulse('documentos'),                             TYPING_END + 2800),
      setTimeout(() => { setActiveTab('documentos'); setTabPulse(null); },    TYPING_END + 3100),
      setTimeout(() => setShowDocs(true),                                     TYPING_END + 3600),

      // Switch to Planejamento (só visual)
      setTimeout(() => setTabPulse('planejamento'),                           TYPING_END + 5400),
      setTimeout(() => { setActiveTab('planejamento'); setTabPulse(null); },  TYPING_END + 5700),
      setTimeout(() => setVisibleSections(1),                                 TYPING_END + 6000),
      setTimeout(() => setVisibleSections(2),                                 TYPING_END + 7000),

      // Switch to Orçamentos (gerado a partir da ficha)
      setTimeout(() => setTabPulse('orcamentos'),                             TYPING_END + 8400),
      setTimeout(() => { setActiveTab('orcamentos'); setTabPulse(null); },    TYPING_END + 8700),
      setTimeout(() => setVisibleOrc(1),                                      TYPING_END + 9300),
      setTimeout(() => setVisibleOrc(2),                                      TYPING_END + 10100),
      setTimeout(() => setVisibleOrc(3),                                      TYPING_END + 10800),
      setTimeout(() => setShowTotal(true),                                    TYPING_END + 11600),
      setTimeout(() => setShowAI(true),                                       TYPING_END + 12600),

      // Close
      setTimeout(() => { setVisible(false); onComplete?.(); },                TYPING_END + 14200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete, TYPING_END]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ width: 520, maxWidth: '90%', border: '1px solid #e5e7eb' }}
            initial={{ opacity: 0, y: 28, scale: 0.93 }}
            animate={{ opacity: 1, y: 0,  scale: 1   }}
            exit={{   opacity: 0, y: -14, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
          >
            {/* ── Patient Profile Header ── */}
            <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg,#f0fdf9 0%,#fff 100%)', borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)' }}>
                  AS
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-base leading-none">Ana Souza</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(47,156,133,0.1)', color: '#2f9c85' }}>Paciente ativo</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400"><User className="w-3 h-3" /> 28 anos</span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400"><Phone className="w-3 h-3" /> (11) 99999-9999</span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400"><Calendar className="w-3 h-3" /> Última visita: hoje</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="flex px-5 pt-3 pb-0 gap-1" style={{ borderBottom: '1px solid #f3f4f6' }}>
              {TABS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                const isPulsing = tabPulse === id;
                return (
                  <motion.button
                    key={id}
                    animate={isPulsing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-lg transition-all relative"
                    style={isActive
                      ? { color: '#2f9c85', background: 'rgba(47,156,133,0.06)', borderBottom: '2px solid #2f9c85' }
                      : { color: '#9ca3af', borderBottom: '2px solid transparent' }
                    }
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                    {/* Pulsing dot when tab is about to be clicked */}
                    {isPulsing && (
                      <motion.span
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                        style={{ background: '#2f9c85' }}
                        animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                        transition={{ duration: 0.5, repeat: 2 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* ── Tab content ── */}
            <div className="p-4 min-h-[220px]">
              <AnimatePresence mode="wait">

                {/* FICHAS tab */}
                {activeTab === 'fichas' && (
                  <motion.div key="fichas"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22 }}
                  >
                    {/* Recording chip */}
                    <div className="flex items-center gap-2 mb-3">
                      <motion.div
                        animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Gravando
                      </motion.div>
                      <span className="text-[10px] text-gray-400">Evolução clínica · hoje</span>
                    </div>

                    {/* Evolução typed */}
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 mb-3">
                      <div className="flex items-start gap-2">
                        <Mic className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: '#2f9c85' }} />
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {evolucao}
                          <span className="animate-pulse opacity-60">|</span>
                        </p>
                      </div>
                    </div>

                    {/* Tooth badge */}
                    <AnimatePresence>
                      {showTooth && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.88 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', damping: 18 }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2.5"
                          style={{ background: 'rgba(47,156,133,0.07)', border: '1px solid rgba(47,156,133,0.2)' }}
                        >
                          <motion.div
                            animate={{ boxShadow: ['0 0 0 0 rgba(47,156,133,0.5)', '0 0 0 8px rgba(47,156,133,0)', '0 0 0 0 rgba(47,156,133,0)'] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-white shrink-0"
                            style={{ background: '#2f9c85' }}
                          >
                            46
                          </motion.div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: '#2f9c85' }}>Dente 46 identificado pela IA</p>
                            <p className="text-[10px] text-gray-400">Restauração necessária · marcado no odontograma</p>
                          </div>
                          <Stethoscope className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: '#2f9c85' }} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Botão gerar orçamento — gerado a partir da ficha */}
                    <AnimatePresence>
                      {showGenBtn && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.93 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', damping: 18 }}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white cursor-default"
                          style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)', boxShadow: '0 6px 20px -4px rgba(47,156,133,0.45)' }}
                        >
                          <Sparkles className="w-4 h-4" />
                          Gerar Orçamento com IA
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* DOCUMENTOS tab */}
                {activeTab === 'documentos' && (
                  <motion.div key="documentos"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Arquivos do Paciente</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {DOCS.map((doc, i) => (
                        <AnimatePresence key={doc.label}>
                          {showDocs && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.88, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ delay: i * 0.12, type: 'spring', damping: 20, stiffness: 220 }}
                              className="rounded-xl p-3 flex flex-col gap-2"
                              style={{ background: doc.color, border: `1px solid ${doc.border}` }}
                            >
                              <span className="text-2xl">{doc.icon}</span>
                              <div>
                                <p className="text-[11px] font-semibold text-gray-700 leading-snug">{doc.label}</p>
                                <p className="text-[10px] text-gray-400">{doc.date}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* PLANEJAMENTO tab */}
                {activeTab === 'planejamento' && (
                  <motion.div key="planejamento"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Plano de Tratamento</p>

                    {/* Seções visuais do planejamento */}
                    <div className="space-y-2.5">
                      {[
                        {
                          title: '1. Restauração Dente 46',
                          content: 'Realizar restauração em resina composta no dente 46 com desgaste oclusal identificado. Sessão única estimada de 60 min.',
                        },
                        {
                          title: '2. Profilaxia e Orientação',
                          content: 'Limpeza profissional e instrução de higiene oral. Indicado retorno em 6 meses para manutenção preventiva.',
                        },
                      ].slice(0, visibleSections).map((sec, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                          className="rounded-xl p-3.5"
                          style={{ background: 'rgba(47,156,133,0.05)', border: '1px solid rgba(47,156,133,0.18)' }}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <Presentation className="w-3 h-3 shrink-0" style={{ color: '#2f9c85' }} />
                            <p className="text-[11px] font-bold" style={{ color: '#2f9c85' }}>{sec.title}</p>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{sec.content}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ORÇAMENTOS tab */}
                {activeTab === 'orcamentos' && (
                  <motion.div key="orcamentos"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Orçamentos</p>
                      <motion.div
                        animate={{ scale: [1, 1.04, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)' }}
                      >
                        <Sparkles className="w-2.5 h-2.5" /> Gerar com IA
                      </motion.div>
                    </div>

                    {/* Items */}
                    <div className="space-y-1.5 mb-3">
                      {ORC_ITEMS.slice(0, visibleOrc).map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -14 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                          style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
                        >
                          <span className="text-xs text-gray-700">{item.descricao}</span>
                          <span className="text-xs font-semibold font-mono" style={{ color: '#2f9c85' }}>{fmt(item.valor)}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Total */}
                    <AnimatePresence>
                      {showTotal && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-2.5"
                          style={{ background: 'rgba(47,156,133,0.06)', border: '1.5px solid rgba(47,156,133,0.2)' }}
                        >
                          <span className="text-sm font-bold text-gray-900">Total</span>
                          <span className="text-base font-mono font-bold" style={{ color: '#2f9c85' }}>{fmt(ORC_TOTAL)}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* AI badge */}
                    <AnimatePresence>
                      {showAI && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: 'spring', damping: 18 }}
                          className="flex items-center gap-2 justify-center py-2.5 rounded-xl font-bold text-sm text-white"
                          style={{ background: 'linear-gradient(135deg,#2f9c85 0%,#1e7a67 100%)', boxShadow: '0 6px 20px -4px rgba(47,156,133,0.5)' }}
                        >
                          <Sparkles className="w-4 h-4" />
                          Enviar orçamento pelo WhatsApp
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
