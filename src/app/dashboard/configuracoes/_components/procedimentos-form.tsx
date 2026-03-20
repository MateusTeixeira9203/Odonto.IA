'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Save } from 'lucide-react';
import { atualizarProcedimento, toggleProcedimento, criarProcedimento } from '../actions';
import type { Procedimento } from '@/types/database';

interface RowState {
  preco: string;
  duracao: string;
  dirty: boolean;
}

interface Props {
  procedimentos: Procedimento[];
}

export function ProcedimentosForm({ procedimentos: initialProcs }: Props): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      initialProcs.map((p) => [p.id, { preco: String(p.preco_padrao ?? 0), duracao: String(p.duracao_minutos ?? 30), dirty: false }])
    )
  );

  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoCategoria, setNovoCategoria] = useState('');
  const [novoPreco, setNovoPreco] = useState('0');
  const [novoDuracao, setNovoDuracao] = useState('30');
  const [novoDescricao, setNovoDescricao] = useState('');

  const inputClass =
    'font-sans text-sm px-2.5 py-1.5 rounded-xl border border-border bg-surface-alt text-text-primary focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors';

  function updateRow(id: string, campo: 'preco' | 'duracao', valor: string): void {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor, dirty: true } }));
  }

  function salvarRow(proc: Procedimento): void {
    const row = rows[proc.id];
    if (!row) return;
    startTransition(async () => {
      const result = await atualizarProcedimento(proc.id, {
        preco_padrao: Number(row.preco),
        duracao_minutos: Number(row.duracao),
      });
      if (result.error) {
        toast.error(`Erro: ${result.error}`);
      } else {
        setRows((prev) => ({ ...prev, [proc.id]: { ...prev[proc.id], dirty: false } }));
        toast.success('Procedimento atualizado');
      }
    });
  }

  function handleToggle(id: string, ativo: boolean): void {
    startTransition(async () => {
      const result = await toggleProcedimento(id, ativo);
      if (result.error) { toast.error(`Erro: ${result.error}`); }
      else { router.refresh(); }
    });
  }

  function handleCriar(): void {
    if (!novoNome.trim() || !novoCategoria.trim()) {
      toast.error('Preencha nome e categoria');
      return;
    }
    startTransition(async () => {
      const result = await criarProcedimento({
        nome: novoNome.trim(),
        descricao: novoDescricao.trim(),
        categoria: novoCategoria.trim(),
        preco_padrao: Number(novoPreco),
        duracao_minutos: Number(novoDuracao),
      });
      if (result.error) {
        toast.error(`Erro: ${result.error}`);
      } else {
        toast.success('Procedimento criado!');
        setShowNovo(false);
        setNovoNome(''); setNovoCategoria(''); setNovoPreco('0'); setNovoDuracao('30'); setNovoDescricao('');
        router.refresh();
      }
    });
  }

  const categorias = Array.from(new Set(initialProcs.map((p) => p.categoria))).sort();

  return (
    <div className="space-y-6 max-w-4xl">
      {categorias.map((cat) => {
        const procs = initialProcs.filter((p) => p.categoria === cat);
        return (
          <div key={cat}>
            <p className="font-mono text-xs text-text-secondary uppercase tracking-widest mb-2">{cat}</p>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt/50">
                    <th className="text-left px-4 py-2.5 font-mono text-xs text-text-secondary uppercase tracking-wider">Procedimento</th>
                    <th className="text-left px-4 py-2.5 font-mono text-xs text-text-secondary uppercase tracking-wider w-36">Preço (R$)</th>
                    <th className="text-left px-4 py-2.5 font-mono text-xs text-text-secondary uppercase tracking-wider w-32">Duração (min)</th>
                    <th className="px-4 py-2.5 font-mono text-xs text-text-secondary uppercase tracking-wider text-center w-16">Ativo</th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {procs.map((proc, i) => {
                    const row = rows[proc.id] ?? { preco: String(proc.preco_padrao ?? 0), duracao: String(proc.duracao_minutos ?? 30), dirty: false };
                    return (
                      <tr key={proc.id} className={`border-b border-border/50 last:border-b-0 ${!proc.ativo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5 font-sans text-sm text-text-primary">{proc.nome}</td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min={0} step={0.01}
                            value={row.preco}
                            onChange={(e) => updateRow(proc.id, 'preco', e.target.value)}
                            className={inputClass + ' w-full'}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min={5} step={5}
                            value={row.duracao}
                            onChange={(e) => updateRow(proc.id, 'duracao', e.target.value)}
                            className={inputClass + ' w-full'}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={proc.ativo}
                            onChange={(e) => handleToggle(proc.id, e.target.checked)}
                            disabled={isPending}
                            className="w-4 h-4 rounded border-border accent-teal cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {row.dirty && (
                            <button
                              type="button"
                              onClick={() => salvarRow(proc)}
                              disabled={isPending}
                              title="Salvar alterações"
                              className="p-1 rounded-lg hover:bg-teal/10 text-teal transition-colors disabled:opacity-50"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Formulário novo procedimento */}
      {showNovo ? (
        <div className="rounded-xl border border-border p-5 space-y-4 bg-surface-alt/30">
          <p className="font-mono text-xs text-text-secondary uppercase tracking-widest">Novo Procedimento</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">Nome *</label>
              <input className={inputClass + ' w-full'} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: Limpeza completa" />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">Categoria *</label>
              <input className={inputClass + ' w-full'} value={novoCategoria} onChange={(e) => setNovoCategoria(e.target.value)} placeholder="Ex: Preventivo" />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">Preço sugerido (R$)</label>
              <input type="number" min={0} step={0.01} className={inputClass + ' w-full'} value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-text-secondary">Duração (min)</label>
              <input type="number" min={5} step={5} className={inputClass + ' w-full'} value={novoDuracao} onChange={(e) => setNovoDuracao(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="font-mono text-xs text-text-secondary">Descrição</label>
              <input className={inputClass + ' w-full'} value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} placeholder="Descrição opcional" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCriar}
              disabled={isPending}
              className="h-9 px-4 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Criando…' : 'Criar Procedimento'}
            </button>
            <button
              type="button"
              onClick={() => setShowNovo(false)}
              className="h-9 px-4 rounded-xl border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed border-border text-sm text-text-secondary hover:border-teal hover:text-teal transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar procedimento
        </button>
      )}
    </div>
  );
}
