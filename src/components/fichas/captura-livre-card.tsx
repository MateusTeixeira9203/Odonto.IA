'use client';

// Campo mágico do perfil (Job A Fatia B, §8): relato livre (digitado, colado ou
// ditado) + anexo (áudio/pdf/docx/txt) → "Organizar com Dex" → preenche o form
// existente. Não salva nada — quem salva é o FichasTab, dono do formData.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Paperclip, Loader2, Bot, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useCapturaLivre } from '@/hooks/useCapturaLivre';
import { extrairTextoDeArquivo } from '@/lib/dex/extrair-texto-arquivo';
import { casarProcedimentoLocal, type SugestaoLocal } from '@/lib/odontograma/casar-procedimento-local';
import { VoiceUX } from './voice-ux';
import { DexAvatar } from '@/components/ui/dex-avatar';
import { DexLoader } from '@/components/ui/dex-loader';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
import type { MeuDiaCatalogoProcedimento } from '@/server/dashboard/get-meu-dia';

export type CapturaDexFase =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'processing_file'
  | 'organizing'
  | 'transcription_error'
  | 'organizing_error';

export interface CapturaDexState {
  fase: CapturaDexFase;
  busy: boolean;
  impedeSalvar: boolean;
  audioParaRetry: boolean;
}

export interface CapturaLivreCardProps {
  pacienteNome: string;
  /** R169 — recuperação opcional do relato local; consumidores atuais continuam vazios. */
  textoInicial?: string;
  /** Observa qualquer alteração do relato, inclusive transcrição e limpeza após organizar. */
  onTextoChange?: (texto: string) => void;
  /** Form já tem conteúdo? Gate de confirmação antes de sobrescrever (§8 fluxo, passo 4). */
  formDirty: boolean;
  /** Meu Dia soma os lotes; o formulário completo mantém a confirmação de substituição. */
  aplicacao?: 'substituir' | 'acrescentar';
  /** `false` mantém o relato para nova tentativa; retorno ausente preserva callers existentes. */
  onOrganizado: (evolucao: EvolucaoFormatada, relato: string) => void | boolean;
  /** R-46d (D8) — "usar este documento de base": `nonce` muda a cada clique, o efeito abaixo
   *  observa a mudança e faz append no texto atual. Opcional — callers existentes (FichasTab)
   *  não passam, comportamento 100% preservado. `origem` (07/08) decide o `modo` que
   *  `handleOrganizar` manda pro Dex — ver comentário em `veioDeDocumento` abaixo. */
  anexarTexto?: { texto: string; nonce: number; origem: 'audio' | 'documento' };
  /** R-62 — catálogo pro match local (§3.1). Ausente = o matcher casa só os 17 tipos
   *  estruturais, sem item comercial. */
  catalogoProcedimentos?: MeuDiaCatalogoProcedimento[];
  /** R-62 — clique num chip de sugestão LOCAL (zero rede, zero IA — §1.2/§3.1). Ausente =
   *  os chips locais nem são calculados (I5: `FichasTab` não passa, fica idêntico a hoje). */
  onAplicarSugestao?: (sugestao: SugestaoLocal) => void;
  /** R-123 — variante densa do Meu Dia; não altera o fluxo nem os consumidores da ficha. */
  compact?: boolean;
  /** R-123 — devolve o foco ao relato no atendimento rápido. */
  autoFocus?: boolean;
  /** Permite que o dono do rascunho bloqueie save/troca enquanto a captura é recuperável. */
  onCapturaStateChange?: (state: CapturaDexState) => void;
}

