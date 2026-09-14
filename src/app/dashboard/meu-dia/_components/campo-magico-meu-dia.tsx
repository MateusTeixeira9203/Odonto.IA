'use client';

// R-46d D1 (D7-D9) — o campo mágico é a entrada única do painel "Registrar", substituindo a
// barra de procedimento inteira (Combobox + OndeSeletor + Status), que migrou pra dentro da
// disclosure "Registrar sem IA" em `registrar-painel.tsx` (D1.2). `CapturaLivreCard` é reusado
// tal qual (D1 original) — só ganha a prop `anexarTexto` (D8) e o fix de token (D5).
//
// R-50 (05/08) — orto detectado deixa de virar TEXTO. Antes o campo mágico recebia
// `orto_manutencao` estruturado e o degradava pra uma linha no texto da visita ("Orto (a
// estruturar…)") com um toast avisando — o dado chegava e era jogado fora. Agora ele sobe pro
// dono do estado (`registrar-painel.tsx`), que abre o chip "Manutenção ortodôntica" já
// preenchido. A I2 ("nunca descarta em silêncio") continua valendo por construção: ou o orto
// vira estado editável, ou a rota devolveu null (arcada não dita, F2) e não há o que descartar.

import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronUp } from 'lucide-react';
import { CapturaLivreCard, type CapturaDexState } from '@/components/fichas/captura-livre-card';
import { DicaZona } from './dica-zona';
import { mesclarEventosSemPerda } from '@/lib/odontograma/dedup-eventos-draft';
import { hojeBRT } from '@/lib/hora-brt';
import { extrairEndoDeterministico } from '@/lib/especialidades/extrair-endo-deterministico';
import { mesclarDetalheEndo } from '@/lib/especialidades/mesclar-endo-extracao';
import type { EndoDetalhe } from '@/lib/especialidades/endo';
import type { OdontogramaEventoDraft, OrtoManutencaoInfo } from '@/types/odontograma';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import type { SugestaoLocal } from '@/lib/odontograma/casar-procedimento-local';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';

export interface CampoMagicoMeuDiaProps {
  pacienteNome: string;
  eventosDraft: OdontogramaEventoDraft[];
  onEventosDraftChange: (eventos: OdontogramaEventoDraft[]) => void;
  textoVisita: string;
  onTextoVisitaChange: (texto: string) => void;
  /** Só escrita — quem lê é `handleSalvar` em `registrar-painel.tsx`, dono do estado local. */
  onAlertaNovoChange: (alerta: string | null) => void;
  /** R-50 — manutenção ortodôntica extraída pela IA. Mesmo padrão de `onAlertaNovoChange`: só
   *  escrita, o dono do estado é `registrar-painel.tsx` (que abre o chip já preenchido). */
  onOrtoDetectado: (orto: OrtoManutencaoInfo) => void;
  /** R-49 F1 — abre a tabela existente para revisar detalhe que veio do relato. */
  onEndoDetectado: (dente: number, eventoId: string) => void;
  /** R-46d D8 — "usar este documento de base" (anexar-documentos-bloco.tsx), repassado direto
   *  pro CapturaLivreCard. */
  anexarTexto?: { texto: string; nonce: number; origem: 'audio' | 'documento' };
  /** R-62 — catálogo pro match local, repassado direto pro CapturaLivreCard. */
  catalogoProcedimentos: MeuDiaCatalogoProcedimento[];
  /** R-62 — clique num chip de sugestão local. Dono da lógica é `registrar-painel.tsx`
   *  (mesma função `registrar`/`escolherDoCatalogo` que a antiga "Registrar sem IA" usava). */
  onAplicarSugestao: (sugestao: SugestaoLocal) => void;
  /** R-105a §4.2 — primeira sessão com paciente na tela: este é o único controle vivo, então
   *  ele acende. Só vale FECHADO (aberto, o próprio conteúdo já é o foco) e só até o primeiro
   *  procedimento entrar no rascunho — quem deriva isso é `meu-dia-client.tsx` (I2). */
  realce?: boolean;
  /** R-105a §4.2.1 — mostra a dica da zona enquanto o campo nunca foi aberto nesta sessão.
   *  O "já abriu" mora aqui porque é aqui que `aberto` mora; some pra sempre no 1º clique,
   *  não volta se ele recolher. */
  dica?: boolean;
  /** R-123 — Meu Dia deixa a captura pronta para digitar, sem mudar a ficha completa. */
  compacto?: boolean;
  onCapturaStateChange?: (state: CapturaDexState) => void;
}

