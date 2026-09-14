'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { CapturaLivreCard } from '@/components/fichas/captura-livre-card';
import { EndoForm } from '@/components/fichas/endo-form';
import { ImplanteForm } from '@/components/fichas/implante-form';
import { Button } from '@/components/ui/button';
import { adicionarProcedimentosFicha } from '@/server/patients/adicionar-procedimentos-ficha';
import { adicionarProcedimentosFichaSchema } from '@/lib/odontograma/adicionar-procedimentos';
import { endoDetalheSchema, type EndoDetalhe } from '@/lib/especialidades/endo';
import { implanteDetalheSchema, type ImplanteDetalhe } from '@/lib/especialidades/implante';
import { hojeBRT } from '@/lib/hora-brt';
import { rotuloProcedimento, type OdontogramaEventoDraft } from '@/types/odontograma';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';

type LoteRascunho = {
  capturaId: string;
  eventos: OdontogramaEventoDraft[];
};

type RascunhoPersistido = {
  texto: string;
  lotes: LoteRascunho[];
};

type LeituraRascunho = {
  rascunho: RascunhoPersistido;
  invalido: boolean;
};

const identificadorDeValidacao = '00000000-0000-4000-8000-000000000000';
const lotePersistidoSchema = z.object({
  capturaId: z.string().uuid(),
  eventos: z.array(z.unknown()),
});

interface AdicionarProcedimentosFichaProps {
  clinicaId: string;
  dentistaId: string;
  fichaId: string;
  pacienteId: string;
  pacienteNome: string;
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  onFechar: () => void;
  onSalvo: () => void;
}

function chaveRascunho({ clinicaId, dentistaId, pacienteId, fichaId }: Pick<AdicionarProcedimentosFichaProps, 'clinicaId' | 'dentistaId' | 'pacienteId' | 'fichaId'>): string {
  return `odontoia:clinical-draft:v1:${clinicaId}:${dentistaId}:${pacienteId}:${fichaId}`;
}

function lerRascunho(chave: string): LeituraRascunho {
  const vazio: RascunhoPersistido = { texto: '', lotes: [] };
  if (typeof window === 'undefined') return { rascunho: vazio, invalido: false };
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return { rascunho: vazio, invalido: false };
    const dado: unknown = JSON.parse(bruto);
    const candidato = z.object({ texto: z.string(), lotes: z.array(z.unknown()) }).safeParse(dado);
    if (!candidato.success) return { rascunho: vazio, invalido: true };

    const lotes: LoteRascunho[] = [];
    for (const loteBruto of candidato.data.lotes) {
      const lote = lotePersistidoSchema.safeParse(loteBruto);
      if (!lote.success) return { rascunho: vazio, invalido: true };
      const eventos = adicionarProcedimentosFichaSchema.safeParse({
        fichaId: identificadorDeValidacao,
        pacienteId: identificadorDeValidacao,
        capturaId: lote.data.capturaId,
        eventos: lote.data.eventos,
      });
      if (!eventos.success) return { rascunho: vazio, invalido: true };
      lotes.push({ capturaId: lote.data.capturaId, eventos: eventos.data.eventos });
    }
    return { rascunho: { texto: candidato.data.texto, lotes }, invalido: false };
  } catch {
    return { rascunho: vazio, invalido: true };
  }
}

function localDoEvento(evento: OdontogramaEventoDraft): string {
  if (evento.ancora.dente != null) return `Dente ${evento.ancora.dente}`;
  if (evento.ancora.nivel === 'arcada') return `Arcada ${evento.ancora.arcada ?? ''}`.trim();
  if (evento.ancora.nivel === 'quadrante') return `Quadrante ${evento.ancora.quadrante ?? ''}`.trim();
  if (evento.ancora.nivel === 'boca') return 'Boca toda';
  return 'Sem localização';
}

function eventosDoDex(data: EvolucaoFormatada, capturaId: string): OdontogramaEventoDraft[] {
  const dataPadrao = hojeBRT();
  return data.odontograma_eventos.map((evento) => {
    const realizadoEmExplicito = 'realizado_em' in evento && typeof evento.realizado_em === 'string'
      ? evento.realizado_em
      : null;
    return {
      ...evento,
      id: crypto.randomUUID(),
      procedimentoId: evento.procedimentoId ?? null,
      procedimentoNome: evento.procedimentoNome ?? null,
      detalhe: evento.detalhe ?? null,
      realizado_em: realizadoEmExplicito ?? (evento.status === 'realizado' && evento.origem === 'clinica' ? dataPadrao : null),
      chaveCaptura: capturaId,
      fonteFluxo: 'novo',
    };
  });
}

