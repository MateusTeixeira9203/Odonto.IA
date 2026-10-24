'use client';

import { Fragment, useCallback, useEffect, useEffectEvent, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type Dispatch, type SetStateAction, type KeyboardEvent, type Ref } from 'react';
import { Mic, MicOff, MoreHorizontal, Paperclip, X, Zap } from 'lucide-react';
import { useCapturaLivre } from '@/hooks/useCapturaLivre';
import { VoiceUX } from '@/components/fichas/voice-ux';
import { corpoEspecialidadeEditavel } from '@/components/fichas/corpo-especialidade';
import { endoDetalheSchema } from '@/lib/especialidades/endo';
import { extrairEndoDeterministico } from '@/lib/especialidades/extrair-endo-deterministico';
import { mesclarDetalheEndo } from '@/lib/especialidades/mesclar-endo-extracao';
import { DexLoader } from '@/components/ui/dex-loader';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { extrairTextoDeArquivo } from '@/lib/dex/extrair-texto-arquivo';
import { MAX_DEX_TEXT_CHARS } from '@/lib/dex/schemas';
import { casarProcedimentoLocal, type SugestaoLocal } from '@/lib/odontograma/casar-procedimento-local';
import {
  acrescentarTexto, editarTexto, aplicarOrganizacao, definirPontoInsercao, relatoParaDex,
  reconhecerDocumento, removerPendente, restaurarPendente, inserirTextoEm, apagarSeVazio, vizinho, resolverPendente, sincronizarEventos, semNovasDuplicatas,
  type DocumentoAtendimento, type OrigemTexto, type BlocoProcedimento, type BlocoPendente, type Bloco, type PosicaoTexto,
} from '@/lib/meu-dia/documento-atendimento';
import { DENTES_FDI } from '@/lib/odonto-dictionary';
import { fragmentarRelatoClinico } from '@/lib/odontograma/estado-ausencia';
import { criarEventosContextuais } from '@/lib/odontograma/criar-eventos-contextuais';
import { hojeBRT } from '@/lib/hora-brt';
import { rotuloProcedimento, type AncoraClinica, type FaceDental, type OdontogramaEventoDraft, type TipoRegistroOdontograma } from '@/types/odontograma';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';
import type { CapturaDexState } from '@/components/fichas/captura-livre-card';
import { ondeLabel } from './meu-dia-format';

export interface DocumentoControlado {
  onRecarregar?: () => void;
  acoes?: Ref<{ organizar: () => void; corrigirPendentes: () => void }>;
  valor: DocumentoAtendimento;
  onChange: Dispatch<SetStateAction<DocumentoAtendimento>>;
  onBloqueioChange: (bloqueado: boolean) => void;
  textoVisita?: string;
  onTextoVisitaChange?: (texto: string) => void;
  idsDeAntes?: ReadonlySet<string>;
  destinosEncaminhar?: { id: string; nome: string; especialidade?: string }[];
  onAbrirDenteGrande?: (dente: number, eventoId: string) => void;
}

interface DocumentoAtendimentoProps {
  documento: DocumentoControlado;
  pacienteNome: string;
  eventos: OdontogramaEventoDraft[];
  onEventosChange: (eventos: OdontogramaEventoDraft[]) => void;
  catalogo: MeuDiaCatalogoProcedimento[];
  onAplicarSugestao: (sugestao: SugestaoLocal) => void;
  onOrganizado: (data: EvolucaoFormatada, relato: string) => OdontogramaEventoDraft[];
  anexarTexto?: { texto: string; nonce: number; origem: 'audio' | 'documento' };
  onCapturaStateChange?: (state: CapturaDexState) => void;
}

const botaoBase = 'inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-teal disabled:opacity-50';
const botao = `${botaoBase} text-text-secondary`;
const facesDaLinha: FaceDental[] = ['M', 'O', 'D', 'V', 'L'];
const tiposDeBoca = new Set<TipoRegistroOdontograma>(['profilaxia', 'clareamento', 'fluor', 'exame_periodontal']);

/** Só no documento: uma tabela editada é a âncora das próximas leituras do mesmo tratamento. */
export function mesclarTabelasDocumento(atuais: OdontogramaEventoDraft[], propostas: OdontogramaEventoDraft[], relato: string) {
  let eventos = [...atuais];
  const novos: OdontogramaEventoDraft[] = [];
  const extracao = extrairEndoDeterministico(relato, propostas.filter((evento) => evento.tipo === 'endodontia').flatMap((evento) => evento.ancora.dente == null ? [] : [evento.ancora.dente]));
  for (const proposta of propostas) {
    const candidatos = eventos.filter((evento) => !evento.assinaturaId && evento.detalhe != null && evento.tipo === proposta.tipo && evento.ancora.dente != null && evento.ancora.dente === proposta.ancora.dente && (evento.tipo === 'endodontia' || evento.tipo === 'implante'));
    const alvo = candidatos.length === 1 ? candidatos[0] : proposta;
    let atualizado = alvo;
    if (proposta.tipo === 'endodontia') {
      const recebido = endoDetalheSchema.safeParse(proposta.detalhe);
      const local = extracao.ok ? extracao.extracoes.find((item) => item.dente === proposta.ancora.dente) : undefined;
      for (const entrada of [recebido.success ? { detalhe: recebido.data, origem: 'ia' as const } : null, local ? { detalhe: local.detalhe, origem: 'deterministico' as const } : null]) {
        if (!entrada) continue;
        const anterior = endoDetalheSchema.safeParse(atualizado.detalhe);
        const mescla = mesclarDetalheEndo(anterior.success ? anterior.data : null, entrada.detalhe, atualizado.endo_revisao, entrada.origem);
        atualizado = { ...atualizado, detalhe: mescla.detalhe, endo_revisao: { ...mescla.revisao, duvidas: [...mescla.revisao.duvidas, ...(entrada.origem === 'deterministico' ? local?.duvidas ?? [] : [])] } };
      }
    }
    if (alvo !== proposta) eventos = eventos.map((evento) => evento.id === alvo.id ? atualizado : evento);
    else { eventos.push(atualizado); novos.push(atualizado); }
  }
  return { eventos, novos };
}

function ajustarAltura(elemento: HTMLTextAreaElement | null) {
  if (!elemento) return;
  elemento.style.height = 'auto';
  elemento.style.height = `${elemento.scrollHeight}px`;
}

