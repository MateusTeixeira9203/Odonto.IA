'use client';

import { useId, useRef, useState } from 'react';
import { Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { editarEvolucaoClinica } from '@/server/patients/editar-evolucao-clinica';
import type { ProntuarioAtendimento, ProntuarioEvolucao } from '@/server/patients/get-prontuario-longitudinal';

type Props = { atendimento: ProntuarioAtendimento; pacienteId: string; dentistaId: string; canWrite: boolean };

/** Edição textual da visita em exibição, independente da captura de procedimentos. */
export function EvolucaoClinicaFicha({ atendimento, pacienteId, dentistaId, canWrite }: Props) {
  const blocoRef = useRef<HTMLElement>(null);
  const botaoPrefixo = useId();
  function fecharEditor(id: string): void {
    setEditandoId(null);
    requestAnimationFrame(() => {
      const botao = document.getElementById(`${botaoPrefixo}-${id}`)
        ?? blocoRef.current?.querySelector<HTMLButtonElement>('[data-editar-evolucao]');
      botao?.focus();
    });
  }
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<Record<string, { anterior: string | null; texto: string | null }>>({});
  const registros: ProntuarioEvolucao[] = atendimento.evolucoes.length > 0
    ? atendimento.evolucoes
    : atendimento.fichas.map((ficha) => ({
      id: `nova:${ficha.id}`, fichaId: ficha.id, texto: null, automatica: false,
      data: atendimento.dataAtendimento, profissional: atendimento.profissional,
    }));
  const podeEditar = (registro: ProntuarioEvolucao): boolean => {
    const ficha = atendimento.fichas.find((item) => item.id === registro.fichaId);
    return canWrite && !registro.automatica && registro.profissional.id === dentistaId
      && !!ficha && !ficha.assinadoEm && !ficha.assinaturaUrl;
  };
  const unico = registros.length === 1 ? registros[0] : null;
  const botaoEditar = (registro: ProntuarioEvolucao) => (
    <Button id={`${botaoPrefixo}-${registro.id}`} data-editar-evolucao type="button" className="min-h-11 w-full sm:w-auto" variant="outline"
      disabled={editandoId !== null} onClick={() => setEditandoId(registro.id)}>
      <Pencil className="h-4 w-4" /> Editar evolução clínica
    </Button>
  );

  return (
    <article ref={blocoRef} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Evolução clínica</p>
          <p className="mt-1 text-xs text-text-secondary">Registro da consulta em exibição.</p>
        </div>
        {unico && podeEditar(unico) && editandoId === null && botaoEditar(unico)}
      </div>
      <div className="mt-3 space-y-3">
        {registros.map((registro) => {
          const confirmado = confirmados[registro.id];
          const texto = confirmado && registro.texto === confirmado.anterior ? confirmado.texto : registro.texto;
          return (
            <div key={registro.id} className="border-l-2 border-teal/40 pl-3">
              {editandoId === registro.id ? (
                <EditorEvolucao key={registro.id} registro={registro} textoOriginal={texto}
                  atendimentoId={atendimento.atendimentoId} pacienteId={pacienteId}
                  onCancelar={() => fecharEditor(registro.id)}
                  onSalvo={(salvo) => {
                    setConfirmados((atuais) => ({ ...atuais, [registro.id]: { anterior: registro.texto, texto: salvo } }));
                    fecharEditor(registro.id);
                  }} />
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {texto?.trim() || 'Sem evolução textual registrada.'}
                </p>
              )}
              <p className="mt-1 text-xs text-text-secondary">
                {registro.automatica ? 'Registro automático do sistema' : registro.profissional.nome}
              </p>
              {!unico && podeEditar(registro) && editandoId !== registro.id && (
                <div className="mt-2">{botaoEditar(registro)}</div>
              )}
            </div>
          );
        })}
        {registros.length === 0 && <p className="text-sm italic text-muted-foreground">Sem evolução textual registrada.</p>}
      </div>
    </article>
  );
}

function EditorEvolucao({ registro, textoOriginal, pacienteId, atendimentoId, onCancelar, onSalvo }: {
  registro: ProntuarioEvolucao; textoOriginal: string | null; pacienteId: string; atendimentoId: string | null;
  onCancelar: () => void; onSalvo: (texto: string | null) => void;
}) {
  const campoId = useId();
  const [texto, setTexto] = useState(textoOriginal ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function salvar(): Promise<void> {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await editarEvolucaoClinica({
        pacienteId, fichaId: registro.fichaId, atendimentoId,
        evolucaoId: registro.id.startsWith('texto-legado:') || registro.id.startsWith('nova:') ? null : registro.id,
        textoOriginal, texto,
      });
      if (!resultado.ok) { setErro(resultado.error); return; }
      onSalvo(resultado.texto);
    } catch {
      setErro('Não foi possível salvar a evolução. Seu texto foi mantido para tentar novamente.');
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); void salvar(); }} className="space-y-3">
      <label htmlFor={campoId} className="text-sm font-medium text-foreground">Evolução clínica</label>
      <Textarea id={campoId} autoFocus value={texto} onChange={(event) => setTexto(event.target.value)}
        rows={6} maxLength={20000} disabled={salvando} aria-invalid={!!erro}
        aria-describedby={erro ? `${campoId}-erro` : undefined} />
      {erro && <p id={`${campoId}-erro`} role="alert" className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={salvando} onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" className="min-h-11" disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {salvando ? 'Salvando' : 'Salvar evolução'}
        </Button>
      </div>
    </form>
  );
}