export function CampoMagicoMeuDia({
  pacienteNome, eventosDraft, onEventosDraftChange, textoVisita, onTextoVisitaChange,
  onAlertaNovoChange, onOrtoDetectado, onEndoDetectado, anexarTexto, catalogoProcedimentos, onAplicarSugestao,
  realce, dica, compacto = false, onCapturaStateChange,
}: CampoMagicoMeuDiaProps) {
  const [aberto, setAberto] = useState(compacto);
  const [jaAbriu, setJaAbriu] = useState(false);
  // O complemento IA responde depois do pass 1. Esta ref garante que ele mescla contra a
  // edição mais recente do dentista, nunca contra o snapshot que iniciou a requisição.
  const eventosRef = useRef(eventosDraft);
  useEffect(() => { eventosRef.current = eventosDraft; }, [eventosDraft]);
  const scrollPendenteRef = useRef<string | null>(null);
  useEffect(() => {
    const id = scrollPendenteRef.current;
    if (!id) return;
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-dex-eventos~="${CSS.escape(id)}"]`);
      if (!card) return;
      scrollPendenteRef.current = null;
      card.focus({ preventScroll: true });
      card.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [eventosDraft]);

  async function complementarEndoComIA(relato: string, dentes: number[]) {
    if (dentes.length === 0) return;
    try {
      const resposta = await fetch('/api/dex/extrair-especialidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ especialidade: 'endodontia', texto: relato, contexto: { dentes } }),
      });
      const data = await resposta.json() as {
        ok: boolean;
        itens?: Array<{ dente: number; detalhe: EndoDetalhe }>;
      };
      if (!resposta.ok || !data.ok || !data.itens?.length) return;

      const porDente = new Map(data.itens.map((item) => [item.dente, item.detalhe]));
      const atuais = eventosRef.current;
      const atualizados = atuais.map((evento) => {
        if (evento.tipo !== 'endodontia' || evento.ancora.dente == null) return evento;
        const recebido = porDente.get(evento.ancora.dente);
        if (!recebido) return evento;
        const mesclado = mesclarDetalheEndo(
          (evento.detalhe ?? null) as EndoDetalhe | null,
          recebido,
          evento.endo_revisao,
          'ia',
        );
        return { ...evento, detalhe: mesclado.detalhe, endo_revisao: mesclado.revisao };
      });
      eventosRef.current = atualizados;
      onEventosDraftChange(atualizados);

      const primeiro = atualizados.find((evento) => evento.tipo === 'endodontia' && evento.ancora.dente != null && porDente.has(evento.ancora.dente));
      if (primeiro?.ancora.dente != null) onEndoDetectado(primeiro.ancora.dente, primeiro.id);
    } catch (error) {
      // Passo 2 é enriquecimento: falha não desfaz pass 1 nem bloqueia o form manual.
      console.warn('[campo-magico] complemento endodôntico indisponível:', error);
    }
  }

  function aplicar(data: EvolucaoFormatada, relato: string) {
    const atuais = eventosRef.current;
    const idsAnteriores = new Set(atuais.map((evento) => evento.id));
    const mesclados = mesclarEventosSemPerda(atuais, data.odontograma_eventos, hojeBRT(), {
      capturaId: crypto.randomUUID(),
    });
    const dentesEndo = mesclados
      .filter((evento) => evento.tipo === 'endodontia' && evento.ancora.dente != null)
      .map((evento) => evento.ancora.dente as number);
    const extracaoEndo = extrairEndoDeterministico(relato, dentesEndo);
    const detalhesPorDente = new Map(
      extracaoEndo.ok ? extracaoEndo.extracoes.map((extracao) => [extracao.dente, extracao]) : [],
    );
    const comDetalhe = mesclados.map((evento) => {
      const dente = evento.tipo === 'endodontia' ? evento.ancora.dente : undefined;
      const extracao = dente == null ? undefined : detalhesPorDente.get(dente);
      if (!extracao || evento.detalhe != null) return evento;
      return {
        ...evento,
        detalhe: extracao.detalhe,
        endo_revisao: { origemPorCampo: extracao.origemPorCampo, duvidas: extracao.duvidas },
      };
    });
    eventosRef.current = comDetalhe;
    scrollPendenteRef.current = comDetalhe.find((evento) => !idsAnteriores.has(evento.id))?.id ?? null;
    onEventosDraftChange(comDetalhe);

    const primeiroComDetalhe = comDetalhe.find((evento) => evento.tipo === 'endodontia' && evento.ancora.dente != null && evento.detalhe != null);
    if (primeiroComDetalhe?.ancora.dente != null) {
      onEndoDetectado(primeiroComDetalhe.ancora.dente, primeiroComDetalhe.id);
    }

    const partes = [
      textoVisita,
      data.anotacoes,
      data.conduta && `Conduta: ${data.conduta}`,
    ].filter((s): s is string => Boolean(s));
    onTextoVisitaChange(partes.join('\n\n'));

    if (data.alerta_novo) onAlertaNovoChange(data.alerta_novo); // I3
    if (data.orto_manutencao) onOrtoDetectado(data.orto_manutencao); // R-50 — vira estado, não texto
    void complementarEndoComIA(relato, dentesEndo);
  }

  if (!aberto) {
    return (
      <>
      {dica && !jaAbriu && (
        <DicaZona titulo="O campo mágico">
          Fale ou cole o relato da consulta. O Dex lê e transforma em procedimentos.
        </DicaZona>
      )}
      <button
        type="button"
        onClick={() => { setAberto(true); setJaAbriu(true); }}
        className={`flex w-full items-center gap-2 rounded-2xl border bg-surface-alt/40 px-4 py-3.5 text-left transition-colors ${
          realce
            ? 'border-teal ring-2 ring-teal/15'
            : 'border-teal/30 hover:border-teal/50'
        }`}
      >
        <Bot className="h-4 w-4 shrink-0 text-teal-ink" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-teal-ink">Campo mágico</span>
        <span className="text-xs text-text-secondary">Fale, cole, anexe ou digite — o Dex monta a ficha</span>
      </button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!compacto && <button
        type="button"
        onClick={() => setAberto(false)}
        className="flex w-fit items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-teal-ink"
      >
        <ChevronUp className="h-3 w-3" />
        Recolher
      </button>}
      {/* 04/08 (achado ao vivo) — min-h-[520px] era do container "tela cheia" original (R-46c,
          revisar texto extraído longo); aqui o campo mágico é inline no painel Registrar, e a
          altura fixa deixava um vão vazio enorme entre os controles do CapturaLivreCard (que
          tem ~200px de conteúdo real) e o resto do painel. Tamanho segue o conteúdo. */}
      {/* R-123 — na bancada o Campo Mágico ocupa a faixa clínica inteira, como no
          artefato aprovado. Fora dela mantém a medida de leitura confortável. */}
      <div className={compacto ? 'w-full' : 'mx-auto w-full max-w-[90ch]'}>
        <CapturaLivreCard
          pacienteNome={pacienteNome}
          formDirty={eventosDraft.length > 0 || textoVisita.trim() !== ''}
          onOrganizado={aplicar}
          aplicacao="acrescentar"
          anexarTexto={anexarTexto}
          catalogoProcedimentos={catalogoProcedimentos}
          onAplicarSugestao={onAplicarSugestao}
          onCapturaStateChange={onCapturaStateChange}
          compact={compacto}
          autoFocus={compacto}
        />
      </div>
    </div>
  );
}