function TextareaAuto({ value, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  const campo = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { ajustarAltura(campo.current); }, [value]);
  useLayoutEffect(() => {
    const elemento = campo.current;
    if (!elemento) return;
    let largura = -1;
    let ativo = true;
    const observer = new ResizeObserver(() => {
      const atual = elemento.getBoundingClientRect().width;
      if (atual !== largura) { largura = atual; ajustarAltura(elemento); }
    });
    observer.observe(elemento);
    void document.fonts.ready.then(() => { if (ativo) ajustarAltura(elemento); });
    return () => { ativo = false; observer.disconnect(); };
  }, []);
  return <textarea {...props} value={value} ref={campo} />;
}

function ObservacoesDaConsulta({ texto, onChange }: { texto: string; onChange?: (texto: string) => void }) {
  return <label className="mb-3 block text-[12.5px] text-text-secondary">Observações da consulta
    <TextareaAuto aria-label="Observações da consulta" value={texto} onChange={(event) => onChange?.(event.target.value)} rows={1} placeholder="O que não for procedimento fica aqui"
      className="block w-full resize-none border-0 bg-transparent py-2 text-[15px] leading-6 text-text-primary outline-none focus-visible:ring-1 focus-visible:ring-teal" />
  </label>;
}


export function DocumentoAtendimentoEditor({
  documento, pacienteNome, eventos, onEventosChange, catalogo, onAplicarSugestao,
  onOrganizado, anexarTexto, onCapturaStateChange,
}: DocumentoAtendimentoProps) {
  const { valor: doc, onChange, onBloqueioChange } = documento;
  const voz = useCapturaLivre({ pacienteNome });
  const focoId = doc.pontoInsercao;
  const [pendenteRemovida, setPendenteRemovida] = useState<{ bloco: BlocoPendente; indice: number } | null>(null);
  const [tabelaRemovida, setTabelaRemovida] = useState<{ evento: OdontogramaEventoDraft; blocoId: string } | null>(null);
  const [removido, setRemovido] = useState<{ bloco: BlocoProcedimento; indice: number; evento: OdontogramaEventoDraft; indiceEvento: number } | null>(null);
  const [encaminharId, setEncaminharId] = useState<string | null>(null);
  const [organizando, setOrganizando] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [dentesPendentes, setDentesPendentes] = useState<Record<string, string>>({});
  const [modoAlterar, setModoAlterar] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [antesDoLote, setAntesDoLote] = useState<OdontogramaEventoDraft[] | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const requisicao = useRef<AbortController | null>(null);
  const montado = useRef(false);
  const anexoAplicado = useRef<number | null>(null);
  const area = useRef<HTMLFieldSetElement>(null);
  const idsAnteriores = useRef(new Set(eventos.map((evento) => evento.id)));
  const focoPendente = useRef<{ id: string; fim?: boolean } | null>(null);
  const bloqueado = organizando || arquivo !== null || voz.isTranscribing || voz.micStatus === 'recording';
  const foco = doc.blocos.find((bloco) => bloco.id === focoId);
  const sugestoes = useMemo(() => (
    foco?.tipo === 'texto' ? casarProcedimentoLocal(foco.texto, catalogo) : []
  ), [foco, catalogo]);
  const pedidoAtual = relatoParaDex(doc);
  useImperativeHandle(documento.acoes, () => ({
    organizar: () => { void organizar(); },
    corrigirPendentes: () => area.current?.querySelector<HTMLInputElement>('[data-dente-pendente]')?.focus(),
  }));
  const excedeLimite = (pedidoAtual?.texto.length ?? 0) > MAX_DEX_TEXT_CHARS;
  const catalogoId = 'catalogo-documento-atendimento';
  const reconhecimento = useMemo(() => reconhecerDocumento(pedidoAtual?.texto ?? '', catalogo), [pedidoAtual?.texto, catalogo]);
  const totalReconhecido = reconhecimento.sugestoes.reduce((total, item) => total + Math.max(1, item.sugestao.dentes.length), 0) + reconhecimento.pendentes.length;

  const focarBloco = useCallback((id: string, fim = false) => {
    const container = area.current?.querySelector<HTMLElement>(`[data-bloco-id="${CSS.escape(id)}"]`);
    const campo = container?.querySelector<HTMLElement>('[data-line-edit], [data-texto-documento], [data-dente-pendente], textarea, summary');
    campo?.focus({ preventScroll: true });
    if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement) {
      const posicao = fim ? campo.value.length : 0;
      campo.setSelectionRange(posicao, posicao);
    }
  }, []);

  useEffect(() => {
    if (!focoPendente.current || organizando) return;
    const { fim } = focoPendente.current;
    const id = focoPendente.current.id || doc.blocos.at(-1)?.id;
    if (id) focarBloco(id, fim);
    focoPendente.current = null;
  }, [doc, organizando, focarBloco]);

  const abrirPsrRecebido = useEffectEvent((novos: OdontogramaEventoDraft[]) => {
    const ids = new Set(novos.filter((evento) => evento.tipo === 'exame_periodontal').map((evento) => evento.id));
    if (!ids.size) return;
    onChange((atual) => {
      const sincronizado = sincronizarEventos(atual, eventos);
      return { ...sincronizado, blocos: sincronizado.blocos.map((bloco) => bloco.tipo === 'procedimento' && ids.has(bloco.eventoId) ? { ...bloco, tabelaAberta: true } : bloco) };
    });
  });
  useEffect(() => {
    const novos = eventos.filter((evento) => !idsAnteriores.current.has(evento.id));
    idsAnteriores.current = new Set(eventos.map((evento) => evento.id));
    if (!novos.length) return;
    abrirPsrRecebido(novos);
    for (const evento of novos) {
      const linha = area.current?.querySelector<HTMLElement>(`[data-documento-evento="${CSS.escape(evento.id)}"]`);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        linha?.animate([{ opacity: 0.45, backgroundColor: 'var(--color-teal-pale)' }, { opacity: 1, backgroundColor: 'transparent' }], { duration: 500, iterations: 4 });
      }
    }
    const ultimoTexto = [...(area.current?.querySelectorAll<HTMLTextAreaElement>('[data-texto-documento]') ?? [])].at(-1);
    if (!focoPendente.current) ultimoTexto?.focus({ preventScroll: true });
  }, [eventos]);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; requisicao.current?.abort(); };
  }, []);

  function acrescentar(texto: string, origem: OrigemTexto, foco: string | null) {
    onChange((atual) => {
      const bloco = atual.blocos.find((bloco) => bloco.id === foco);
      return origem === 'voz' && bloco?.tipo === 'texto'
        ? editarTexto(atual, bloco.id, bloco.texto ? `${bloco.texto}\n${texto}` : texto)
        : acrescentarTexto(definirPontoInsercao(atual, foco), texto, origem);
    });
  }

  const receberVoz = useEffectEvent((texto: string) => {
    acrescentar(texto, 'voz', focoId);
    voz.setTexto('');
  });
  useEffect(() => { if (voz.texto) receberVoz(voz.texto); }, [voz.texto]);

  const receberAnexo = useEffectEvent(() => {
    if (!anexarTexto || anexoAplicado.current === anexarTexto.nonce) return;
    anexoAplicado.current = anexarTexto.nonce;
    acrescentar(anexarTexto.texto, anexarTexto.origem, focoId);
  });
  useEffect(() => { receberAnexo(); }, [anexarTexto]);

  useEffect(() => {
    onBloqueioChange(organizando);
  }, [organizando, onBloqueioChange]);
  useEffect(() => {
    onCapturaStateChange?.({
      fase: organizando ? 'organizing' : arquivo !== null ? 'processing_file' : voz.micStatus === 'recording'
        ? 'recording' : voz.isTranscribing ? 'transcribing' : voz.transcriptionError ? 'transcription_error' : erro ? 'organizing_error' : 'idle',
      busy: bloqueado, impedeSalvar: bloqueado || voz.hasPendingAudio, audioParaRetry: voz.hasPendingAudio,
    });
  }, [onCapturaStateChange, bloqueado, organizando, arquivo, voz.micStatus, voz.isTranscribing, voz.transcriptionError, voz.hasPendingAudio, erro]);

  async function organizar() {
    if (bloqueado || requisicao.current || voz.hasPendingAudio) return;
    const pedido = relatoParaDex(doc);
    if (!pedido) return;
    if (pedido.texto.length > MAX_DEX_TEXT_CHARS) {
      setErro(`Texto longo demais para o Dex (${pedido.texto.length}/50.000). Divida em partes.`);
      return;
    }
    const controller = new AbortController();
    requisicao.current = controller;
    setOrganizando(true);
    onBloqueioChange(true);
    setErro(null);
    try {
      const resposta = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: pedido.texto, pacienteNome, modo: pedido.modo }),
      });
      const data = await resposta.json() as EvolucaoFormatada & { error?: string };
      if (controller.signal.aborted || !montado.current) return;
      if (!resposta.ok || data.error) throw new Error(data.error ?? 'Falha ao organizar');
      const organizados = onOrganizado(data, pedido.texto);
      const idsAntes = new Set(eventos.map((evento) => evento.id));
      const reconhecido = reconhecerDocumento(pedido.texto, catalogo);
      setAvisos((atuais) => [...new Set([...atuais, ...reconhecido.avisos])]);
      const novos = organizados.filter((evento) => !idsAntes.has(evento.id));
      onChange((atual) => {
        const organizado = aplicarOrganizacao(atual, {
          idsEnviados: pedido.idsBlocos, textoEnviado: pedido.texto,
          blocosEnviados: doc.blocos.flatMap((bloco) => bloco.tipo === 'texto' && pedido.idsBlocos.includes(bloco.id) ? [{ id: bloco.id, texto: bloco.texto }] : []),
          eventosNovosEmOrdem: novos, pendentes: reconhecido.pendentes,
        });
        // A rota não devolve o dente inválido: intercalar a pendência preserva a ordem narrada.
        let blocos = organizado.blocos;
        const pendentesNovas = blocos.filter((bloco): bloco is BlocoPendente => bloco.tipo === 'pendente' && !atual.blocos.some((anterior) => anterior.id === bloco.id));
        for (const pendente of pendentesNovas) {
          const posicao = pedido.texto.indexOf(pendente.trecho);
          const seguinte = blocos.find((bloco) => {
            if (bloco.tipo !== 'procedimento') return false;
            const evento = novos.find((evento) => evento.id === bloco.eventoId);
            if (!evento) return false;
            const trecho = fragmentarRelatoClinico(pedido.texto).find((trecho) => casarProcedimentoLocal(trecho, catalogo).some((sugestao) => sugestao.tipo === evento.tipo && (evento.ancora.dente == null || sugestao.dentes.includes(evento.ancora.dente))));
            return trecho != null && pedido.texto.indexOf(trecho) > posicao;
          });
          if (seguinte) {
            blocos = blocos.filter((bloco) => bloco.id !== pendente.id);
            const indice = blocos.findIndex((bloco) => bloco.id === seguinte.id);
            blocos = [...blocos.slice(0, indice), pendente, ...blocos.slice(indice)];
          }
        }
        return { ...organizado, blocos };
      });
      focoPendente.current = { id: '' };
    } catch (error) {
      if (controller.signal.aborted || !montado.current) return;
      setErro(!navigator.onLine || error instanceof TypeError
        ? 'Sem conexão. Seu texto está guardado nesta aba; tente de novo quando a internet voltar.'
        : 'O Dex não conseguiu organizar. Seu texto está intacto.');
    } finally {
      if (requisicao.current === controller) requisicao.current = null;
      if (montado.current) { setOrganizando(false); onBloqueioChange(false); }
    }
  }

  async function anexar(file: File) {
    if (bloqueado) return;
    setArquivo(file.name);
    setErro(null);
    try {
      const resultado = await extrairTextoDeArquivo(file);
      if (!montado.current) return;
      if (!resultado.ok) throw new Error(resultado.error);
      if (resultado.texto) acrescentar(resultado.texto, resultado.origem, focoId);
    } catch (error) {
      if (montado.current) setErro(error instanceof Error ? error.message : 'Não foi possível abrir o arquivo.');
    } finally {
      if (montado.current) setArquivo(null);
    }
  }

  function alterarEvento(id: string, mudancas: Partial<OdontogramaEventoDraft>) {
    const anterior = eventos.find((evento) => evento.id === id);
    if (anterior) dispensarAvisos(rotuloProcedimento(anterior));
    onEventosChange(eventos.map((evento) => evento.id === id ? { ...evento, ...mudancas } : evento));
  }

  function abrirTexto(posicao: PosicaoTexto) {
    if (bloqueado) return;
    const insercao = inserirTextoEm(doc, posicao);
    focoPendente.current = { id: insercao.id };
    onChange(insercao.doc);
  }

  function tratarTeclado(event: KeyboardEvent<HTMLFieldSetElement>) {
    if (bloqueado || event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault(); void organizar(); return;
    }
    const campo = event.target;
    if (!(campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement)) return;
    const id = campo.closest<HTMLElement>('[data-bloco-id]')?.dataset.blocoId;
    if (!id) return;
    if (event.key === 'Enter' && !event.shiftKey && campo.hasAttribute('data-line-edit')) {
      event.preventDefault(); abrirTexto({ depoisDe: id }); return;
    }
    if (event.key === 'Backspace' && campo.hasAttribute('data-texto-documento') && campo.value === '') {
      event.preventDefault();
      const anterior = vizinho(doc, id, 'acima');
      const proximo = apagarSeVazio(doc, id);
      focoPendente.current = { id: anterior ?? proximo.blocos[0]?.id ?? '', fim: true };
      onChange(proximo); return;
    }
    const inicio = campo.selectionStart === 0 && campo.selectionEnd === 0;
    const fim = campo.selectionStart === campo.value.length && campo.selectionEnd === campo.value.length;
    if ((event.key === 'ArrowUp' && inicio) || (event.key === 'ArrowDown' && fim)) {
      const destino = vizinho(doc, id, event.key === 'ArrowUp' ? 'acima' : 'abaixo');
      if (destino) { event.preventDefault(); focarBloco(destino, event.key === 'ArrowUp'); }
    }
  }

  function completarDente(bloco: BlocoPendente, valor: string) {
    const texto = valor.replace(/\D/g, '').slice(0, 2);
    setDentesPendentes((atuais) => ({ ...atuais, [bloco.id]: texto }));
    const resolvido = resolverPendente(doc, bloco.id, Number(texto), (modelo, dente) => criarEventosContextuais({
      tipo: modelo.tipo, procedimentoNome: modelo.procedimentoNome, observacao: modelo.observacao,
      ancoras: [{ nivel: modelo.faces.length ? 'face' : 'dente', dente, ...(modelo.faces.length ? { faces: modelo.faces } : {}) }],
      dataPadrao: hojeBRT(), contexto: { capturaId: crypto.randomUUID(), modo: modelo.situacao === 'realizado' ? 'realizado_hoje' : modelo.situacao === 'proxima_sessao' ? 'proxima_sessao' : 'a_fazer' },
    })[0]);
    if (!resolvido.evento) return;
    const evento = resolvido.evento;
    const aceitos = semNovasDuplicatas(eventos, [...eventos, evento]);
    if (aceitos.descartados.length) {
      setAvisos((atuais) => [...new Set([...atuais, `${texto} já tem ${evento.procedimentoNome} em aberto. Confira a linha existente antes de resolver esta pendência.`])]);
      return;
    }
    dispensarAvisos(bloco.trecho);
    focoPendente.current = { id: bloco.id };
    onEventosChange([...eventos, evento]);
    onChange(resolvido.doc);
  }

  function dispensarAvisos(trecho: string) {
    setAvisos((atuais) => atuais.filter((aviso) => {
      const original = aviso.match(/“([^”]+)”/)?.[1];
      return original ? !trecho.includes(original) && !original.includes(trecho) : false;
    }));
  }

  function editarPendente(id: string, patch: Partial<BlocoPendente['modelo']>) {
    onChange((atual) => ({ ...atual, blocos: atual.blocos.map((bloco) => bloco.id === id && bloco.tipo === 'pendente' ? { ...bloco, modelo: { ...bloco.modelo, ...patch } } : bloco) }));
  }

  function abrirTabela(blocoId: string) {
    onChange((atual) => ({ ...atual, blocos: atual.blocos.map((bloco) => bloco.id === blocoId && bloco.tipo === 'procedimento' ? { ...bloco, tabelaAberta: true } : bloco) }));
  }

  function adicionarPsr() {
    if (bloqueado) return;
    const existente = eventos.find((evento) => evento.tipo === 'exame_periodontal' && !evento.assinaturaId);
    if (existente) {
      const bloco = doc.blocos.find((bloco) => bloco.tipo === 'procedimento' && bloco.eventoId === existente.id);
      if (bloco) abrirTabela(bloco.id);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        area.current?.querySelector<HTMLElement>(`[data-documento-evento="${CSS.escape(existente.id)}"]`)
          ?.animate([{ opacity: 0.45, backgroundColor: 'var(--color-teal-pale)' }, { opacity: 1, backgroundColor: 'transparent' }], { duration: 500, iterations: 4 });
      }
      setAvisos((atuais) => [...new Set([...atuais, 'Boca já tem Exame periodontal em aberto'])]);
      return;
    }
    onAplicarSugestao({ tipo: 'exame_periodontal', catalogo: null, dentes: [], trecho: 'Exame periodontal', origem: null });
  }

  function aplicarReconhecidos(itens = reconhecimento.sugestoes, pendentes = reconhecimento.pendentes, retirarTrecho = false) {
    if (bloqueado || voz.hasPendingAudio) return;
    const propostas = itens.flatMap(({ sugestao, faces, realizado }) => {
      if (!sugestao.tipo) return [];
      const ancoras: AncoraClinica[] = tiposDeBoca.has(sugestao.tipo) ? [{ nivel: 'boca' }]
        : sugestao.dentes.map((dente) => ({ nivel: faces.length ? 'face' : 'dente', dente, ...(faces.length ? { faces } : {}) }));
      return criarEventosContextuais({ tipo: sugestao.tipo, ancoras, dataPadrao: hojeBRT(), contexto: {
        capturaId: crypto.randomUUID(), modo: sugestao.origem === 'preexistente' ? 'preexistente' : realizado ? 'realizado_hoje' : 'a_fazer',
      } });
    });
    const mescla = mesclarTabelasDocumento(eventos, propostas, itens.map((item) => item.trecho).join('\n'));
    const aceitos = semNovasDuplicatas(eventos, mescla.eventos);
    const novosIds = new Set(propostas.map((evento) => evento.id));
    onEventosChange(mescla.eventos);
    onChange((atual) => {
      let resultado = atual;
      if (retirarTrecho && foco?.tipo === 'texto' && itens.length === 1) {
        const tipos = new Set(casarProcedimentoLocal(itens[0].trecho, catalogo).flatMap((sugestao) => sugestao.tipo ? [sugestao.tipo] : []));
        if (tipos.size === 1) resultado = editarTexto(resultado, foco.id, foco.texto.replace(itens[0].trecho, '').replace(/^\s*[,.;!?]+\s*/, '').trim());
      }
      resultado = sincronizarEventos(resultado, aceitos.eventos);
      let blocos = resultado.blocos.map((bloco): Bloco => bloco.tipo === 'procedimento' && novosIds.has(bloco.eventoId) ? { ...bloco, origem: 'reconhecido' } : bloco);
      const novasPendentes = pendentes.filter((pendente) => !blocos.some((bloco) => bloco.tipo === 'pendente' && bloco.trecho === pendente.trecho && bloco.numeroInformado === pendente.numeroInformado && bloco.modelo.tipo === pendente.modelo.tipo));
      const ultimo = blocos.at(-1);
      const posicao = ultimo?.tipo === 'texto' && ultimo.texto === '' ? blocos.length - 1 : blocos.length;
      blocos = [...blocos.slice(0, posicao), ...novasPendentes.map((bloco) => ({ ...bloco, id: crypto.randomUUID() })), ...blocos.slice(posicao)];
      return { ...resultado, blocos, pontoInsercao: blocos.at(-1)?.id ?? null };
    });
    setAvisos((atuais) => [...new Set([...atuais, ...reconhecimento.avisos])]);
    focoPendente.current = { id: '' };
  }

  function aplicarSugestao(sugestao: SugestaoLocal) {
    const reconhecido = reconhecerDocumento(foco?.tipo === 'texto' ? foco.texto : '', catalogo);
    const item = reconhecido.sugestoes.find((item) => item.sugestao.tipo === sugestao.tipo && !sugestao.catalogo);
    if (item) aplicarReconhecidos([item], [], true);
    else onAplicarSugestao(sugestao);
  }

  function alterarSelecionados(situacao: 'sessao_atual' | 'proxima_sessao' | 'realizado') {
    const alvos = eventos.filter((evento) => selecionados.has(evento.id) && !evento.assinaturaId && evento.origem === 'clinica');
    if (!alvos.length) return;
    setAntesDoLote(alvos);
    onEventosChange(eventos.map((evento) => alvos.some((alvo) => alvo.id === evento.id) ? { ...evento,
      status: situacao === 'realizado' ? 'realizado' : 'indicado',
      momento_planejado: situacao === 'realizado' ? 'sessao_atual' : situacao,
      realizado_em: situacao === 'realizado' ? evento.realizado_em ?? hojeBRT() : null, revisar_status: false,
    } : evento));
    setModoAlterar(false); setSelecionados(new Set());
  }

  function desfazerLote() {
    if (!antesDoLote) return;
    onEventosChange(eventos.map((evento) => {
      const antes = antesDoLote.find((item) => item.id === evento.id);
      return antes ? { ...evento, status: antes.status, origem: antes.origem, momento_planejado: antes.momento_planejado, realizado_em: antes.realizado_em, revisar_status: antes.revisar_status } : evento;
    }));
    setAntesDoLote(null);
  }

  function removerLinha(bloco: BlocoProcedimento, evento: OdontogramaEventoDraft, indice: number) {
    dispensarAvisos(rotuloProcedimento(evento));
    setRemovido({ bloco, evento, indice, indiceEvento: eventos.findIndex((atual) => atual.id === evento.id) });
    onChange((atual) => ({ ...atual, blocos: atual.blocos.filter((item) => item.id !== bloco.id) }));
    onEventosChange(eventos.filter((atual) => atual.id !== evento.id));
  }

  function desfazerRemocao() {
    if (!removido) return;
    if (!eventos.some((evento) => evento.id === removido.evento.id)) {
      onEventosChange([...eventos.slice(0, removido.indiceEvento), removido.evento, ...eventos.slice(removido.indiceEvento)]);
      onChange((atual) => ({ ...atual, blocos: [...atual.blocos.slice(0, removido.indice), removido.bloco, ...atual.blocos.slice(removido.indice)] }));
    }
    setRemovido(null);
  }

  function renderizarBloco(bloco: Bloco, indice: number) {

          if (bloco.tipo === 'texto') return <div key={bloco.id} className="min-w-0">
            <TextareaAuto data-texto-documento aria-label="Relato para organizar com Dex" value={bloco.texto} rows={1}
              onChange={(event) => { const texto = event.target.value; dispensarAvisos(bloco.texto); onChange((atual) => editarTexto(atual, bloco.id, texto)); }}
              placeholder={doc.blocos.some((item) => item.tipo === 'organizado') ? 'Continue escrevendo… o Dex organiza só o que é novo' : 'Escreva, cole, anexe ou grave…'}
              className="min-h-[39px] w-full resize-none border-0 bg-transparent py-[6px] text-[15px] leading-[27px] text-text-primary outline-none placeholder:text-text-secondary focus-visible:ring-1 focus-visible:ring-teal" />
            {focoId === bloco.id && sugestoes.length > 0 && <div className="mb-3 flex flex-wrap gap-2" aria-label="Sugestões locais">
              {sugestoes.map((sugestao, i) => <button key={`${sugestao.tipo ?? sugestao.catalogo?.id}:${i}`} type="button" className={`${botaoBase} border border-border text-teal-ink`} onClick={() => aplicarSugestao(sugestao)}><Zap className="h-3 w-3" />{sugestao.trecho}</button>)}
            </div>}
          </div>;
          if (bloco.tipo === 'organizado') return <details key={bloco.id} className="mb-3 text-[13px] text-text-secondary"><summary className="cursor-pointer py-2"><span className="font-semibold text-teal-ink">Organizado</span> · ver texto original</summary><p className="whitespace-pre-wrap py-2">{bloco.texto}</p></details>;
          if (bloco.tipo === 'observacoes') return <ObservacoesDaConsulta key={bloco.id} texto={documento.textoVisita ?? ''} onChange={documento.onTextoVisitaChange} />;
          if (bloco.tipo === 'pendente') return <div data-pendente={bloco.id} className="grid min-h-[118.9px] grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-border py-[10px]">
            <input data-dente-pendente aria-label={`Qual dente para ${bloco.modelo.procedimentoNome}? Número informado ${bloco.numeroInformado}`} inputMode="numeric" pattern="[0-9]{2}" maxLength={2} placeholder="?"
              value={dentesPendentes[bloco.id] ?? ''} onChange={(event) => completarDente(bloco, event.target.value)}
              aria-invalid={!!dentesPendentes[bloco.id] && !Object.hasOwn(DENTES_FDI, Number(dentesPendentes[bloco.id]))}
              className="mt-[3px] h-8 w-[38px] rounded border border-dashed border-warning-ink bg-warning-pale text-center font-heading text-[19px] text-warning-ink outline-none focus-visible:ring-1 focus-visible:ring-warning-ink" />
            <div className="min-w-0 pb-2"><div className="grid min-h-[38px] grid-cols-[minmax(0,1fr)_22px] items-center gap-[10px] text-text-primary min-[601px]:grid-cols-[minmax(0,1fr)_112px_22px]">
              <input data-line-edit aria-label={`Nome do procedimento pendente ${bloco.numeroInformado}`} list={catalogoId} value={bloco.modelo.procedimentoNome} onChange={(event) => editarPendente(bloco.id, { procedimentoNome: event.target.value })} className="col-span-2 min-w-0 w-full border-0 bg-transparent text-[15px] font-medium min-[601px]:col-span-1 outline-none focus-visible:ring-1 focus-visible:ring-teal" />
              <span className={`text-[12px] ${bloco.modelo.situacao === 'realizado' ? 'text-teal-ink' : 'text-text-secondary'}`}>{bloco.modelo.situacao === 'realizado' ? 'Realizado hoje' : bloco.modelo.situacao === 'proxima_sessao' ? 'Próxima sessão' : 'A fazer'}</span>
              <button type="button" aria-label={`Remover pendente ${bloco.modelo.procedimentoNome} ${bloco.numeroInformado}`} onClick={() => {
                const resultado = removerPendente(doc, bloco.id);
                setPendenteRemovida(resultado.removido); onChange(resultado.doc);
                dispensarAvisos(bloco.trecho);
              }} className="flex h-[22px] w-[22px] items-center justify-center text-text-secondary"><X className="h-3.5 w-3.5" /></button>
            </div>
            <TextareaAuto data-line-edit aria-label={`Observação da pendente ${bloco.numeroInformado}`} value={bloco.modelo.observacao} rows={1} placeholder="Observação…" onChange={(event) => editarPendente(bloco.id, { observacao: event.target.value })} className="mt-1 block min-h-[25px] w-full resize-none border-0 bg-transparent py-[2px] text-[14px] leading-[21px] text-text-secondary outline-none focus-visible:ring-1 focus-visible:ring-teal" />
            <p className="mt-1 flex flex-wrap gap-[10px] text-[12px] leading-[19.2px] text-text-secondary"><span>organizado pelo Dex</span><span className="rounded bg-warning-pale px-[6px] text-warning-ink">Dente {bloco.numeroInformado} não existe: qual dente?</span></p></div>
          </div>;
          const evento = eventos.find((item) => item.id === bloco.eventoId);
          if (!evento) return null;
          const dente = evento.ancora.dente;
          const assinado = !!evento.assinaturaId;
          const preexistente = evento.origem === 'preexistente';
          const realizado = evento.status === 'realizado' && !preexistente;
          const proxima = evento.status === 'indicado' && evento.momento_planejado === 'proxima_sessao';
          const nome = rotuloProcedimento(evento);
          const destino = documento.destinosEncaminhar?.find((item) => item.id === evento.encaminhadoParaId);
          return <div key={bloco.id} data-documento-evento={evento.id} className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-border py-[10px]">
            <span data-linha-dente className={dente == null ? 'break-words pt-2 text-[13px] text-teal-ink' : 'font-heading text-[19px] leading-[38px] text-teal-ink'}>
              {modoAlterar && <input aria-label={`Selecionar ${nome} ${dente ?? 'região'}`} type="checkbox" checked={selecionados.has(evento.id)} disabled={assinado || preexistente}
                onChange={(event) => { const marcado = event.target.checked; setSelecionados((atuais) => { const proximos = new Set(atuais); if (marcado) proximos.add(evento.id); else proximos.delete(evento.id); return proximos; }); }} className="mr-1 h-3 w-3 accent-teal-ink" />}
              {dente ?? (evento.ancora.nivel === 'boca' ? 'Boca' : ondeLabel({ nivel: evento.ancora.nivel, dente: null, arcada: evento.ancora.arcada ?? null, quadrante: evento.ancora.quadrante ?? null }))}
            </span>
            <div className="min-w-0 pb-2">
              <div className="grid min-h-[38px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[10px] gap-y-1 min-[601px]:grid-cols-[minmax(0,1fr)_auto_112px_22px_22px]">
                <div className="col-span-2 flex min-w-0 items-center gap-2 min-[601px]:col-span-1"><input data-line-edit aria-label={`Nome do procedimento ${dente ?? nome}`} list={catalogoId} value={evento.procedimentoNome ?? nome} disabled={assinado}
                  onChange={(event) => { const nome = event.target.value; const item = catalogo.find((item) => item.nome.trim().toLocaleLowerCase() === nome.trim().toLocaleLowerCase()); alterarEvento(evento.id, { procedimentoNome: nome, procedimentoId: item?.id ?? null }); }}
                  className="min-w-0 w-full border-0 border-b border-transparent bg-transparent py-[2px] text-[15px] font-medium leading-6 text-text-primary outline-none focus:border-teal-ink" />
                  {(evento.tipo === 'endodontia' || evento.tipo === 'implante') && !bloco.tabelaAberta && evento.detalhe == null && <button type="button" disabled={assinado} onClick={() => abrirTabela(bloco.id)} className="shrink-0 rounded-md border border-border px-2 py-1 text-[12.5px] text-teal-ink">＋ Tabela</button>}
                </div>
                <div data-linha-faces className="flex min-w-0 gap-1">
                  {dente != null && facesDaLinha.map((face) => <button key={face} type="button" aria-label={`Face ${face} do procedimento ${dente}`} aria-pressed={evento.ancora.faces?.includes(face) ?? false} disabled={assinado}
                    onClick={() => { const faces = evento.ancora.faces?.includes(face) ? evento.ancora.faces.filter((item) => item !== face) : [...(evento.ancora.faces ?? []), face]; alterarEvento(evento.id, { ancora: { ...evento.ancora, nivel: faces.length ? 'face' : 'dente', faces: faces.length ? faces : undefined } }); }}
                    className={`h-[22px] w-[22px] shrink-0 rounded-[4px] text-[11px]! font-bold focus-visible:outline-2 focus-visible:outline-teal ${evento.ancora.faces?.includes(face) ? 'bg-teal-pale text-teal-ink' : 'border border-border text-text-secondary'}`}>{face}</button>)}
                </div>
                <button data-linha-situacao type="button" disabled={assinado || preexistente}
                  onClick={() => alterarEvento(evento.id, realizado
                    ? { status: 'indicado', momento_planejado: 'proxima_sessao', realizado_em: null, revisar_status: false }
                    : proxima ? { status: 'indicado', momento_planejado: 'sessao_atual', realizado_em: null, revisar_status: false }
                      : { status: 'realizado', origem: 'clinica', momento_planejado: 'sessao_atual', realizado_em: hojeBRT(), revisar_status: false })}
                  className={`w-[112px] rounded-[4px] border py-[3px] text-[12px] leading-[19.2px] focus-visible:outline-2 focus-visible:outline-teal ${realizado ? 'border-teal-ink text-teal-ink' : 'border-border text-text-secondary'}`}>
                  {preexistente ? 'Pré-existente' : realizado ? 'Realizado hoje' : proxima ? 'Próxima sessão' : 'A fazer'}
                </button>
                <button type="button" aria-label={`Remover ${nome} ${dente ?? ''}`} disabled={assinado || documento.idsDeAntes?.has(evento.id)} onClick={() => removerLinha(bloco, evento, indice)} className="flex h-[22px] w-[22px] items-center justify-center rounded text-text-secondary hover:text-text-primary disabled:opacity-30"><X className="h-3.5 w-3.5" /></button>
                <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={`Mais opções de ${nome} ${dente ?? ''}`} className="flex h-[22px] w-[22px] items-center justify-center rounded text-text-secondary"><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={assinado || evento.status !== 'indicado' || documento.idsDeAntes?.has(evento.id) || !!evento.encaminhadoParaId || !documento.destinosEncaminhar?.length} onSelect={() => setEncaminharId(evento.id)}>Encaminhar</DropdownMenuItem>
                    <DropdownMenuItem disabled={dente == null || !documento.onAbrirDenteGrande} onSelect={() => { if (dente != null) documento.onAbrirDenteGrande?.(dente, evento.id); }}>Detalhe do dente ⤢</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {(bloco.tabelaAberta || evento.detalhe != null) && ['endodontia', 'implante', 'exame_periodontal'].includes(evento.tipo) && <fieldset disabled={assinado} data-tabela-evento={evento.id} className="mt-3 min-w-0 max-w-full overflow-x-auto rounded-lg border border-border p-3">
                {corpoEspecialidadeEditavel(evento.tipo, evento.detalhe, (detalhe) => alterarEvento(evento.id, { detalhe }), evento.endo_revisao?.duvidas)}
                <button type="button" className={botao} onClick={() => {
                  setTabelaRemovida({ evento, blocoId: bloco.id });
                  alterarEvento(evento.id, { detalhe: null, endo_revisao: undefined });
                  onChange((atual) => ({ ...atual, blocos: atual.blocos.map((item) => item.id === bloco.id && item.tipo === 'procedimento' ? { ...item, tabelaAberta: false } : item) }));
                }}>Remover tabela</button>
              </fieldset>}
              <TextareaAuto data-line-edit aria-label={`Observação de ${nome} ${dente ?? ''}`} value={evento.observacao} disabled={assinado} rows={1} placeholder="Observação…" onChange={(event) => alterarEvento(evento.id, { observacao: event.target.value })}
                className="mt-1 block min-h-[25px] w-full resize-none border-0 bg-transparent py-[2px] text-[14px] leading-[21px] text-text-secondary outline-none focus-visible:ring-1 focus-visible:ring-teal" />
              <p className="mt-1 text-[12px] leading-[19.2px] text-text-secondary">
                {bloco.origem === 'dex' ? 'organizado pelo Dex' : bloco.origem === 'reconhecido' ? 'reconhecido no texto' : 'do odontograma'}
                {evento.revisar_status && ' · Dex: confirme a situação'}{destino && ` · Encaminhado para ${destino.nome}`}
              </p>
              {encaminharId === evento.id && <label className="mt-2 block text-xs text-text-secondary">Encaminhar para
                <select autoFocus aria-label={`Encaminhar ${nome}`} className="mt-1 block w-full rounded border border-border bg-surface p-2 text-text-primary" value="" onChange={(event) => { if (event.target.value) { alterarEvento(evento.id, { encaminhadoParaId: event.target.value }); setEncaminharId(null); } }}>
                  <option value="">Escolha o dentista</option>{documento.destinosEncaminhar?.map((destino) => <option key={destino.id} value={destino.id}>{destino.nome}{destino.especialidade ? ` · ${destino.especialidade}` : ''}</option>)}
                </select><button type="button" className={botao} onClick={() => setEncaminharId(null)}>Cancelar</button>
              </label>}
            </div>
          </div>;

  }

  return (
    <section aria-label="Documento do atendimento" aria-busy={organizando} className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border pb-2">
        <button type="button" className={botao} disabled={organizando || arquivo !== null || voz.isTranscribing || voz.hasPendingAudio}
          onClick={() => void voz.toggleVoz()}>
          {voz.micStatus === 'recording' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {voz.micStatus === 'recording' ? 'Parar gravação' : 'Gravar voz'}
        </button>
        <input ref={inputArquivo} aria-label="Anexar arquivo ao atendimento" type="file" accept="audio/*,.pdf,.docx,.doc,.txt" className="hidden"
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void anexar(file); }} />
        <button type="button" className={botao} disabled={bloqueado} onClick={() => inputArquivo.current?.click()}><Paperclip className="h-4 w-4" />Anexar</button>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" disabled={bloqueado} className={botao}>Adicionar tabela ▾</button></DropdownMenuTrigger>
          <DropdownMenuContent align="start"><DropdownMenuItem onSelect={adicionarPsr}>Periodontia (PSR)</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
        <button type="button" className={`${botaoBase} ml-auto text-[14px]! text-teal-ink`} disabled={bloqueado || voz.hasPendingAudio || excedeLimite || !pedidoAtual} onClick={() => void organizar()}>
          {organizando ? 'Organizando…' : 'Organizar com o Dex · Ctrl ↵'}
        </button>

        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Mais ações do documento" disabled={bloqueado} className={botao}><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setModoAlterar((atual) => !atual); setSelecionados(new Set()); }}>{modoAlterar ? 'Sair de Alterar vários' : 'Alterar vários'}</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {arquivo && <p role="status" className="text-xs text-text-secondary">Processando {arquivo}…</p>}
      {excedeLimite && <p role="alert" className="mb-3 text-sm text-warning-ink">Texto longo demais para o Dex ({pedidoAtual?.texto.length}/50.000). Divida em partes.</p>}
      {organizando && <DexLoader size="sm" label="Organizando o atendimento…" />}
      {erro && <div role="alert" className="mb-3 text-sm text-warning-ink"><p>{erro}</p><button type="button" className={botao} disabled={bloqueado} onClick={() => void organizar()}>Tentar de novo</button>
        {totalReconhecido > 0 && <button type="button" className={`${botaoBase} text-teal-ink`} disabled={bloqueado || voz.hasPendingAudio} onClick={() => aplicarReconhecidos()}>Organizar o que já reconheci ({totalReconhecido})</button>}
      </div>}
      {avisos.length > 0 && <div role="alert" className="mb-3 rounded border border-warning-ink/30 bg-warning-pale px-3 py-2 text-[13px] text-warning-ink"><p className="font-semibold">Confira estes trechos antes de salvar</p><ul className="mt-1 list-inside list-disc">{avisos.map((aviso) => <li key={aviso}>{aviso} <button type="button" aria-label={`Dispensar aviso: ${aviso}`} onClick={() => setAvisos((atuais) => atuais.filter((item) => item !== aviso))} className="font-semibold underline">Conferido</button></li>)}</ul></div>}
      {modoAlterar && <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs text-text-secondary">
        <span>{selecionados.size} selecionado(s)</span><label>Situação <select aria-label="Situação das linhas selecionadas" value="" disabled={bloqueado || !selecionados.size} onChange={(event) => {
          const valor = event.target.value;
          if (valor === 'sessao_atual' || valor === 'proxima_sessao' || valor === 'realizado') alterarSelecionados(valor);
        }} className="rounded border border-border bg-surface px-2 py-1 text-text-primary"><option value="">Escolher…</option><option value="sessao_atual">A fazer</option><option value="realizado">Realizado hoje</option><option value="proxima_sessao">Próxima sessão</option></select></label>
        <button type="button" className={botao} disabled={bloqueado} onClick={() => { setModoAlterar(false); setSelecionados(new Set()); }}>Cancelar</button>
      </div>}
      {antesDoLote && <p role="status" className="mb-2 text-xs text-text-secondary">Situação atualizada. <button type="button" className="font-semibold text-teal-ink" disabled={bloqueado} onClick={desfazerLote}>Desfazer alteração em lote</button></p>}
      <fieldset ref={area} disabled={bloqueado} className="min-w-0 border-0 p-0" onKeyDown={tratarTeclado}>
        <legend className="sr-only">Blocos do documento</legend>
        <datalist id={catalogoId}>{catalogo.map((item) => <option key={item.id} value={item.nome} />)}</datalist>
        {doc.blocos.map((bloco, indice) => <Fragment key={bloco.id}>
          <button type="button" aria-label={`Escrever antes do bloco ${indice + 1}`} onClick={() => abrirTexto({ antesDe: bloco.id })}
            className="group flex h-2 w-full items-center justify-center text-[12px] text-teal-ink transition-[height] hover:h-6 focus-visible:h-6 motion-reduce:transition-none">
            <span className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">＋ escrever aqui</span>
          </button>
          <div data-bloco-id={bloco.id} className="min-w-0" onFocusCapture={() => onChange((atual) => definirPontoInsercao(atual, bloco.id))}>
            {renderizarBloco(bloco, indice)}
          </div>
        </Fragment>)}

        {!doc.blocos.some((bloco) => bloco.tipo === 'observacoes') && documento.textoVisita && <ObservacoesDaConsulta texto={documento.textoVisita} onChange={documento.onTextoVisitaChange} />}
        {pendenteRemovida && <p role="status" className="mt-2 text-xs text-text-secondary">Pendência removida. <button type="button" disabled={bloqueado} className="font-semibold text-teal-ink" onClick={() => { onChange((atual) => restaurarPendente(atual, pendenteRemovida)); setPendenteRemovida(null); }}>Desfazer</button></p>}
        {tabelaRemovida && <p role="status" className="mt-2 text-xs text-text-secondary">Tabela removida. <button type="button" disabled={bloqueado} className="font-semibold text-teal-ink" onClick={() => {
          const atual = eventos.find((evento) => evento.id === tabelaRemovida.evento.id);
          if (atual) {
            alterarEvento(atual.id, { detalhe: tabelaRemovida.evento.detalhe, endo_revisao: tabelaRemovida.evento.endo_revisao });
            abrirTabela(tabelaRemovida.blocoId);
          }
          setTabelaRemovida(null);
        }}>Desfazer</button></p>}
        {removido && <p role="status" className="mt-2 text-xs text-text-secondary">Procedimento removido. <button type="button" onClick={desfazerRemocao} className="font-semibold text-teal-ink">Desfazer</button></p>}
        <p className="mt-3 text-xs text-text-secondary">Escreva ou fale. O Dex organiza quando você pedir (Ctrl+Enter).</p>
      </fieldset>
      {voz.hasPendingAudio && !voz.isTranscribing && <div role="status" className="flex flex-wrap items-center gap-2 text-xs text-warning-ink">
        O áudio ainda está disponível.
        <button type="button" className={botao} disabled={bloqueado} onClick={() => void voz.retryTranscription()}>Tentar novamente</button>
        <button type="button" className={botao} disabled={bloqueado} onClick={voz.discardPendingAudio}>Descartar áudio</button>
      </div>}
      <VoiceUX isRecording={voz.micStatus === 'recording'} isTranscribing={voz.isTranscribing} liveTranscript={voz.liveTranscript}
        elapsedSeconds={voz.elapsedSeconds} onStop={() => void voz.toggleVoz()} silenceWarning={voz.silenceWarning} onContinue={voz.continueRecording} />
    </section>
  );
}
