'use client';

import { useState } from 'react';
import { Bot, Loader2, Copy, Check, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CommunicationType = 'confirmacao' | 'lembrete' | 'follow_up' | 'cobranca' | 'reagendamento';

const TIPOS: { value: CommunicationType; label: string; desc: string }[] = [
  { value: 'follow_up',   label: 'Follow-up',    desc: 'Orçamento sem retorno' },
  { value: 'confirmacao', label: 'Confirmação',   desc: 'Confirmar consulta' },
  { value: 'lembrete',    label: 'Lembrete',      desc: 'Lembrar do agendamento' },
  { value: 'cobranca',    label: 'Cobrança',      desc: 'Pagamento pendente' },
  { value: 'reagendamento', label: 'Reagendamento', desc: 'Reagendar consulta' },
];

interface Props {
  pacienteNome: string;
  dentistaNome: string;
  valorTotal?: number | null;
  dataHora?: string | null;
  defaultTipo?: CommunicationType;
  variant?: 'icon' | 'full';
}

export function BotaoMensagemIA({
  pacienteNome,
  dentistaNome,
  valorTotal,
  dataHora,
  defaultTipo = 'follow_up',
  variant = 'icon',
}: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<CommunicationType>(defaultTipo);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGerar = async () => {
    setLoading(true);
    setMensagem(null);
    setError(null);
    try {
      const res = await fetch('/api/dex/comunicacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          pacienteNome,
          dentistaNome,
          clinicaNome: 'a clínica',
          valorTotal: valorTotal ?? undefined,
          dataHora:   dataHora ?? undefined,
        }),
      });
      const data = await res.json() as { mensagem?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao gerar');
      setMensagem(data.mensagem ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar mensagem');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!mensagem) return;
    await navigator.clipboard.writeText(mensagem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    setOpen(true);
    setMensagem(null);
    setError(null);
    setCopied(false);
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={handleOpen}
          className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors"
          title="DEX: Gerar mensagem"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-3 px-4 py-3 bg-surface-alt hover:bg-surface border border-border rounded-xl text-sm font-semibold transition-all text-text-primary"
        >
          <Bot className="w-4 h-4 text-teal shrink-0" />
          Gerar mensagem com IA
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#2f9c85' }}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Mensagem para {pacienteNome}</p>
                    <p className="text-[10px] text-text-secondary">Gerada pelo DEX — revise antes de enviar</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tipo selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block">
                  Tipo de mensagem
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => { setTipo(t.value); setMensagem(null); }}
                      className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                        tipo === t.value
                          ? 'border-teal bg-teal-pale text-teal font-semibold'
                          : 'border-border bg-surface text-text-secondary hover:border-teal/30'
                      }`}
                    >
                      <p className="font-semibold">{t.label}</p>
                      <p className="text-[10px] opacity-70">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resultado */}
              {mensagem && (
                <div className="bg-surface-alt rounded-xl p-3 border border-border">
                  <p className="text-xs text-text-primary leading-relaxed whitespace-pre-line">{mensagem}</p>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleGerar()}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: '#2f9c85' }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                    : <><Bot className="w-4 h-4" /> {mensagem ? 'Regerar' : 'Gerar'}</>
                  }
                </button>
                {mensagem && (
                  <button
                    onClick={() => void handleCopy()}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-text-primary hover:bg-surface transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
