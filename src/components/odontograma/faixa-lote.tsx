'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { criarProcedimento } from '@/app/dashboard/configuracoes/actions';
import { casarProcedimentoLocal, type SugestaoLocal } from '@/lib/odontograma/casar-procedimento-local';
import {
  CHIPS_LOTE, FACES_LOTE, acrescentarRestauracoesDoLote,
  eventosDoLote, eventosDoLoteAusente, eventosDoLoteAvulso, eventosDoLoteRestauracao,
} from '@/lib/odontograma/lote-multidente';
import { TEETH_UPPER, TEETH_LOWER } from './Odontograma';
import { restauracaoPodeAplicar } from './restauracao-pode-aplicar';
import type { ContextoLancamento } from '@/lib/odontograma/criar-eventos-contextuais';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';
import { ehDenteAnteriorFDI, faceAbreviacao, faceLabel, TIPO_LABEL, type FaceDental, type ModoLancamento, type OdontogramaEventoDraft, type TipoRegistroOdontograma } from '@/types/odontograma';

const MODOS: Array<{ id: ModoLancamento; label: string }> = [
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'realizado_hoje', label: 'Realizado hoje' },
  { id: 'proxima_sessao', label: 'Próxima sessão' },
  { id: 'preexistente', label: 'Pré-existente' },
];

/**
 * R-109 — a faixa de lote multidente, extraída de `registrar-painel.tsx` (R-107d) pra que a
 * ficha monte a MESMA faixa em vez de uma cópia. **Porte, não redesenho** (spec §6): mesmo
 * contador, mesmos chips, mesma busca, mesmas classes.
 *
 * A **seleção** é controlada (`dentes` vem de fora — cada tela tem o seu jeito de selecionar).
 * O estado interno da faixa (busca, face pendente, item de catálogo, preço) é dela: é UI
 * efêmera que morre junto com a seleção, e passar isso pra fora só criaria acoplamento.
 *
 * **Desvio consciente do §4.1/§4.2 da spec:** o toggle "Modo multidente" **não** entra aqui. No
 * Meu dia ele vive no cabeçalho do odontograma, longe da faixa; trazer pra dentro mudaria o
 * layout daquela tela — e "o Meu dia não muda em nada" é invariante do item. A faixa recebe só
 * `onModoMultidenteChange`, porque precisa **desligar** o modo ao aplicar (R-107d: aplicar é o
 * sinal de "terminei de selecionar"); quem desenha o botão continua sendo cada tela.
 */
export interface FaixaLoteProps {
  variante?: 'meu-dia';
  /** Dentes selecionados. A faixa aparece com 1+; com vários, aplica em lote. */
  dentes: number[];
  eventosDraft: OdontogramaEventoDraft[];
  onEventosDraftChange: Dispatch<SetStateAction<OdontogramaEventoDraft[]>>;
  /** Autor da aplicação nova; usado apenas para distinguir intenções clínicas do lote. */
  autorDentistaId?: string;
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  /** 'YYYY-MM-DD' — `realizado_em` dos eventos criados em lote. */
  dataPadrao: string;
  /** R-125a — decisão explícita do dentista aplicada a qualquer ação rápida. */
  modoLancamento: ModoLancamento;
  onModoLancamentoChange: (modo: ModoLancamento) => void;
  onLimpar: () => void;
  onModoMultidenteChange: (v: boolean) => void;
  /** Com um único dente, abre o painel completo apenas por gesto explícito. */
  onAbrirDetalheDental?: (dente: number) => void;
  /** R-130 — abre o fluxo seguro de ponte já no pilar selecionado. */
  onIniciarPonte?: (dente: number) => void;
  onDuplicataIgnorada?: (dentes: number[], rotulo: string) => void;
}