export function CapturaLivreCard({
  pacienteNome, textoInicial, onTextoChange, formDirty, onOrganizado, anexarTexto, catalogoProcedimentos, onAplicarSugestao,
  compact = false, autoFocus = false, aplicacao = 'substituir', onCapturaStateChange,
}: CapturaLivreCardProps) {
  const {
    texto,
    setTexto,
    toggleVoz,
    micStatus,
    isTranscribing,
    liveTranscript,
    elapsedSeconds,
    retryTranscription,
    discardPendingAudio,
    hasPendingAudio,
    transcriptionError,
    silenceWarning,
    continueRecording,
  } = useCapturaLivre({ pacienteNome, textoInicial });

  useEffect(() => {
    onTextoChange?.(texto);
  }, [onTextoChange, texto]);

  // R-62 — puro e síncrono: roda a cada tecla, sem debounce, sem rede (I1/I6). Ausência de
  // `onAplicarSugestao` desliga o cálculo inteiro (I5) — é o que mantém o FichasTab intocado.
  const sugestoesLocais = useMemo(
    () => (onAplicarSugestao ? casarProcedimentoLocal(texto, catalogoProcedimentos ?? []) : []),
    [texto, catalogoProcedimentos, onAplicarSugestao],
  );

  // 07/08 — true assim que QUALQUER trecho de documento (pdf/docx/doc/txt, nunca áudio)
  // entrar na caixa — volta a false ao consumir o lote ou quando o card reseta ao trocar de
  // paciente/agendamento, no mesmo padrão dos outros estados desta família. Efeito: o relato
  // INTEIRO desta chamada ao Dex vira `modo:'exame_inicial'` (verbo no passado deixa de
  // provar "feito por esta clínica hoje") — mistura-se com dictado ao vivo do mesmo jeito
  // que uma anamnese mistura achado novo com histórico trazido pelo paciente: mais seguro
  // tratar tudo como "confirmar antes" do que arriscar marcar procedimento alheio como feito.
  const [veioDeDocumento, setVeioDeDocumento] = useState(false);

  // R-46d (D8) — append, não substituição: mesmo padrão que `handleArquivo` já usa.
  const anexarNonceRef = useRef(anexarTexto?.nonce);
  const revisaoAnexoRef = useRef(0);
  useEffect(() => {
    if (anexarTexto == null || anexarTexto.nonce === anexarNonceRef.current) return;
    anexarNonceRef.current = anexarTexto.nonce;
    revisaoAnexoRef.current += 1;
    const novo = anexarTexto.texto;
    setTexto((prev) => (prev ? `${prev}\n\n${novo}` : novo));
    if (anexarTexto.origem === 'documento') setVeioDeDocumento(true);
  }, [anexarTexto, setTexto]);

  const [isOrganizando, setIsOrganizando] = useState(false);
  const organizarRef = useRef<AbortController | null>(null);
  useEffect(() => () => organizarRef.current?.abort(), []);
  const [organizarError, setOrganizarError] = useState(false);
  const [processandoArquivo, setProcessandoArquivo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocupado = micStatus === 'recording' || isTranscribing || isOrganizando || processandoArquivo !== null;
  const fase: CapturaDexFase = micStatus === 'recording'
    ? 'recording'
    : isTranscribing
      ? 'transcribing'
      : processandoArquivo !== null
        ? 'processing_file'
        : isOrganizando
          ? 'organizing'
          : transcriptionError
            ? 'transcription_error'
            : organizarError
              ? 'organizing_error'
              : 'idle';

  useEffect(() => {
    onCapturaStateChange?.({
      fase,
      busy: ocupado,
      impedeSalvar: ocupado || hasPendingAudio,
      audioParaRetry: hasPendingAudio,
    });
  }, [fase, hasPendingAudio, ocupado, onCapturaStateChange]);

  const handleOrganizar = async () => {
    if (ocupado || organizarRef.current) return;
    const relato = texto.trim();
    const revisaoAnexoEnviada = revisaoAnexoRef.current;
    if (!relato) return;
    // §8 passo 4 — form já preenchido pede confirmação antes de sobrescrever.
    // R-47 (31/07): eventos do odontograma agora se SOMAM aos existentes (não substituem
    // mais — era o achado 1), só o texto/campos do form são substituídos de fato.
    //
    // 05/08 (achado ao vivo) — cancelar aqui devolvia silêncio total: nenhum toast, nenhuma
    // mudança visível, o texto continuava no campo do jeito que estava. Parecia que o botão
    // não tinha feito nada (relatado como "não aparece no odontograma" — na verdade nunca
    // chegou a chamar a IA). Fica mais comum depois do R-62: os chips locais já preenchem o
    // draft sem passar por aqui, então `formDirty` chega `true` com mais frequência.
    if (aplicacao === 'substituir' && formDirty && !window.confirm('Isso substitui o texto e os campos do formulário. Os registros já lançados no odontograma são mantidos — os novos se somam a eles.')) {
      toast.info('Cancelado — nada foi alterado. O texto continua no campo.');
      return;
    }

    setIsOrganizando(true);
    setOrganizarError(false);
    const controller = new AbortController();
    organizarRef.current = controller;

    try {
      const res = await fetch('/api/dex/formatar-evolucao', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: relato,
          pacienteNome,
          modo: veioDeDocumento ? 'exame_inicial' : 'consulta',
        }),
      });
      const data = await res.json() as EvolucaoFormatada & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
      if (controller.signal.aborted) return;
      const aplicado = onOrganizado(data, relato);
      // Um documento externo pode chegar durante a resposta: preserve a entrada nova e sua origem.
      if (aplicado !== false && aplicacao === 'acrescentar' && revisaoAnexoRef.current === revisaoAnexoEnviada
        && (data.odontograma_eventos.length > 0 || data.orto_manutencao)) {
        setTexto('');
        setVeioDeDocumento(false);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('[captura-livre] formatar-evolucao:', err);
      setOrganizarError(true);
      toast.error('O Dex não conseguiu organizar as anotações. Tente novamente.');
    } finally {
      organizarRef.current = null;
      if (!controller.signal.aborted) setIsOrganizando(false);
    }
  };

  const handleArquivo = async (file: File) => {
    if (ocupado) return;
    setProcessandoArquivo(file.name);
    try {
      const resultado = await extrairTextoDeArquivo(file);
      if (!resultado.ok) throw new Error(resultado.error);
      if (resultado.texto) {
        const novo = resultado.texto;
        setTexto(prev => prev ? `${prev}\n${novo}` : novo);
      }
      if (resultado.origem === 'documento') setVeioDeDocumento(true);
    } catch (err) {
      console.error('[captura-livre] anexo:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
    } finally {
      setProcessandoArquivo(null);
    }
  };

  async function handleToggleVoz() {
    if (micStatus !== 'recording' && hasPendingAudio) {
      if (!window.confirm('Há um áudio que ainda não foi transcrito. Descartar esse áudio e iniciar uma nova gravação?')) return;
      discardPendingAudio();
    }
    await toggleVoz();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-teal/30 bg-surface-alt/40">
      <div className={`flex items-center gap-2 ${compact ? 'px-3 pb-1.5 pt-2.5' : 'px-4 pb-2 pt-3.5'}`}>
        <DexAvatar size={18} animated={isOrganizando} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-teal-ink">Campo mágico</span>
        <span className="text-xs text-text-secondary ml-1">Fale, cole ou anexe — o Dex monta a ficha</span>
      </div>

      {/* R-62 — sugestões LOCAIS: instantâneas, acionáveis, zero rede. Distintas das da IA
          logo abaixo (preenchidas + ícone de raio, vs. outline sozinho) — são sugestão de
          outra natureza (trecho casado, não o relato inteiro entendido). */}
      <AnimatePresence>
        {sugestoesLocais.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {sugestoesLocais.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAplicarSugestao?.(s)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-ink text-surface hover:opacity-90 transition-opacity"
                >
                  <Zap className="w-2.5 h-2.5" />
                  {s.trecho}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        value={texto}
        disabled={ocupado}
        aria-label="Relato para organizar com Dex"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            void handleOrganizar();
          }
        }}
        autoFocus={autoFocus}
        placeholder="Ex: Paciente relatou dor no dente 36, fiz restauração com resina composta. Orientei sobre cuidados pós-procedimento."
        className={`w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-secondary/50 ${compact ? 'min-h-[66px] px-3 py-2' : 'min-h-[100px] px-4 py-3'}`}
      />

      {processandoArquivo && (
        <div className="flex items-center gap-2 px-4 pb-2 text-xs text-text-secondary">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-ink" />
          Processando {processandoArquivo}...
        </div>
      )}
      {transcriptionError && hasPendingAudio && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 text-xs text-warning-ink" role="status">
          <span>O áudio não foi transcrito e continua disponível.</span>
          <span className="flex gap-1">
            <button type="button" onClick={() => void retryTranscription()} className="min-h-11 rounded-lg px-3 font-bold hover:bg-warning-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Tentar novamente</button>
            <button type="button" onClick={discardPendingAudio} className="min-h-11 rounded-lg px-3 font-bold text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">Descartar áudio</button>
          </span>
        </div>
      )}

      <div className={`flex items-center justify-between gap-2 border-t border-border/50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleVoz()}
            disabled={isTranscribing || isOrganizando || processandoArquivo !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              micStatus === 'recording'
                ? 'bg-coral/10 text-coral-ink hover:bg-coral/20 animate-pulse'
                : 'bg-teal/10 text-teal-ink hover:bg-teal/20'
            }`}
          >
            {micStatus === 'recording' ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {micStatus === 'recording' ? 'Parar' : 'Gravar voz'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleArquivo(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocupado}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Anexar
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleOrganizar()}
          disabled={!texto.trim() || ocupado}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-ink hover:opacity-90 text-surface text-sm font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(47,156,133,0.3)]"
        >
          {isOrganizando ? <DexLoader size="sm" /> : <Bot className="h-4 w-4" />}
          {isOrganizando ? 'Organizando ficha...' : <>Organizar com Dex{compact && <span className="hidden text-[10px] opacity-70 sm:inline">Ctrl ↵</span>}</>}
        </button>
      </div>

      <VoiceUX
        isRecording={micStatus === 'recording'}
        isTranscribing={isTranscribing}
        liveTranscript={liveTranscript}
        elapsedSeconds={elapsedSeconds}
        onStop={() => void toggleVoz()}
        silenceWarning={silenceWarning}
        onContinue={continueRecording}
      />
    </div>
  );
}
