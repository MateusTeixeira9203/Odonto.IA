'use client';

import { ArrowLeft, Mic, Image as ImageIcon, Type, Sparkles, X, Send, Download, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function NovoOrcamento() {
  const [mode, setMode] = useState<'voice' | 'text' | 'image'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setTranscript('"Extração do 46, canal no 16, restauração no 21..."');
    } else {
      setIsRecording(true);
      setTranscript('');
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setGenerated(true);
    }, 2500);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-md hover:text-black text-sm font-semibold mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Início
      </Link>

      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-4xl text-black mb-2">Novo Orçamento</h1>
          <p className="text-gray-md text-sm font-medium">Use a Inteligência Odontológica para estruturar o plano.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-teal-lt" />
          <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Dent IA Ativa</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {!generated ? (
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white rounded-3xl border border-border/60 shadow-lg overflow-hidden flex flex-col md:flex-row"
          >
            <div className="w-full md:w-1/3 bg-surface/30 p-6 border-r border-border/60 flex flex-col">
              <div className="mb-8">
                <label className="block text-[10px] font-bold text-gray-md uppercase tracking-[0.15em] mb-3">Paciente</label>
                <input
                  type="text"
                  placeholder="Nome ou ID do paciente"
                  className="w-full border border-border rounded-xl px-4 py-3 font-sans text-sm bg-white shadow-sm outline-none focus:border-teal transition-colors text-black"
                />
              </div>

              <div className="mb-4">
                <label className="block text-[10px] font-bold text-gray-md uppercase tracking-[0.15em] mb-3">Método de Entrada</label>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setMode('voice')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'voice' ? 'bg-black text-white shadow-md' : 'bg-white border border-border text-gray-md hover:text-black hover:border-black'}`}
                  >
                    <Mic className={`w-4 h-4 ${mode === 'voice' ? 'text-teal-lt' : ''}`} /> Ditado por Voz
                  </button>
                  <button
                    onClick={() => setMode('text')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'text' ? 'bg-black text-white shadow-md' : 'bg-white border border-border text-gray-md hover:text-black hover:border-black'}`}
                  >
                    <Type className={`w-4 h-4 ${mode === 'text' ? 'text-teal-lt' : ''}`} /> Texto Livre
                  </button>
                  <button
                    onClick={() => setMode('image')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${mode === 'image' ? 'bg-black text-white shadow-md' : 'bg-white border border-border text-gray-md hover:text-black hover:border-black'}`}
                  >
                    <ImageIcon className={`w-4 h-4 ${mode === 'image' ? 'text-teal-lt' : ''}`} /> Odontograma (Foto)
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full md:w-2/3 p-8 flex flex-col justify-between bg-white relative">
              {isGenerating && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mb-4">
                    <Sparkles className="w-10 h-10 text-teal" />
                  </motion.div>
                  <div className="font-heading text-2xl text-black mb-2">Processando dados...</div>
                  <div className="font-mono text-xs text-gray-md uppercase tracking-widest">Estruturando procedimentos e valores</div>
                </div>
              )}

              <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                {mode === 'voice' && (
                  <div className="w-full max-w-md flex flex-col items-center">
                    <div className="relative mb-8">
                      {isRecording && (
                        <motion.div
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 bg-red-500 rounded-full"
                        />
                      )}
                      <button
                        onClick={handleRecordToggle}
                        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all z-10 ${isRecording ? 'bg-red-50 text-red-500 border-2 border-red-500' : 'bg-black text-white hover:bg-gray-900 shadow-xl'}`}
                      >
                        {isRecording ? <div className="w-6 h-6 rounded-sm bg-red-500" /> : <Mic className="w-8 h-8" />}
                      </button>
                    </div>

                    {isRecording && (
                      <div className="flex items-center justify-center gap-1.5 h-12 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ height: ['20%', '100%', '20%'] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
                            className="w-1.5 bg-teal rounded-full"
                            style={{ height: '20%' }}
                          />
                        ))}
                      </div>
                    )}

                    {transcript && (
                      <div className="w-full bg-surface/50 border border-border rounded-xl p-5 text-sm text-black font-medium text-center leading-relaxed">
                        {transcript}
                      </div>
                    )}

                    {!isRecording && !transcript && (
                      <p className="text-sm text-gray-md font-medium text-center">Clique no microfone e dite os procedimentos.</p>
                    )}
                  </div>
                )}

                {mode === 'text' && (
                  <div className="w-full h-full flex flex-col">
                    <label className="block text-[10px] font-bold text-gray-md uppercase tracking-[0.15em] mb-3">Descrição Clínica</label>
                    <textarea
                      placeholder="Ex: Paciente necessita de extração do dente 46, tratamento endodôntico no 16 e restauração em resina no 21..."
                      className="w-full flex-1 min-h-[250px] border border-border rounded-xl p-5 font-sans text-sm bg-surface/30 outline-none focus:border-teal transition-colors text-black resize-none leading-relaxed"
                    />
                  </div>
                )}

                {mode === 'image' && (
                  <div className="w-full h-full min-h-[250px] border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center bg-surface/30 hover:bg-surface/60 transition-colors cursor-pointer group">
                    <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-6 h-6 text-black" />
                    </div>
                    <p className="text-sm font-semibold text-black mb-1">Fazer upload de Odontograma</p>
                    <p className="text-xs text-gray-md font-medium">Arraste a imagem ou clique para selecionar</p>
                    <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-teal px-3 py-1 bg-teal-pale rounded-full">
                      A IA detectará as marcações automaticamente
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-border/60 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (mode === 'voice' && !transcript)}
                  className="bg-teal hover:bg-teal-dark text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Sparkles className="w-4 h-4" />
                  Gerar Orçamento
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-border/60 shadow-xl overflow-hidden max-w-2xl mx-auto"
          >
            <div className="bg-black p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-heading text-3xl">Orçamento #247</h2>
                    <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md font-bold bg-white/10 text-teal-lt border border-white/10">
                      Gerado por IA
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Paciente: Ana Paula Ferreira</p>
                </div>
                <button onClick={() => setGenerated(false)} className="text-gray-400 hover:text-white p-2 bg-white/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-2 mb-8">
                {[
                  { proc: 'Extração simples (Dente 46)', value: 'R$ 280,00' },
                  { proc: 'Tratamento Endodôntico (Dente 16)', value: 'R$ 850,00' },
                  { proc: 'Restauração em Resina (Dente 21)', value: 'R$ 320,00' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-surface/50 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-teal" />
                      </div>
                      <div className="text-sm font-semibold text-black">{item.proc}</div>
                    </div>
                    <div className="font-mono text-sm font-bold text-black">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-end p-6 bg-bg rounded-2xl border border-border/60 mb-8">
                <div className="text-sm font-bold text-gray-md uppercase tracking-widest">Total Estimado</div>
                <div className="font-mono text-3xl font-bold text-teal">R$ 1.450,00</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button className="w-full bg-black hover:bg-gray-900 text-white px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md">
                  <Send className="w-4 h-4" />
                  Enviar via WhatsApp
                </button>
                <button className="w-full bg-white border-2 border-border hover:border-black text-black px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