export function FaixaLote({
  dentes: dentesSelecionados, eventosDraft, onEventosDraftChange, autorDentistaId, catalogoProcedimentos, dataPadrao,
  modoLancamento, onModoLancamentoChange, onLimpar, onModoMultidenteChange, onAbrirDetalheDental,
  onIniciarPonte, onDuplicataIgnorada, variante,
}: FaixaLoteProps) {
  const meuDia = variante === 'meu-dia';
  const dentes = meuDia ? [...dentesSelecionados].sort((a, b) => a - b) : dentesSelecionados;
  const chipClass = meuDia
    ? 'rounded-[20px] border border-border bg-surface px-[13px] py-[7px] text-[13px] leading-[20.8px] text-text-primary hover:border-teal-ink hover:bg-teal-pale'
    : 'rounded-full border border-teal/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-teal-ink hover:bg-teal/10';
  const [facePendente, setFacePendente] = useState(false);
  const [avisoRestauracao, setAvisoRestauracao] = useState(false);
  const [facesSelecionadas, setFacesSelecionadas] = useState<FaceDental[]>([]);
  const [busca, setBusca] = useState('');
  const [catalogoPendente, setCatalogoPendente] = useState<MeuDiaCatalogoProcedimento | null>(null);
  const [avulso, setAvulso] = useState<string | null>(null);
  const [precoCatalogo, setPrecoCatalogo] = useState<string | null>(null);
  const [salvandoCatalogo, setSalvandoCatalogo] = useState(false);

  const sugestoes: SugestaoLocal[] = useMemo(
    () => (busca.trim() ? casarProcedimentoLocal(busca, catalogoProcedimentos) : []),
    [busca, catalogoProcedimentos],
  );

  /** Só o que a faixa sabe aplicar: tipo com chip em `CHIPS_LOTE`, ou item de catálogo (que
   *  vira pergunta de tipo). Restauração nunca vem por aqui — o chip dela é o único caminho
   *  pro seletor de face. */
  const sugestoesUteis = sugestoes.filter((s) => s.catalogo || (s.tipo && CHIPS_LOTE.includes(s.tipo)));

  function faceLabelLote(face: FaceDental): string {
    if (face !== 'O') return face;
    const temAnterior = dentes.some(ehDenteAnteriorFDI);
    const temPosterior = dentes.some((dente) => !ehDenteAnteriorFDI(dente));
    if (temAnterior && temPosterior) return 'I/O';
    return faceAbreviacao(face, dentes[0]);
  }

  function faceAriaLabelLote(face: FaceDental): string {
    if (face !== 'O') return `Face ${face}`;
    const temAnterior = dentes.some(ehDenteAnteriorFDI);
    const temPosterior = dentes.some((dente) => !ehDenteAnteriorFDI(dente));
    if (temAnterior && temPosterior) return 'Face incisal ou oclusal';
    return `Face ${faceLabel(face, dentes[0])}`;
  }

  if (dentes.length === 0) return null;

  function contexto(modo: ModoLancamento = modoLancamento): ContextoLancamento {
    return { capturaId: crypto.randomUUID(), modo };
  }

  function aplicar(
    tipo: TipoRegistroOdontograma,
    procedimento?: { id: string | null; nome: string | null },
  ) {
    const novos = eventosDoLote(
      tipo,
      dentes,
      eventosDraft,
      dataPadrao,
      contexto(),
      procedimento,
    );
    const ignorados = dentes.filter((dente) => !novos.some((evento) => evento.ancora.dente === dente));
    if (ignorados.length) onDuplicataIgnorada?.(ignorados, procedimento?.nome ?? TIPO_LABEL[tipo]);
    if (novos.length > 0) onEventosDraftChange([...eventosDraft, ...novos]);
    onModoMultidenteChange(false);
  }

  function alternarFaceRestauracao(face: FaceDental) {
    if (meuDia) setAvisoRestauracao(false);
    setFacesSelecionadas((atuais) => (
      atuais.includes(face) ? atuais.filter((item) => item !== face) : [...atuais, face]
    ));
  }

  function aplicarRestauracao() {
    if (facesSelecionadas.length === 0) return;
    const contextoAtual = contexto();
    const novos = facesSelecionadas.flatMap((face) => (
      eventosDoLoteRestauracao(face, dentes, dataPadrao, contextoAtual, autorDentistaId)
    ));
    if (onDuplicataIgnorada) {
      const aceitos = new Set(acrescentarRestauracoesDoLote(eventosDraft, novos).map((evento) => evento.id));
      const ignorados = [...new Set(novos.filter((evento) => !aceitos.has(evento.id)).flatMap((evento) => evento.ancora.dente == null ? [] : [evento.ancora.dente]))];
      if (ignorados.length) onDuplicataIgnorada(ignorados, `${TIPO_LABEL.carie_restauracao} ${facesSelecionadas.join('')}`);
    }
    onEventosDraftChange((atuais) => acrescentarRestauracoesDoLote(atuais, novos));
    setFacesSelecionadas([]);
    setFacePendente(false);
    onModoMultidenteChange(false);
  }

  function aplicarAusente() {
    const novos = eventosDoLoteAusente(dentes, eventosDraft, dataPadrao, contexto('preexistente'));
    const ignorados = dentes.filter((dente) => !novos.some((evento) => evento.ancora.dente === dente));
    if (ignorados.length) onDuplicataIgnorada?.(ignorados, 'Dente ausente');
    if (novos.length > 0) onEventosDraftChange([...eventosDraft, ...novos]);
    onModoMultidenteChange(false);
  }

  function aplicarSugestao(s: SugestaoLocal) {
    if (s.catalogo) { setCatalogoPendente(s.catalogo); return; }
    if (s.tipo && CHIPS_LOTE.includes(s.tipo)) aplicar(s.tipo);
    setBusca('');
  }

  function lancarAvulso() {
    const texto = busca.trim();
    if (!texto) return;
    onEventosDraftChange([...eventosDraft, ...eventosDoLoteAvulso(texto, dentes, dataPadrao, contexto())]);
    setAvulso(texto);
    setBusca('');
    setCatalogoPendente(null);
    onModoMultidenteChange(false);
  }

  /** Reusa `criarProcedimento` tal qual — 1 chamada só: o nome/preço valem pros N dentes do
   *  lote, não 1 por dente. */
  async function salvarNoCatalogo() {
    if (!avulso || precoCatalogo == null) return;
    const preco = Number(precoCatalogo.replace(',', '.'));
    if (!Number.isFinite(preco) || preco < 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setSalvandoCatalogo(true);
    try {
      const res = await criarProcedimento({
        nome: avulso, descricao: '', categoria: 'Outros',
        preco_padrao: preco, duracao_minutos: 30,
      });
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      toast.success(`"${avulso}" salvo no seu catálogo.`);
      setAvulso(null);
      setPrecoCatalogo(null);
    } catch {
      toast.error('Falha de conexão. Tente novamente.');
    } finally {
      setSalvandoCatalogo(false);
    }
  }

  function limpar() {
    setBusca('');
    setCatalogoPendente(null);
    setFacePendente(false);
    setFacesSelecionadas([]);
    setAvulso(null);
    setPrecoCatalogo(null);
    onLimpar();
  }

  return (
    <div className={meuDia ? "flex min-w-0 flex-col" : "rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 flex flex-col gap-1.5"}>
      <div className="flex items-center justify-between gap-2">
        <p className={meuDia ? "text-[15px] font-bold leading-6 text-text-primary" : "text-[11px] font-semibold text-text-primary"}>
          {meuDia
            ? dentes.length === 1 ? `Dente ${dentes[0]}` : `${dentes.length} dentes: ${dentes.join(', ')}`
            : dentes.length === 1 ? `Dente ${dentes[0]} selecionado` : `${dentes.length} dentes selecionados: ${dentes.join(', ')}`}
        </p>
        <div className="flex items-center gap-2">
          {dentes.length === 1 && onAbrirDetalheDental && (
            <button
              type="button"
              onClick={() => onAbrirDetalheDental(dentes[0])}
              className="text-[11px] font-semibold text-teal-ink hover:text-teal"
            >
              {meuDia ? 'Detalhe do dente' : 'Abrir detalhe dental'}
            </button>
          )}
          <button
            type="button"
            onClick={limpar}
            aria-label="Limpar seleção"
            title="Limpar seleção"
            className="rounded p-0.5 text-text-secondary transition-colors hover:bg-coral/10 hover:text-coral focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {meuDia && <p className="mb-[6px] mt-[10px] text-[12.5px] leading-5 text-text-secondary">Registrar como</p>}
      <div className={meuDia ? "flex w-fit max-w-full flex-wrap overflow-hidden rounded-[8px] border border-border" : "flex flex-wrap items-center gap-1.5"} aria-label="Como registrar os procedimentos selecionados">
        {!meuDia && <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Registrar como</span>}
        {MODOS.map((modo) => (
          <button
            key={modo.id}
            type="button"
            aria-pressed={modoLancamento === modo.id}
            onClick={() => onModoLancamentoChange(modo.id)}
            className={meuDia
              ? `px-[11px] py-[6px] text-[13px] leading-[20.8px] transition-colors ${modoLancamento === modo.id ? 'bg-teal-pale font-semibold text-teal-ink' : 'text-text-secondary hover:bg-teal-pale'}`
              : `rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
              modoLancamento === modo.id
                ? 'border-teal bg-teal/15 text-teal-ink'
                : 'border-border bg-surface text-text-secondary hover:border-teal/40 hover:text-teal-ink'
            }`}
          >
            {modo.label}
          </button>
        ))}
      </div>

      {(facePendente || meuDia) && (
        <div className={meuDia ? "mt-[10px] flex flex-wrap items-center gap-[5px]" : "flex flex-wrap items-center gap-1.5"}>
          <span className={meuDia ? "mb-px w-full text-[12.5px] leading-5 text-text-secondary" : "text-[10px] font-bold uppercase tracking-wider text-text-secondary"}>
            {meuDia ? 'Faces' : 'Restauração — selecione uma ou mais faces'}
          </span>
          {(meuDia ? [...FACES_LOTE].sort((a, b) => 'MODVL'.indexOf(a) - 'MODVL'.indexOf(b)) : FACES_LOTE).map((face) => (
            <button
              key={face}
              type="button"
              aria-label={faceAriaLabelLote(face)}
              aria-pressed={facesSelecionadas.includes(face)}
              onClick={() => alternarFaceRestauracao(face)}
              className={meuDia
                ? `h-[32px] w-[34px] rounded-[6px] border text-[13px] transition-colors ${facesSelecionadas.includes(face) ? 'border-teal-ink bg-teal-pale font-bold text-teal-ink' : 'border-border text-text-secondary hover:bg-teal-pale'}`
                : `rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                facesSelecionadas.includes(face)
                  ? 'border-teal bg-teal text-white'
                  : 'border-teal/30 bg-surface text-teal-ink hover:bg-teal/10'
              }`}
            >
              {faceLabelLote(face)}
            </button>
          ))}
          {meuDia && avisoRestauracao && facesSelecionadas.length === 0 && (
            <p role="status" className="w-full text-[12.5px] leading-5 text-text-secondary">
              Escolha ao menos uma face para a Restauração
            </p>
          )}
          {!meuDia && <><button
            type="button"
            disabled={facesSelecionadas.length === 0}
            onClick={aplicarRestauracao}
            className="rounded-md bg-teal px-2.5 py-1 text-[11px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar {facesSelecionadas.length === 1 ? 'face' : `${facesSelecionadas.length} faces`}
          </button>
          <button
            type="button"
            onClick={() => { setFacesSelecionadas([]); setFacePendente(false); }}
            className="text-[11px] font-semibold text-text-secondary hover:text-coral"
          >
            Cancelar
          </button></>}
        </div>
      )}
      {(!facePendente || meuDia) && (
        <>
        {meuDia && <p className="mb-[6px] mt-[10px] text-[12.5px] leading-5 text-text-secondary">Procedimento</p>}
        <div className="flex flex-wrap gap-1.5">
          {CHIPS_LOTE.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => aplicar(tipo)}
              className={chipClass}
            >
              {TIPO_LABEL[tipo]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (meuDia) {
                if (!restauracaoPodeAplicar(facesSelecionadas, variante)) {
                  setAvisoRestauracao(true);
                  return;
                }
                aplicarRestauracao();
              } else setFacePendente(true);
            }}
            className={meuDia ? `order-first ${chipClass}` : chipClass}
          >
            {meuDia ? 'Restauração' : 'Restauração ▾'}
          </button>
          <button
            type="button"
            onClick={aplicarAusente}
            className={chipClass}
          >
            Dente ausente
          </button>
          {dentes.length === 1 && onIniciarPonte && (!meuDia || TEETH_UPPER.includes(dentes[0]) || TEETH_LOWER.includes(dentes[0])) && (
            <button
              type="button"
              onClick={() => onIniciarPonte(dentes[0])}
              className={chipClass}
            >
              Ponte fixa
            </button>
          )}
        </div>
        </>
      )}

      {(!facePendente || meuDia) && (
        <div className="flex flex-col gap-1.5">
          <div className={meuDia ? "mt-[10px] flex items-center" : "flex items-center gap-1.5"}>
            {!meuDia && <Search size={12} strokeWidth={2.4} className="text-text-muted shrink-0" aria-hidden />}
            <input
              type="text"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setCatalogoPendente(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setBusca(''); setCatalogoPendente(null); return; }
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (sugestoes.length > 0) aplicarSugestao(sugestoes[0]);
                else lancarAvulso();
              }}
              placeholder={meuDia ? "Outro procedimento… (Enter adiciona)" : "Outro procedimento pros dentes selecionados"}
              aria-label="Buscar ou digitar procedimento pros dentes selecionados"
              className={meuDia ? "min-w-0 flex-1 rounded-[8px] border border-border bg-bg px-[10px] py-[8px] text-[13px] leading-[20.8px] text-text-primary outline-none focus:border-teal-ink" : "min-w-0 flex-1 rounded-md border border-border bg-surface-alt px-2 py-1 text-[11px] text-text-primary outline-none focus:border-teal"}
            />
          </div>

          {catalogoPendente ? (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10.5px] font-semibold text-text-primary">
                &ldquo;{catalogoPendente.nome}&rdquo; — qual tipo clínico?
              </span>
              {CHIPS_LOTE.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    aplicar(tipo, { id: catalogoPendente.id, nome: catalogoPendente.nome });
                    setBusca('');
                    setCatalogoPendente(null);
                  }}
                  className="rounded-full border border-teal/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-teal-ink"
                >
                  {TIPO_LABEL[tipo]}
                </button>
              ))}
            </div>
          ) : busca.trim() && (
            <div className="flex flex-wrap gap-1">
              {sugestoesUteis.map((s, i) => (
                <button
                  key={`${s.tipo ?? s.catalogo?.id}-${i}`}
                  type="button"
                  onClick={() => aplicarSugestao(s)}
                  className="rounded-full border border-teal/30 bg-surface px-2 py-0.5 text-[10px] font-semibold text-teal-ink"
                >
                  {s.tipo ? TIPO_LABEL[s.tipo] : s.catalogo?.nome}
                </button>
              ))}
              {sugestoesUteis.length === 0 && (
                <button
                  type="button"
                  onClick={lancarAvulso}
                  className="rounded-full bg-teal px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Lançar &ldquo;{busca.trim()}&rdquo; nos {dentes.length} dentes
                </button>
              )}
            </div>
          )}

          {avulso && (
            precoCatalogo == null ? (
              <button
                type="button"
                onClick={() => setPrecoCatalogo('')}
                className="w-fit text-[10.5px] font-semibold text-teal-ink"
              >
                + Salvar &ldquo;{avulso}&rdquo; no meu catálogo
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={precoCatalogo}
                  onChange={(e) => setPrecoCatalogo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void salvarNoCatalogo(); } }}
                  placeholder="0,00"
                  autoFocus
                  aria-label={`Preço de ${avulso} no catálogo`}
                  className="w-24 rounded-md border border-border bg-surface-alt px-2 py-1 text-[11px] font-mono text-text-primary outline-none focus:border-teal"
                />
                <button
                  type="button"
                  onClick={() => void salvarNoCatalogo()}
                  disabled={salvandoCatalogo}
                  className="rounded-md bg-teal px-2 py-1 text-[10.5px] font-bold text-white disabled:opacity-40"
                >
                  {salvandoCatalogo ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPrecoCatalogo(null); setAvulso(null); }}
                  className="text-[10.5px] font-semibold text-text-secondary"
                >
                  Agora não
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
