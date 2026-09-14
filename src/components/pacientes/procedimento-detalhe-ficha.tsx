'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { EndoForm } from '@/components/fichas/endo-form';
import { ImplanteForm } from '@/components/fichas/implante-form';
import { endoDetalheSchema, type EndoDetalhe } from '@/lib/especialidades/endo';
import { implanteDetalheSchema, type ImplanteDetalhe } from '@/lib/especialidades/implante';
import { editarDetalhesEvento } from '@/server/patients/registro-actions';
import { rotuloProcedimento } from '@/types/odontograma';
import type { SnapshotProcedimento } from '@/lib/odontograma/edicao-procedimento';
import { retirarProcedimentoDaFicha } from '@/server/orcamentos/ficha-orcamento-actions';
import type { ProntuarioEvento } from '@/server/patients/get-prontuario-longitudinal';

type DetalheEmEdicao =
  | { tipo: 'endodontia'; valor: EndoDetalhe | null }
  | { tipo: 'implante'; valor: ImplanteDetalhe | null }
  | { tipo: 'sem_detalhe'; valor: null };

function detalheInicial(evento: { tipo: ProntuarioEvento['tipo']; detalhe?: unknown }): DetalheEmEdicao {
  if (evento.tipo === 'endodontia') {
    const parsed = endoDetalheSchema.safeParse(evento.detalhe);
    return { tipo: 'endodontia', valor: parsed.success ? parsed.data : null };
  }
  if (evento.tipo === 'implante') {
    const parsed = implanteDetalheSchema.safeParse(evento.detalhe);
    return { tipo: 'implante', valor: parsed.success ? parsed.data : null };
  }
  return { tipo: 'sem_detalhe', valor: null };
}

interface ProcedimentoDetalheFichaProps {
  evento: ProntuarioEvento;
  permitirNome: boolean;
  permitirObservacao: boolean;
  permitirDetalhe: boolean;
  permitirExclusao: boolean;
  onFechar: () => void;
  onSalvo: () => void;
  onExcluido: () => void;
  onRevisarOrcamento?: () => void;
}

