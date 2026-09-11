'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileUp, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { ImportarProcedimentosModal } from './importar-procedimentos-modal';
import { parseValorBR, formatValorBR } from '@/lib/valor-br';
import type { Procedimento } from '@/types/database';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  atualizarProcedimento,
  criarProcedimento,
  removerProcedimentoDoCatalogo,
  restaurarProcedimentoNoCatalogo,
} from '../actions';

interface ProcedimentosCatalogoProps {
  procedimentosIniciais: Procedimento[];
}

export function ProcedimentosCatalogo({
  procedimentosIniciais,
}: ProcedimentosCatalogoProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const procedimentos = procedimentosIniciais;
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', preco_padrao: '', duracao_minutos: 0 });
  const [showNovoProcedimento, setShowNovoProcedimento] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [mostrarRemovidos, setMostrarRemovidos] = useState(false);
  const [procedimentoParaRemover, setProcedimentoParaRemover] = useState<Procedimento | null>(null);
  const [novoProc, setNovoProc] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    preco_padrao: '',
    duracao_minutos: '30',
  });

  const handleEditarProcedimento = (proc: Procedimento) => {
    setEditandoId(proc.id);
    setEditForm({
      nome: proc.nome,
      preco_padrao: formatValorBR(proc.preco_padrao ?? 0),
      duracao_minutos: proc.duracao_minutos ?? 30,
    });
  };

  const handleSalvarProcedimento = (id: string) => {
    const precoNum = parseValorBR(editForm.preco_padrao);
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await atualizarProcedimento(id, {
        nome: editForm.nome.trim() || 'Procedimento',
        preco_padrao: precoNum,
        duracao_minutos: editForm.duracao_minutos,
      });
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }

      setEditandoId(null);
      setSuccessMsg('Procedimento atualizado com sucesso!');
    });
  };

  const handleRemoverProcedimento = () => {
    const procedimento = procedimentoParaRemover;
    if (!procedimento) return;

    startTransition(async () => {
      setSuccessMsg(null);
      setErrorMsg(null);
      const result = await removerProcedimentoDoCatalogo(procedimento.id);
      if (!result.ok) {
        setErrorMsg(result.erro);
        return;
      }

      setProcedimentoParaRemover(null);
      setSuccessMsg(`"${procedimento.nome}" foi removido do catálogo.`);
    });
  };

  const handleRestaurarProcedimento = (id: string) => {
    startTransition(async () => {
      setSuccessMsg(null);
      setErrorMsg(null);
      const result = await restaurarProcedimentoNoCatalogo(id);
      if (!result.ok) {
        setErrorMsg(result.erro);
        return;
      }

      setSuccessMsg('Procedimento restaurado no catálogo.');
    });
  };

  const handleCriarProcedimento = () => {
    if (!novoProc.nome.trim()) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    startTransition(async () => {
      const result = await criarProcedimento({
        nome: novoProc.nome.trim(),
        descricao: novoProc.descricao.trim(),
        categoria: novoProc.categoria.trim() || 'Geral',
        preco_padrao: parseValorBR(novoProc.preco_padrao),
        duracao_minutos: parseInt(novoProc.duracao_minutos, 10) || 30,
      });
      if (!result.ok) {
        setErrorMsg(result.erro);
        return;
      }

      setShowNovoProcedimento(false);
      setNovoProc({ nome: '', descricao: '', categoria: '', preco_padrao: '', duracao_minutos: '30' });
      setSuccessMsg(result.restaurado ? 'Procedimento restaurado no catálogo.' : 'Procedimento criado!');
    });
  };

  const procedimentosAtivos = procedimentos.filter((procedimento) => procedimento.ativo);
  const procedimentosRemovidos = procedimentos.filter((procedimento) => !procedimento.ativo);
  const categorias = Array.from(new Set(procedimentosAtivos.map((procedimento) => procedimento.categoria)));

  return (
    <div className="space-y-4">
      {(successMsg || errorMsg) && (
        <div aria-live="polite" className="space-y-3">
          {successMsg && (
            <div className="bg-teal/10 border border-teal/20 rounded-xl p-4 text-sm text-teal flex items-center gap-2">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="min-w-0 font-heading font-bold text-2xl text-text-primary flex items-center">
            Catálogo de Procedimentos
            <HelpTooltip content="Cadastre seus procedimentos e valores para uso nos orçamentos." />
          </h2>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => setShowImportar(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-all hover:border-teal/40 hover:text-teal hover:bg-teal/5 sm:flex-none"
            >
              <FileUp className="w-4 h-4" /> Importar
            </button>
            <button
              onClick={() => setShowNovoProcedimento(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-teal-lt px-4 py-2 text-sm font-semibold text-white transition-all shadow-[0_4px_14px_rgba(47,156,133,0.3)] hover:-translate-y-0.5 sm:flex-none"
            >
              <Plus className="w-4 h-4" /> Novo
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMostrarRemovidos((visivel) => !visivel)}
          className="mb-5 min-h-11 text-xs font-semibold text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          {mostrarRemovidos
            ? 'Ocultar removidos'
            : `Ver removidos (${procedimentosRemovidos.length})`}
        </button>

        {showNovoProcedimento && (
          <div className="mb-6 p-4 border border-teal/20 bg-teal/5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-teal">Novo Procedimento</span>
              <button
                type="button"
                onClick={() => setShowNovoProcedimento(false)}
                aria-label="Fechar formulário de novo procedimento"
                title="Fechar formulário"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="Nome do procedimento"
                placeholder="Nome do procedimento *"
                value={novoProc.nome}
                onChange={(e) => setNovoProc((f) => ({ ...f, nome: e.target.value }))}
                className="col-span-2 min-h-11 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
              />
              <input
                aria-label="Categoria do procedimento"
                placeholder="Categoria (ex: Ortodontia)"
                value={novoProc.categoria}
                onChange={(e) => setNovoProc((f) => ({ ...f, categoria: e.target.value }))}
                className="min-h-11 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
              />
              <input
                aria-label="Preço padrão do procedimento"
                placeholder="Preço (R$)"
                type="text" inputMode="decimal"
                value={novoProc.preco_padrao}
                onChange={(e) => setNovoProc((f) => ({ ...f, preco_padrao: e.target.value }))}
                className="min-h-11 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal font-mono"
              />
              <input
                aria-label="Descrição do procedimento"
                placeholder="Descrição"
                value={novoProc.descricao}
                onChange={(e) => setNovoProc((f) => ({ ...f, descricao: e.target.value }))}
                className="min-h-11 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal"
              />
              <select
                aria-label="Duração do procedimento"
                value={novoProc.duracao_minutos}
                onChange={(e) => setNovoProc((f) => ({ ...f, duracao_minutos: e.target.value }))}
                className="min-h-11 border border-border rounded-lg px-3 py-2 text-sm bg-surface-alt text-text-primary outline-none focus:border-teal font-mono"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCriarProcedimento}
                disabled={isPending || !novoProc.nome.trim()}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Criar Procedimento
              </button>
            </div>
          </div>
        )}

        {categorias.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">
            Nenhum procedimento ativo. Crie um novo ou restaure um item removido.
          </p>
        )}

        {categorias.map((categoria) => (
          <div key={categoria} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-2">
                {categoria}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              {procedimentos
                .filter((p) => p.ativo && p.categoria === categoria)
                .map((proc) => (
                  <div
                    key={proc.id}
                    className="p-4 rounded-xl border border-border bg-surface transition-colors"
                  >
                    {editandoId === proc.id ? (
                      <div className="flex flex-col gap-3">
                        <input
                          aria-label={`Nome de ${proc.nome}`}
                          type="text"
                          value={editForm.nome}
                          onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                          placeholder="Nome do procedimento"
                          className="min-h-11 w-full border border-teal/40 rounded-lg px-3 py-1.5 text-sm font-medium bg-surface-alt text-text-primary outline-none focus:border-teal transition-colors"
                        />
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-secondary">R$</span>
                            <input
                              aria-label={`Preço padrão de ${proc.nome}`}
                              type="text" inputMode="decimal"
                              value={editForm.preco_padrao}
                              onChange={(e) => setEditForm((f) => ({ ...f, preco_padrao: e.target.value }))}
                              className="min-h-11 w-24 border border-border rounded-lg px-2 py-1 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Duração de ${proc.nome}`}
                              value={editForm.duracao_minutos}
                              onChange={(e) => setEditForm((f) => ({ ...f, duracao_minutos: parseInt(e.target.value, 10) }))}
                              className="min-h-11 border border-border rounded-lg px-2 py-1 text-xs font-mono bg-surface-alt text-text-primary outline-none focus:border-teal"
                            >
                              <option value={15}>15 min</option>
                              <option value={30}>30 min</option>
                              <option value={45}>45 min</option>
                              <option value={60}>60 min</option>
                              <option value={90}>90 min</option>
                            </select>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={() => handleSalvarProcedimento(proc.id)}
                              disabled={isPending}
                              aria-label={`Salvar alterações em ${proc.nome}`}
                              title="Salvar alterações"
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-teal text-white transition-colors hover:bg-teal-lt"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditandoId(null)}
                              aria-label={`Cancelar edição de ${proc.nome}`}
                              title="Cancelar edição"
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-surface-alt text-text-secondary transition-colors hover:bg-surface-alt"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium text-sm text-text-primary flex-1">
                          {proc.nome}
                        </span>
                        {proc.preco_padrao !== null && (
                          <span className="font-mono text-sm font-semibold text-text-primary">
                            {proc.preco_padrao.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        )}
                        {proc.duracao_minutos && (
                          <span className="text-xs text-text-secondary font-medium">
                            {proc.duracao_minutos} min
                          </span>
                        )}
                        <div className="flex gap-2 ml-auto">
                          <button
                            onClick={() => handleEditarProcedimento(proc)}
                            aria-label={`Editar ${proc.nome}`}
                            title={`Editar ${proc.nome}`}
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProcedimentoParaRemover(proc)}
                            disabled={isPending}
                            aria-label={`Remover ${proc.nome} do catálogo`}
                            title="Remover do catálogo"
                            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}

        {mostrarRemovidos && (
          <section className="mt-8 border-t border-border pt-6" aria-labelledby="procedimentos-removidos-titulo">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h3 id="procedimentos-removidos-titulo" className="font-heading text-base font-bold text-text-primary">
                  Removidos ({procedimentosRemovidos.length})
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Fora das novas escolhas. O histórico clínico continua preservado.
                </p>
              </div>
            </div>

            {procedimentosRemovidos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-text-secondary">
                Nenhum procedimento removido.
              </p>
            ) : (
              <div className="space-y-2">
                {procedimentosRemovidos.map((procedimento) => (
                  <div key={procedimento.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-alt/50 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{procedimento.nome}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{procedimento.categoria}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestaurarProcedimento(procedimento.id)}
                      disabled={isPending}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 px-3 text-xs font-bold text-teal transition-colors hover:bg-teal/15 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <ImportarProcedimentosModal
        open={showImportar}
        onOpenChange={setShowImportar}
        onSaved={() => router.refresh()}
      />

      <AlertDialog
        open={procedimentoParaRemover !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setProcedimentoParaRemover(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              {procedimentoParaRemover
                ? `“${procedimentoParaRemover.nome}” deixará de aparecer nas novas escolhas. O histórico clínico e os orçamentos anteriores serão preservados.`
                : 'O procedimento deixará de aparecer nas novas escolhas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => handleRemoverProcedimento()}
              className="bg-coral text-white hover:bg-coral/90"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