export function AdicionarProcedimentosFicha({
  clinicaId,
  dentistaId,
  fichaId,
  pacienteId,
  pacienteNome,
  catalogoProcedimentos,
  onFechar,
  onSalvo,
}: AdicionarProcedimentosFichaProps) {
  const storageKey = useMemo(
    () => chaveRascunho({ clinicaId, dentistaId, pacienteId, fichaId }),
    [clinicaId, dentistaId, fichaId, pacienteId],
  );
  const [texto, setTexto] = useState('');
  const [lotes, setLotes] = useState<LoteRascunho[]>([]);
  const [rascunhoRecuperadoPara, setRascunhoRecuperadoPara] = useState<string | null>(null);
  const [salvandoCapturaId, setSalvandoCapturaId] = useState<string | null>(null);
  const [capturaOcupada, setCapturaOcupada] = useState(false);
  const [revisaoCaptura, setRevisaoCaptura] = useState(0);
  const [armazenamentoInvalido, setArmazenamentoInvalido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [ultimaAdicaoConfirmada, setUltimaAdicaoConfirmada] = useState(false);
  const primeiroNovoId = useRef<string | null>(null);
  const capturaRef = useRef<HTMLDivElement>(null);
  const montadoRef = useRef(true);
  const contextoAtualRef = useRef(storageKey);
  const salvamentoRef = useRef<string | null>(null);
  const tituloId = useId();

  useEffect(() => () => { montadoRef.current = false; }, []);

  useEffect(() => {
    contextoAtualRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    const leitura = lerRascunho(storageKey);
    setTexto(leitura.rascunho.texto);
    setLotes(leitura.rascunho.lotes);
    setArmazenamentoInvalido(leitura.invalido);
    setErro(leitura.invalido ? 'O rascunho local não pôde ser recuperado e não foi aplicado à ficha.' : null);
    setRascunhoRecuperadoPara(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (rascunhoRecuperadoPara !== storageKey || armazenamentoInvalido) return;
    try {
      if (!texto && lotes.length === 0) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      window.localStorage.setItem(storageKey, JSON.stringify({ texto, lotes } satisfies RascunhoPersistido));
    } catch {
      // O rascunho continua nesta sessão; indisponibilidade do storage não pode apagar conteúdo.
    }
  }, [armazenamentoInvalido, lotes, rascunhoRecuperadoPara, storageKey, texto]);

  useEffect(() => {
    const id = primeiroNovoId.current;
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`rascunho-procedimento-${id}`);
      if (!card) return;
      primeiroNovoId.current = null;
      card.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [lotes]);

  function atualizarEvento(capturaId: string, eventoId: string, atualizacao: Partial<OdontogramaEventoDraft>): void {
    setLotes((atuais) => atuais.map((lote) => (
      lote.capturaId !== capturaId ? lote : {
        ...lote,
        eventos: lote.eventos.map((evento) => evento.id === eventoId ? { ...evento, ...atualizacao } : evento),
      }
    )));
  }

  function removerEvento(capturaId: string, eventoId: string): void {
    setLotes((atuais) => atuais.flatMap((lote) => {
      if (lote.capturaId !== capturaId) return [lote];
      const eventos = lote.eventos.filter((evento) => evento.id !== eventoId);
      return eventos.length > 0 ? [{ ...lote, eventos }] : [];
    }));
  }

  function organizar(data: EvolucaoFormatada): boolean {
    const capturaId = crypto.randomUUID();
    const eventos = eventosDoDex(data, capturaId);
    if (eventos.length === 0) {
      setMensagem('O Dex não encontrou uma intervenção para adicionar. Revise o relato e organize novamente.');
      return false;
    }
    primeiroNovoId.current = eventos[0]?.id ?? null;
    setLotes((atuais) => [...atuais, { capturaId, eventos }]);
    setErro(null);
    setUltimaAdicaoConfirmada(false);
    setMensagem(`${eventos.length} procedimento${eventos.length === 1 ? '' : 's'} pronto${eventos.length === 1 ? '' : 's'} para revisão.`);
    return true;
  }

  async function salvarLote(lote: LoteRascunho): Promise<void> {
    if (salvandoCapturaId || salvamentoRef.current) return;
    const nomeInvalido = lote.eventos.some((evento) => (
      evento.tipo === 'outro' && !evento.procedimentoNome?.trim()
    ));
    if (nomeInvalido) {
      setErro('Informe o nome clínico de cada outro procedimento antes de adicionar à ficha.');
      return;
    }
    const contextoNoEnvio = storageKey;
    const tokenEnvio = crypto.randomUUID();
    salvamentoRef.current = tokenEnvio;
    setSalvandoCapturaId(lote.capturaId);
    setErro(null);
    try {
      const resultado = await adicionarProcedimentosFicha({
        fichaId,
        pacienteId,
        capturaId: lote.capturaId,
        eventos: lote.eventos,
      });
      if (!montadoRef.current || contextoAtualRef.current !== contextoNoEnvio) return;
      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }
      setLotes((atuais) => atuais.filter((item) => item.capturaId !== lote.capturaId));
      setUltimaAdicaoConfirmada(true);
      setMensagem(`${resultado.eventoIds.length} procedimento${resultado.eventoIds.length === 1 ? '' : 's'} adicionado${resultado.eventoIds.length === 1 ? '' : 's'} à ficha.`);
      toast.success('Procedimentos adicionados à ficha.');
      onSalvo();
    } catch {
      if (!montadoRef.current || contextoAtualRef.current !== contextoNoEnvio) return;
      setErro('Não foi possível confirmar a adição. Este lote foi mantido para tentar novamente.');
    } finally {
      if (salvamentoRef.current === tokenEnvio) salvamentoRef.current = null;
      if (montadoRef.current && contextoAtualRef.current === contextoNoEnvio) setSalvandoCapturaId(null);
    }
  }

  function descartarRascunhos(): void {
    if (salvandoCapturaId || capturaOcupada) return;
    if (!window.confirm('Descartar o relato e todos os procedimentos ainda não adicionados?')) return;
    setTexto('');
    setLotes([]);
    setErro(null);
    setMensagem(null);
    setUltimaAdicaoConfirmada(false);
    setArmazenamentoInvalido(false);
    setRevisaoCaptura((atual) => atual + 1);
  }

  function descartarArmazenamentoInvalido(): void {
    window.localStorage.removeItem(storageKey);
    setArmazenamentoInvalido(false);
    setErro(null);
  }

  function atualizarStatus(capturaId: string, evento: OdontogramaEventoDraft, valor: 'a_fazer' | 'proxima_sessao' | 'realizado'): void {
    if (valor === 'realizado') {
      atualizarEvento(capturaId, evento.id, {
        status: 'realizado',
        origem: 'clinica',
        momento_planejado: 'sessao_atual',
        realizado_em: evento.realizado_em ?? hojeBRT(),
      });
      return;
    }
    atualizarEvento(capturaId, evento.id, {
      status: 'indicado',
      origem: 'clinica',
      momento_planejado: valor === 'proxima_sessao' ? 'proxima_sessao' : 'sessao_atual',
      realizado_em: null,
    });
  }

  function adicionarMais(): void {
    capturaRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'center',
    });
    capturaRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
  }

  const temRascunho = texto.trim().length > 0 || lotes.length > 0;
  const bloqueado = salvandoCapturaId !== null;

  return (
    <section className="mt-4 rounded-xl border border-teal/35 bg-teal/5 p-3 sm:p-4" aria-labelledby={tituloId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id={tituloId} className="text-xs font-bold uppercase tracking-[0.14em] text-teal-ink">Adicionar procedimentos</p>
          <p className="mt-1 text-xs text-text-secondary">Registre pelo relato; revise cada item antes de incluir nesta ficha.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onFechar}>
          <ChevronUp className="h-4 w-4" /> Recolher
        </Button>
      </div>

      <div ref={capturaRef} className="mt-3">
        {rascunhoRecuperadoPara === storageKey && (
          <CapturaLivreCard
            key={`${storageKey}:${revisaoCaptura}`}
            pacienteNome={pacienteNome}
            textoInicial={texto}
            onTextoChange={setTexto}
            formDirty={lotes.length > 0}
            aplicacao="acrescentar"
            compact
            catalogoProcedimentos={catalogoProcedimentos}
            onOrganizado={organizar}
            onCapturaStateChange={(estado) => setCapturaOcupada(estado.busy)}
          />
        )}
      </div>

      {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}
      {armazenamentoInvalido && (
        <Button type="button" variant="ghost" size="sm" disabled={bloqueado || capturaOcupada} className="mt-2 min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={descartarArmazenamentoInvalido}>
          Descartar rascunho inválido
        </Button>
      )}
      {mensagem && <p role="status" aria-live="polite" className="mt-3 text-sm text-text-secondary">{mensagem}</p>}
      {ultimaAdicaoConfirmada && lotes.length === 0 && (
        <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={adicionarMais}>
          <Plus className="h-4 w-4" /> Adicionar mais
        </Button>
      )}

      {lotes.length > 0 && (
        <div className="mt-4 space-y-4">
          {lotes.map((lote, indiceLote) => (
            <div key={lote.capturaId} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-text-primary">Revisão {indiceLote + 1}</p>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  disabled={bloqueado}
                  onClick={() => void salvarLote(lote)}
                >
                  {salvandoCapturaId === lote.capturaId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Adicionar à ficha
                </Button>
              </div>
              {lote.eventos.map((evento) => {
                const nome = evento.procedimentoNome ?? rotuloProcedimento(evento);
                return (
                  <article key={evento.id} id={`rascunho-procedimento-${evento.id}`} className="scroll-mt-24 rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                        <span className="rounded-full bg-surface-alt px-2 py-1 text-text-primary">{localDoEvento(evento)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerEvento(lote.capturaId, evento.id)}
                        disabled={bloqueado}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>
                    <fieldset disabled={bloqueado} className="contents disabled:opacity-60">
                      <legend className="sr-only">Detalhes do procedimento</legend>
                      <label className="mt-3 grid gap-1.5 text-xs font-bold text-foreground">
                        Situação do procedimento
                        <select
                          value={evento.status === 'realizado' ? 'realizado' : evento.momento_planejado === 'proxima_sessao' ? 'proxima_sessao' : 'a_fazer'}
                          onChange={(eventInput) => atualizarStatus(lote.capturaId, evento, eventInput.target.value as 'a_fazer' | 'proxima_sessao' | 'realizado')}
                          className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="a_fazer">A fazer</option>
                          <option value="proxima_sessao">Próxima sessão</option>
                          <option value="realizado">Realizado</option>
                        </select>
                      </label>
                      <label className="mt-3 grid gap-1.5 text-xs font-bold text-foreground">
                        Nome do procedimento
                        <input
                          value={nome}
                          maxLength={500}
                          onChange={(eventInput) => atualizarEvento(lote.capturaId, evento.id, { procedimentoNome: eventInput.target.value })}
                          className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-base font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                      <label className="mt-3 grid gap-1.5 text-xs font-bold text-foreground">
                        Observação clínica
                        <textarea
                          value={evento.observacao}
                          maxLength={4_000}
                          rows={2}
                          onChange={(eventInput) => atualizarEvento(lote.capturaId, evento.id, { observacao: eventInput.target.value })}
                          className="resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                      {evento.tipo === 'endodontia' && (
                        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                          <EndoForm
                            valor={endoDetalheSchema.safeParse(evento.detalhe).data ?? null}
                            onChange={(detalhe: EndoDetalhe) => atualizarEvento(lote.capturaId, evento.id, { detalhe })}
                          />
                        </div>
                      )}
                      {evento.tipo === 'implante' && (
                        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
                          <ImplanteForm
                            valor={implanteDetalheSchema.safeParse(evento.detalhe).data ?? null}
                            onChange={(detalhe: ImplanteDetalhe) => atualizarEvento(lote.capturaId, evento.id, { detalhe })}
                          />
                        </div>
                      )}
                    </fieldset>
                  </article>
                );
              })}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={capturaOcupada} onClick={adicionarMais}>
              <Plus className="h-4 w-4" /> Adicionar mais
            </Button>
            {temRascunho && (
              <Button type="button" variant="ghost" className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={bloqueado || capturaOcupada} onClick={descartarRascunhos}>
                Descartar rascunhos
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
