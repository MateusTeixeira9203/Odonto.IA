'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Bot, MessageSquare, Zap, CalendarCheck } from 'lucide-react';

type Tab = 'Identidade' | 'Saudações' | 'Respostas';

interface Bubble { text: string; side: 'left' | 'right'; delay: number }

const BUBBLES: Bubble[] = [
  { text: 'Oi',                                                  side: 'right', delay: 800  },
  { text: 'Olá! Seja bem-vindo à *Clínica Sorriso*! 😊\nSou o *DEX*, assistente virtual.', side: 'left',  delay: 1600 },
  { text: '🦷 Agendar Consulta',                                 side: 'left',  delay: 2600 },
  { text: 'Agendar Consulta',                                    side: 'right', delay: 3400 },
  { text: 'Perfeito! Qual dentista você prefere?\n\n1. Dr. Carlos\n2. Dra. Ana',            side: 'left',  delay: 4200 },
  { text: '1',                                                   side: 'right', delay: 5200 },
  { text: '✅ *Agendamento confirmado pelo DEX!*\n\n🦷 Dentista: *Dr. Carlos*\n📅 Data: *quarta, 23/04 às 14h00*', side: 'left', delay: 6000 },
];

const TABS: Array<{ id: Tab; icon: typeof Bot }> = [
  { id: 'Identidade', icon: Bot },
  { id: 'Saudações',  icon: MessageSquare },
  { id: 'Respostas',  icon: CalendarCheck },
];

function waBold(text: string): React.ReactNode[] {
  return text.split(/\*([^*]+)\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

function ChatBubble({ text, side }: { text: string; side: 'left' | 'right' }) {
  const isButton = side === 'left' && text.startsWith('🦷');
  if (isButton) {
    return (
      <div className="flex justify-center my-0.5">
        <div className="w-[85%] px-2 py-1.5 rounded-[8px] bg-white border border-[#25d366]/40 text-[9px] text-[#128c7e] font-bold text-center shadow-sm">
          {text.replace('🦷 ', '')}
        </div>
      </div>
    );
  }
  const lines = text.split('\n');
  return (
    <div className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'} mb-0.5`}>
      <div className={`max-w-[88%] px-2 py-1 text-[9px] leading-snug shadow-sm ${
        side === 'right'
          ? 'bg-[#dcf8c6] text-gray-800 rounded-[8px] rounded-tr-[2px]'
          : 'bg-white text-gray-800 rounded-[8px] rounded-tl-[2px]'
      }`}>
        {lines.map((line, i, arr) => (
          <span key={i}>{waBold(line)}{i < arr.length - 1 && <br />}</span>
        ))}
      </div>
    </div>
  );
}

export function SimBot() {
  const [visibleBubbles, setVisibleBubbles] = useState<number>(0);
  const [activeTab,      setActiveTab]      = useState<Tab>('Saudações');

  useEffect(() => {
    const timers = BUBBLES.map((b, i) =>
      setTimeout(() => setVisibleBubbles(v => Math.max(v, i + 1)), b.delay)
    );
    // cycle tabs to show them all
    const t1 = setTimeout(() => setActiveTab('Identidade'), 200);
    const t2 = setTimeout(() => setActiveTab('Saudações'),  1200);
    const t3 = setTimeout(() => setActiveTab('Respostas'),  6500);
    return () => { timers.forEach(clearTimeout); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <motion.div
      className="w-full max-w-[640px] mx-auto px-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', damping: 22, stiffness: 180 }}
    >
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#2f9c85]/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-[#2f9c85]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Bot WhatsApp</p>
            <p className="text-white/40 text-[10px]">Assistente automático 24h</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Conectado
        </span>
      </div>

      {/* Connection card — connected state */}
      <div className="bg-white/5 rounded-2xl border border-white/10 px-4 py-3 flex items-center gap-3 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <p className="text-emerald-400 text-[11px] font-semibold">Bot ativo e atendendo</p>
          <p className="text-white/40 text-[10px]">Pacientes recebem resposta automática do DEX.</p>
        </div>
      </div>

      {/* Two-column: form + phone */}
      <div className="grid grid-cols-[1fr_160px] gap-3">

        {/* Left: tabs + field */}
        <div className="bg-white/5 rounded-2xl border border-white/10 p-3 space-y-3">
          {/* Tab bar */}
          <div className="flex gap-1 p-0.5 bg-black/20 rounded-xl">
            {TABS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[9px] font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-white/10 text-[#2f9c85]'
                    : 'text-white/30'
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {id}
              </button>
            ))}
          </div>

          {/* Animated field content */}
          <AnimatePresence mode="wait">
            {activeTab === 'Identidade' && (
              <motion.div key="id" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-2">
                <FieldMock label="Nome do Assistente" value="DEX" />
                <FieldMock label="Botão do Menu" value="Agendar Consulta" />
              </motion.div>
            )}
            {activeTab === 'Saudações' && (
              <motion.div key="sau" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-2">
                <FieldMock label="Paciente Novo" value="Olá! Seja bem-vindo à {{clinica}}! 😊 Sou o *{{assistente}}*." multiline />
                <FieldMock label="Paciente Retornando" value="Olá, {{nome}}! Sou o *{{assistente}}*. Como posso te ajudar?" multiline />
              </motion.div>
            )}
            {activeTab === 'Respostas' && (
              <motion.div key="res" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-2">
                <FieldMock label="Confirmação" value="✅ Agendamento confirmado pelo {{assistente}}! Dentista: {{dentista}} | Data: {{data_hora}}" multiline />
                <FieldMock label="Sem Horários" value="Poxa, não encontrei horários disponíveis. 😕 Tente outro dentista!" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save button */}
          <div className="w-full py-1.5 rounded-lg text-[9px] font-bold text-white text-center" style={{ background: 'linear-gradient(90deg, #2f9c85, #1e7a67)' }}>
            Salvar Mensagens
          </div>
        </div>

        {/* Right: phone mockup */}
        <div className="flex flex-col items-center">
          <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-2">Pré-visualização</p>
          <div
            className="w-36 rounded-[20px] overflow-hidden"
            style={{ background: '#111', border: '4px solid #1c1c1c', boxShadow: '0 20px 50px -10px rgba(0,0,0,0.7)' }}
          >
            <div className="bg-[#075e54] px-2 py-1.5 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[#128c7e] flex items-center justify-center">
                <Bot className="w-2.5 h-2.5 text-white" />
              </div>
              <div>
                <p className="text-white text-[8px] font-bold leading-none">Clínica Sorriso</p>
                <p className="text-[#b2dfdb] text-[7px]">DEX · online</p>
              </div>
            </div>
            <div className="px-1.5 py-1.5 space-y-0" style={{ minHeight: 180, background: '#e5ddd5' }}>
              <AnimatePresence>
                {BUBBLES.slice(0, visibleBubbles).map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                  >
                    <ChatBubble text={b.text} side={b.side} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="bg-[#f0f0f0] px-1.5 py-1 flex items-center gap-1">
              <div className="flex-1 bg-white rounded-full px-1.5 py-0.5">
                <span className="text-[7px] text-gray-400">Mensagem</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#25d366] flex items-center justify-center">
                <span className="text-white text-[9px] leading-none">↑</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FieldMock({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-semibold text-white/40 uppercase tracking-wider">{label}</p>
      <div className={`w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[8px] text-white/60 leading-snug ${multiline ? 'min-h-[36px]' : ''}`}>
        {value}
      </div>
    </div>
  );
}
