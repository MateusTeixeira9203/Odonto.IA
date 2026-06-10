'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileText, Loader2, X, Check, Plus, AlertCircle } from 'lucide-react';
import { criarProcedimento } from '../actions';

type ProcRow = {
  key: string;
  nome: string;
  preco_padrao: string;
  duracao_minutos: string;
  categoria: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ImportarProcedimentosModal({ open, onOpenChange, onSaved }: Props) {
  const [stage, setStage] = useState<'upload' | 'processing' | 'review' | 'saving' | 'done'>('upload');
  const [rows, setRows] = useState<ProcRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStage('upload');
    setRows([]);
    setError(null);
    setSavedCount(0);
    setFileName('');
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'pdf', 'docx'].includes(ext ?? '')) {
      setError('Formato não suportado. Use TXT, PDF ou DOCX.');
      return;
    }
    setFileName(file.name);
    setError(null);
    setStage('processing');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/importar-procedimentos', { method: 'POST', body: form });
      const data = (await res.json()) as { procedimentos?: ProcRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro ao processar.');

      type APIProc = { nome: string; preco_padrao: number; duracao_minutos: number; categoria: string };
      const procs: ProcRow[] = ((data.procedimentos ?? []) as unknown as APIProc[]).map((p, i) => ({
        key: String(i),
        nome: p.nome,
        preco_padrao: String(p.preco_padrao),
        duracao_minutos: String(p.duracao_minutos),
        categoria: p.categoria,
      }));

      if (procs.length === 0) {
        setError('Nenhum procedimento encontrado no arquivo. Verifique o conteúdo.');
        setStage('upload');
        return;
      }

      setRows(procs);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setStage('upload');
    }
  };

  const updateRow = (key: string, field: keyof Omit<ProcRow, 'key'>, value: string) => {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: String(Date.now()), nome: '', preco_padrao: '0', duracao_minutos: '30', categoria: 'Geral' },
    ]);
  };

  const validRows = rows.filter((r) => r.nome.trim());

  const handleSave = async () => {
    if (!validRows.length) return;
    setStage('saving');
    setSavedCount(0);
    let count = 0;
    for (const row of validRows) {
      await criarProcedimento({
        nome: row.nome.trim(),
        descricao: '',
        categoria: row.categoria.trim() || 'Geral',
        preco_padrao: parseFloat(row.preco_padrao) || 0,
        duracao_minutos: parseInt(row.duracao_minutos, 10) || 30,
      });
      count++;
      setSavedCount(count);
    }
    setStage('done');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-surface border-border rounded-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border/60">
          <DialogTitle className="font-heading font-bold text-xl text-text-primary">
            Importar Procedimentos
          </DialogTitle>
          <p className="text-sm text-text-secondary mt-0.5">
            Envie um arquivo com seus procedimentos e valores — a IA organiza tudo automaticamente.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* UPLOAD / PROCESSING */}
          {(stage === 'upload' || stage === 'processing') && (
            <div
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center transition-colors ${
                stage === 'processing'
                  ? 'border-teal/30 bg-teal/[0.03] cursor-default'
                  : 'border-border hover:border-teal/40 hover:bg-teal/[0.02] cursor-pointer'
              }`}
              onClick={() => stage === 'upload' && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && stage === 'upload') handleFile(file);
              }}
            >
              {stage === 'processing' ? (
                <>
                  <Loader2 className="w-9 h-9 text-teal animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{fileName}</p>
                    <p className="text-xs text-text-secondary mt-1">Extraindo e organizando com IA...</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-teal/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-teal" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-text-secondary mt-1">TXT · PDF · DOCX (Word)</p>
                  </div>
                </>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />

          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* REVIEW TABLE */}
          {stage === 'review' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal" />
                  <span className="text-sm font-semibold text-text-primary">
                    {rows.length} procedimento{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-text-secondary">— revise antes de confirmar</span>
                </div>
                <button
                  onClick={() => { reset(); setTimeout(() => inputRef.current?.click(), 50); }}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors underline-offset-2 hover:underline"
                >
                  Trocar arquivo
                </button>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-alt">
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Nome</th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Categoria</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Preço (R$)</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Min</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.map((row) => (
                      <tr key={row.key} className="group hover:bg-surface-alt/40 transition-colors">
                        <td className="px-2 py-1.5">
                          <input
                            value={row.nome}
                            onChange={(e) => updateRow(row.key, 'nome', e.target.value)}
                            placeholder="Nome do procedimento"
                            className="w-full bg-transparent px-1.5 py-0.5 text-text-primary rounded focus:outline-none focus:bg-surface-alt focus:ring-1 focus:ring-teal/40 text-sm placeholder:text-text-secondary/40"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.categoria}
                            onChange={(e) => updateRow(row.key, 'categoria', e.target.value)}
                            className="w-full bg-transparent px-1.5 py-0.5 text-text-secondary rounded focus:outline-none focus:bg-surface-alt focus:ring-1 focus:ring-teal/40 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={row.preco_padrao}
                            onChange={(e) => updateRow(row.key, 'preco_padrao', e.target.value)}
                            className="w-20 bg-transparent px-1.5 py-0.5 text-right font-mono text-text-primary rounded focus:outline-none focus:bg-surface-alt focus:ring-1 focus:ring-teal/40 text-sm ml-auto block"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={row.duracao_minutos}
                            onChange={(e) => updateRow(row.key, 'duracao_minutos', e.target.value)}
                            className="w-14 bg-transparent px-1.5 py-0.5 text-right font-mono text-text-primary rounded focus:outline-none focus:bg-surface-alt focus:ring-1 focus:ring-teal/40 text-sm ml-auto block"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeRow(row.key)}
                            className="text-text-secondary/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-teal transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar linha
              </button>
            </>
          )}

          {/* SAVING */}
          {stage === 'saving' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="w-9 h-9 text-teal animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-text-primary">Salvando procedimentos...</p>
                <p className="text-xs text-text-secondary font-mono mt-1">
                  {savedCount} / {validRows.length}
                </p>
              </div>
              <div className="w-48 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal rounded-full transition-all duration-300"
                  style={{ width: `${validRows.length ? (savedCount / validRows.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-teal" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text-primary">
                  {savedCount} procedimento{savedCount !== 1 ? 's' : ''} importado{savedCount !== 1 ? 's' : ''} com sucesso!
                </p>
                <p className="text-xs text-text-secondary mt-1">A lista foi atualizada automaticamente.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0 flex justify-end gap-3 border-t border-border/60">
          {stage === 'done' ? (
            <button
              onClick={() => { onSaved(); handleClose(false); }}
              className="bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-[0_4px_14px_rgba(47,156,133,0.3)]"
            >
              Concluir
            </button>
          ) : stage === 'review' ? (
            <>
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={validRows.length === 0}
                className="bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center gap-2 shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 transition-all"
              >
                <Check className="w-4 h-4" />
                Importar {validRows.length} procedimento{validRows.length !== 1 ? 's' : ''}
              </button>
            </>
          ) : (
            <button
              onClick={() => handleClose(false)}
              disabled={stage === 'processing'}
              className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