/** Editor contextual de um evento: não troca a Ficha unificada pelo editor legado. */
export function ProcedimentoDetalheFicha({
  evento,
  permitirNome,
  permitirObservacao,
  permitirDetalhe,
  permitirExclusao,
  onFechar,
  onSalvo,
  onExcluido,
  onRevisarOrcamento,
}: ProcedimentoDetalheFichaProps) {
  const erroId = useId();
  const recuperarRef = useRef<HTMLButtonElement>(null);
  const [nome, setNome] = useState(() => rotuloProcedimento(evento));
  const [original, setOriginal] = useState<SnapshotProcedimento>(() => ({
    procedimentoNome: evento.procedimentoNome ?? null,
    observacao: evento.observacao ?? null,
    detalhe: evento.detalhe ?? null,
  }));
  const [nomeEditado, setNomeEditado] = useState(false);
  const [observacaoEditada, setObservacaoEditada] = useState(false);
  const [detalheEditado, setDetalheEditado] = useState(false);
  const [conflito, setConflito] = useState<SnapshotProcedimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const envioEmCurso = useRef(false);
  const [observacao, setObservacao] = useState(evento.observacao ?? '');
  const [detalhe, setDetalhe] = useState<DetalheEmEdicao>(() => detalheInicial(evento));
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [revisarOrcamento, setRevisarOrcamento] = useState(false);

  useEffect(() => { if (conflito) recuperarRef.current?.focus(); }, [conflito]);

  const temDetalheTecnico = detalhe.tipo !== 'sem_detalhe';

  async function salvar(): Promise<void> {
    if (envioEmCurso.current || conflito) return;
    if (permitirNome && (!nome.trim() || nome.trim().length > 500)) {
      setErro('Informe um nome com até 500 caracteres.');
      return;
    }
    const alterarNome = permitirNome && nomeEditado && nome.trim() !== rotuloProcedimento({ ...evento, ...original });
    const alterarObservacao = permitirObservacao && observacaoEditada && observacao.trim() !== (original.observacao ?? '').trim();
    const alterarDetalhe = permitirDetalhe && detalheEditado && temDetalheTecnico
      && JSON.stringify(detalhe.valor) !== JSON.stringify(original.detalhe);
    if (!alterarNome && !alterarObservacao && !alterarDetalhe) {
      onFechar();
      return;
    }
    envioEmCurso.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await editarDetalhesEvento({
        eventoId: evento.id,
        procedimentoNome: alterarNome ? nome.trim() : undefined,
        alterarNome,
        detalhe: detalhe.valor,
        alterarDetalhe,
        observacao: permitirObservacao ? observacao : null,
        alterarObservacao,
        original,
      });
      if (!resultado.ok) {
        setErro(resultado.error);
        setConflito(resultado.atual ?? null);
        return;
      }
      toast.success('Procedimento atualizado.');
      onSalvo();
    } catch {
      setErro('Não foi possível confirmar o salvamento. Sua edição foi mantida; tente novamente.');
    } finally {
      envioEmCurso.current = false;
      setSalvando(false);
    }
  }

  async function apagar(): Promise<void> {
    if (envioEmCurso.current) return;
    envioEmCurso.current = true;
    setApagando(true);
    setErro(null);
    try {
      const resultado = await retirarProcedimentoDaFicha({ eventoId: evento.id });
      if (!resultado.ok) {
        setErro(resultado.error ?? 'Não foi possível retirar o procedimento.');
        setConfirmandoExclusao(false);
        return;
      }
      setConfirmandoExclusao(false);
      toast.success('Procedimento retirado da ficha.');
      onExcluido();
      if (revisarOrcamento) onRevisarOrcamento?.();
    } catch {
      setErro('Não foi possível confirmar a retirada. Tente novamente.');
      setConfirmandoExclusao(false);
    } finally {
      envioEmCurso.current = false;
      setApagando(false);
    }
  }

  return (
    <section className="mt-3 rounded-xl border border-teal/35 bg-teal/5 p-3" aria-label="Editar procedimento">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-ink">Editar procedimento</p>
          <p className="mt-1 text-xs text-text-secondary">A edição fica nesta Ficha e registra a alteração no histórico clínico.</p>
        </div>
        <button type="button" onClick={onFechar} disabled={salvando || apagando} className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 text-text-secondary hover:bg-surface hover:text-text-primary" aria-label="Fechar detalhes">
          <X className="h-4 w-4" />
        </button>
      </div>

      {erro && <p id={erroId} role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {conflito && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3 text-sm text-foreground">
          <p className="font-semibold">Versão salva atualmente</p>
          <p>{rotuloProcedimento({ ...evento, ...conflito })}</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{conflito.observacao || 'Sem observação.'}</p>
          {evento.tipo === 'endodontia' && <EndoForm valor={endoDetalheSchema.safeParse(conflito.detalhe).data ?? null} onChange={() => undefined} readOnly />}
          {evento.tipo === 'implante' && <ImplanteForm valor={implanteDetalheSchema.safeParse(conflito.detalhe).data ?? null} onChange={() => undefined} readOnly />}
          <p className="text-muted-foreground">Sua edição continua nos campos abaixo. Confira as diferenças antes de tentar salvar.</p>
          <Button ref={recuperarRef} type="button" variant="outline" className="min-h-11 whitespace-normal" onClick={() => {
            if (!nomeEditado) setNome(rotuloProcedimento({ ...evento, ...conflito }));
            if (!observacaoEditada) setObservacao(conflito.observacao ?? '');
            if (!detalheEditado) setDetalhe(detalheInicial({ tipo: evento.tipo, detalhe: conflito.detalhe }));
            setOriginal(conflito); setConflito(null); setErro(null);
          }}>
            Conferi, manter minha edição
          </Button>
        </div>
      )}

      <fieldset disabled={salvando || apagando}>
      <legend className="sr-only">Campos editáveis do procedimento</legend>
      {permitirNome && (
        <label className="mt-3 grid gap-1.5 text-xs font-bold text-foreground">
          Nome do procedimento
          <input
            value={nome}
            onChange={(event) => { setNome(event.target.value); setNomeEditado(true); }}
            maxLength={500}
            required
            aria-invalid={!!erro && (!nome.trim() || nome.trim().length > 500)}
            aria-describedby={erro ? erroId : undefined}
            className="min-h-11 min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Ex.: Curativo provisório"
          />
        </label>
      )}

      {permitirObservacao && (
        <label className="mt-3 grid gap-1.5 text-xs font-bold text-text-primary">
          Observação clínica
          <textarea
            value={observacao}
            onChange={(event) => { setObservacao(event.target.value); setObservacaoEditada(true); }}
            maxLength={4_000}
            rows={3}
            className="resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal text-text-primary outline-none focus:border-teal"
            placeholder="Material, técnica, intercorrência ou contexto clínico"
          />
        </label>
      )}

      {permitirDetalhe && detalhe.tipo === 'endodontia' && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <EndoForm
            valor={detalhe.valor}
            onChange={(valor) => { setDetalhe({ tipo: 'endodontia', valor }); setDetalheEditado(true); }}
          />
        </div>
      )}

      {permitirDetalhe && detalhe.tipo === 'implante' && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-3">
          <ImplanteForm
            valor={detalhe.valor}
            onChange={(valor) => { setDetalhe({ tipo: 'implante', valor }); setDetalheEditado(true); }}
          />
        </div>
      )}

      </fieldset>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        {permitirExclusao ? (
          <Button variant="ghost" size="sm" className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmandoExclusao(true)} disabled={salvando || apagando}>
            <Trash2 className="h-4 w-4" /> Retirar procedimento
          </Button>
        ) : <span />}
        <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onFechar} disabled={salvando || apagando}>Cancelar</Button>
        <Button size="sm" className="min-h-11" onClick={() => void salvar()} disabled={salvando || apagando || !!conflito}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
        </div>
      </div>

      <AlertDialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar este procedimento da ficha?</AlertDialogTitle>
            <AlertDialogDescription>
              O procedimento sai da ficha ativa e permanece no histórico. O orçamento e os pagamentos só mudam após a revisão no orçamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {onRevisarOrcamento && (
            <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={revisarOrcamento} disabled={apagando} onChange={(event) => setRevisarOrcamento(event.target.checked)} />
              Revisar retirada no orçamento em seguida
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={apagando} onClick={() => void apagar()}>
              {apagando && <Loader2 className="h-4 w-4 animate-spin" />}
              Retirar procedimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
