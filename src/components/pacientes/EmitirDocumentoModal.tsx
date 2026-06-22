'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Loader2, Check, Printer } from 'lucide-react';
import { toast } from 'sonner';
import {
  TIPO_LABEL, modelosPorTipo, getModelo,
  type TipoDocumento, type ModeloDocumento,
} from '@/lib/documentos/modelos';
import { emitirDocumento } from '@/app/dashboard/pacientes/[id]/documentos-actions';

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  onEmitted?: () => void; // ex.: refazer fetch da aba Arquivos
}

const TIPOS: TipoDocumento[] = ['receita', 'atestado', 'pedido_exame'];

export function EmitirDocumentoModal({ open, onClose, patientId, patientName, onEmitted }: Props) {
  const [tipo, setTipo] = useState<TipoDocumento>('receita');
  const [modeloId, setModeloId] = useState<string>('');
  const [valores, setValores] = useState<Record<string, string>>({});
  const [duasVias, setDuasVias] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ signedUrl?: string; nome?: string; docId?: string } | null>(null);

  const modelos = modelosPorTipo(tipo);
  const modelo: ModeloDocumento | undefined = modeloId ? getModelo(tipo, modeloId) : undefined;

  const reset = () => {
    setTipo('receita'); setModeloId(''); setValores({}); setDuasVias(false);
    setIsSaving(false); setResult(null);
  };
  const fechar = () => { reset(); onClose(); };

  const selecionarTipo = (t: TipoDocumento) => { setTipo(t); setModeloId(''); setValores({}); setDuasVias(false); };

  const selecionarModelo = (m: ModeloDocumento) => {
    setModeloId(m.id);
    const init: Record<string, string> = {};
    m.campos.forEach((c) => { if (c.default) init[c.id] = c.default; });
    setValores(init);
    setDuasVias(false);
  };

  const podeGerar = !!modelo && modelo.campos.every((c) => !c.obrigatorio || (valores[c.id]?.trim()));

  const gerar = async () => {
    if (!modelo) return;
    setIsSaving(true);
    const r = await emitirDocumento({ pacienteId: patientId, tipo, modeloId: modelo.id, valores, duasVias });
    setIsSaving(false);
    if (r.error) { toast.error(r.error); return; }
    setResult({ signedUrl: r.signedUrl, nome: r.nome, docId: r.docId });
    onEmitted?.();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={fechar}
      >
        <motion.div
          className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-teal" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary leading-none">Emitir documento</p>
                <p className="text-xs text-text-secondary mt-0.5">{patientName}</p>
              </div>
            </div>
            <button onClick={fechar} className="text-text-secondary hover:text-text-primary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {result ? (
              /* ── Resultado ── */
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full bg-teal flex items-center justify-center">
                  <Check className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-text-primary">Documento gerado!</p>
                  <p className="text-xs text-text-secondary mt-1">Salvo em Arquivos do paciente.</p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {result.signedUrl && (
                    <a
                      href={result.signedUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-lt transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Abrir / Imprimir
                    </a>
                  )}
                  {/* Botão "Enviar WhatsApp" entra na Task 6 */}
                  <button
                    onClick={fechar}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Tipo */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t} onClick={() => selecionarTipo(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          tipo === t ? 'bg-teal text-white border-teal' : 'bg-surface-alt text-text-secondary border-border hover:border-teal/40'
                        }`}
                      >
                        {TIPO_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modelo */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Modelo</label>
                  <div className="flex flex-wrap gap-2">
                    {modelos.map((m) => (
                      <button
                        key={m.id} onClick={() => selecionarModelo(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          modeloId === m.id ? 'bg-teal/10 text-teal border-teal/40' : 'bg-surface-alt text-text-secondary border-border hover:border-teal/40'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos do modelo */}
                {modelo && (
                  <div className="space-y-3">
                    {modelo.campos.map((c) => (
                      <div key={c.id} className="space-y-1.5">
                        <label className="text-xs font-semibold text-text-primary">
                          {c.label}{c.obrigatorio && <span className="text-red-500"> *</span>}
                        </label>
                        {c.tipo === 'textarea' ? (
                          <textarea
                            value={valores[c.id] ?? ''} placeholder={c.placeholder} rows={4}
                            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                            className="w-full text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors resize-none placeholder:text-text-secondary/50"
                          />
                        ) : (
                          <input
                            type={c.tipo === 'numero' ? 'number' : 'text'} min={c.tipo === 'numero' ? 1 : undefined}
                            value={valores[c.id] ?? ''} placeholder={c.placeholder}
                            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                            className="w-full text-sm text-text-primary bg-surface-alt rounded-lg px-3 py-2 outline-none border border-transparent focus:border-teal transition-colors placeholder:text-text-secondary/50"
                          />
                        )}
                      </div>
                    ))}

                    {modelo.permiteDuasVias && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={duasVias} onChange={(e) => setDuasVias(e.target.checked)} className="accent-teal" />
                        <span className="text-xs text-text-secondary">Imprimir em 2 vias (ex.: antibiótico)</span>
                      </label>
                    )}
                  </div>
                )}

                <button
                  onClick={() => void gerar()} disabled={!podeGerar || isSaving}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: '#2f9c85' }}
                >
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><FileText className="w-4 h-4" /> Gerar documento</>}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
