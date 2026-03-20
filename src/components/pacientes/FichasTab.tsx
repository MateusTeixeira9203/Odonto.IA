'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  FileText,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  X,
  AlertTriangle,
  ChevronRight,
  Mic,
  Square,
  Loader2,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ARCADA_SUPERIOR, ARCADA_INFERIOR } from '@/app/dashboard/fichas/[id]/_components/ficha-helpers';
import { deletarFicha, criarFichaInline, atualizarFicha } from '@/app/dashboard/pacientes/[id]/actions';
import { Badge } from '@/components/dentai';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

// ── Tipo exportado ──────────────────────────────────────────────────────────
export type FichaResumida = {
  id: string;
  status: 'aberta' | 'concluida';
  created_at: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentes_afetados: string[] | null;
};

const TIPOS_CONSULTA = [
  'Consulta de rotina',
  'Urgência / dor',
  'Retorno',
  'Procedimento',
  'Avaliação inicial',
  'Outro',
];

interface Props {
  patientId: string;
  fichas: FichaResumida[];
  dentistaId: string;
  clinicaId: string;
}

// Formata timer de gravação em mm:ss
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function FichasTab({ fichas, patientId }: Props): React.JSX.Element {
  const router = useRouter();

  // ── Estado: lista ──────────────────────────────────────────────────────────
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);

  // ── Estado: nova evolução ──────────────────────────────────────────────────
  const [novaEvolucaoAberta, setNovaEvolucaoAberta] = useState(false);
  const [tipo, setTipo] = useState(TIPOS_CONSULTA[0]);
  const [observacoes, setObservacoes] = useState('');
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);

  // ── Estado: edição ─────────────────────────────────────────────────────────
  const [fichaEditando, setFichaEditando] = useState<FichaResumida | null>(null);
  const [editTipo, setEditTipo] = useState('');
  const [editObs, setEditObs] = useState('');
  const [editStatus, setEditStatus] = useState<'aberta' | 'concluida'>('aberta');
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  // ── Gravação de voz ────────────────────────────────────────────────────────
  const { status: recStatus, timer, startRecording, stopRecording } = useAudioRecorder();
  const isGravando = recStatus === 'recording';
  const isProcessandoAudio = recStatus === 'processing' || transcrevendo;

  async function handleToggleGravacao(): Promise<void> {
    if (isGravando) {
      const blob = await stopRecording();
      if (!blob) {
        toast.error('Erro ao capturar o áudio');
        return;
      }
      setTranscrevendo(true);
      try {
        const fd = new FormData();
        fd.append('audio', new File([blob], 'audio.webm', { type: blob.type }));
        const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
        const data = await res.json() as { transcricao?: string; error?: string };
        if (data.error) {
          toast.error(data.error);
        } else if (data.transcricao) {
          // Adiciona ao campo de observações já existente
          setObservacoes((prev) => (prev ? `${prev}\n${data.transcricao}` : (data.transcricao ?? '')));
          toast.success('Transcrição concluída');
        }
      } catch {
        toast.error('Erro ao transcrever o áudio');
      } finally {
        setTranscrevendo(false);
      }
    } else {
      await startRecording();
    }
  }

  // ── Handlers: nova evolução ────────────────────────────────────────────────
  function toggleDente(dente: string): void {
    setDentesSelecionados((prev) =>
      prev.includes(dente) ? prev.filter((d) => d !== dente) : [...prev, dente]
    );
  }

  async function handleSalvar(): Promise<void> {
    if (!observacoes.trim() && dentesSelecionados.length === 0) {
      toast.error('Preencha ao menos o tipo ou observações');
      return;
    }
    setSalvando(true);
    const result = await criarFichaInline({
      pacienteId: patientId,
      queixaPrincipal: tipo,
      anotacoes: observacoes,
      dentesAfetados: dentesSelecionados,
    });
    setSalvando(false);
    if (result.error) {
      toast.error('Erro ao criar ficha');
    } else {
      toast.success('Ficha criada com sucesso');
      setNovaEvolucaoAberta(false);
      setTipo(TIPOS_CONSULTA[0]);
      setObservacoes('');
      setDentesSelecionados([]);
      router.refresh();
    }
  }

  // ── Handlers: edição ──────────────────────────────────────────────────────
  function abrirEdicao(ficha: FichaResumida): void {
    setFichaEditando(ficha);
    setEditTipo(ficha.queixa_principal ?? TIPOS_CONSULTA[0]);
    setEditObs(ficha.anotacoes ?? '');
    setEditStatus(ficha.status);
    setMenuAbertoId(null);
  }

  async function handleSalvarEdicao(): Promise<void> {
    if (!fichaEditando) return;
    setSalvandoEdit(true);
    const result = await atualizarFicha(fichaEditando.id, patientId, {
      queixa_principal: editTipo || null,
      anotacoes: editObs || null,
      status: editStatus,
    });
    setSalvandoEdit(false);
    if (result.error) {
      toast.error('Erro ao atualizar ficha');
    } else {
      toast.success('Ficha atualizada');
      setFichaEditando(null);
      router.refresh();
    }
  }

  // ── Handlers: delete ──────────────────────────────────────────────────────
  async function handleDeletar(fichaId: string): Promise<void> {
    setDeletando(true);
    try {
      await deletarFicha(fichaId);
      setConfirmandoId(null);
      toast.success('Ficha excluída');
      router.refresh();
    } catch {
      toast.error('Erro ao excluir ficha');
    } finally {
      setDeletando(false);
    }
  }

  // ── CSS helpers ────────────────────────────────────────────────────────────
  const inputClass =
    'w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-teal/40 transition-colors';

  function renderArcada(dentes: readonly string[]): React.JSX.Element {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {dentes.map((dente) => (
          <button
            key={dente}
            type="button"
            onClick={() => toggleDente(dente)}
            className={`w-8 h-8 flex items-center justify-center rounded border text-xs font-mono font-medium transition-colors ${
              dentesSelecionados.includes(dente)
                ? 'border-teal bg-teal text-white'
                : 'border-border bg-surface-alt text-text-secondary hover:border-teal/50 hover:text-text-primary'
            }`}
          >
            {dente}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-text-secondary">
          {fichas.length} ficha{fichas.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => setNovaEvolucaoAberta((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
        >
          {novaEvolucaoAberta ? (
            <><X className="w-3.5 h-3.5" />Cancelar</>
          ) : (
            <><Plus className="w-3.5 h-3.5" />Nova Evolução</>
          )}
        </button>
      </div>

      {/* ── Painel de nova evolução ──────────────────────────────────────────── */}
      <AnimatePresence>
        {novaEvolucaoAberta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-alt/50 flex items-center justify-between">
                <div>
                  <p className="font-sans text-sm font-semibold text-text-primary">Nova Evolução</p>
                  <p className="font-sans text-xs text-text-secondary mt-0.5">Salva como nova ficha clínica</p>
                </div>
                {/* Botão de gravação de voz */}
                <button
                  type="button"
                  onClick={handleToggleGravacao}
                  disabled={isProcessandoAudio && !isGravando}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isGravando
                      ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                      : isProcessandoAudio
                      ? 'bg-surface-alt text-text-secondary cursor-not-allowed'
                      : 'bg-teal/10 text-teal hover:bg-teal/20'
                  }`}
                >
                  {isProcessandoAudio && !isGravando ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Transcrevendo…</>
                  ) : isGravando ? (
                    <><Square className="w-3.5 h-3.5 fill-current" />{formatTimer(timer)}</>
                  ) : (
                    <><Mic className="w-3.5 h-3.5" />Gravar voz</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Coluna esquerda — campos */}
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Tipo de consulta</label>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                      {TIPOS_CONSULTA.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Observações / Evolução
                      {isGravando && (
                        <span className="ml-2 text-red-500 animate-pulse">● Gravando…</span>
                      )}
                    </label>
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder={isProcessandoAudio ? 'Transcrevendo áudio…' : 'Descreva a evolução clínica, procedimentos realizados…'}
                      rows={5}
                      disabled={isProcessandoAudio}
                      className={inputClass + ' resize-none disabled:opacity-60'}
                    />
                  </div>

                  {dentesSelecionados.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {[...dentesSelecionados].sort((a, b) => Number(a) - Number(b)).map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-0.5 font-mono text-xs text-teal">
                          {d}
                          <button type="button" onClick={() => toggleDente(d)}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="font-sans text-xs text-text-muted">
                    Para gravar voz, clique no botão "Gravar voz" no cabeçalho. Para anexos, abra a ficha completa após salvar.
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setNovaEvolucaoAberta(false); setObservacoes(''); setDentesSelecionados([]); }}
                      className="flex-1 py-2 rounded-xl text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvar}
                      disabled={salvando}
                      className="flex-1 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors"
                    >
                      {salvando ? 'Salvando…' : 'Salvar Ficha'}
                    </button>
                  </div>
                </div>

                {/* Coluna direita — odontograma */}
                <div className="p-4 space-y-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-secondary text-center">
                    Odontograma ISO
                  </p>
                  <div className="space-y-2">
                    <p className="text-center font-mono text-[0.6rem] text-text-muted">Arcada Superior</p>
                    {renderArcada(ARCADA_SUPERIOR)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="font-mono text-[0.6rem] text-text-secondary">↑ sup · inf ↓</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="space-y-2">
                    {renderArcada(ARCADA_INFERIOR)}
                    <p className="text-center font-mono text-[0.6rem] text-text-muted">Arcada Inferior</p>
                  </div>
                  {dentesSelecionados.length === 0 && (
                    <p className="text-center font-sans text-xs text-text-muted py-2">
                      Clique nos dentes para marcar
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lista de fichas ──────────────────────────────────────────────────── */}
      {fichas.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-3 py-12"
        >
          <FileText className="w-8 h-8 text-text-muted" />
          <p className="font-sans text-sm text-text-secondary">Nenhuma ficha ainda</p>
          <Link href={`/dashboard/fichas/nova?paciente_id=${patientId}`} className="text-xs font-medium text-teal hover:text-teal-dark transition-colors">
            Criar primeira ficha →
          </Link>
        </motion.div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {fichas.map((ficha) =>
            confirmandoId === ficha.id ? (
              <div key={ficha.id} className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="font-sans text-sm text-red-700 dark:text-red-400">
                    Apagar ficha de {format(new Date(ficha.created_at), 'dd/MM/yyyy')}?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="font-mono text-xs text-text-secondary hover:text-text-primary" onClick={() => setConfirmandoId(null)}>cancelar</button>
                  <button disabled={deletando} onClick={() => handleDeletar(ficha.id)} className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50">
                    {deletando ? 'Apagando…' : 'Apagar'}
                  </button>
                </div>
              </div>
            ) : (
              <div key={ficha.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/60 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-text-primary">
                    {ficha.queixa_principal ?? 'Ficha clínica'}
                  </p>
                  <p className="font-mono text-xs text-text-secondary">
                    {format(new Date(ficha.created_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={ficha.status === 'aberta' ? 'warning' : 'success'}>
                    {ficha.status === 'aberta' ? 'Aberta' : 'Concluída'}
                  </Badge>
                  {/* Menu contextual */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuAbertoId(menuAbertoId === ficha.id ? null : ficha.id)}
                      className="flex w-7 h-7 items-center justify-center rounded-lg text-text-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-alt hover:text-text-primary transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {menuAbertoId === ficha.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-8 z-20 w-44 bg-surface rounded-xl border border-border shadow-lg overflow-hidden"
                        >
                          <Link
                            href={`/dashboard/fichas/${ficha.id}`}
                            className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors"
                            onClick={() => setMenuAbertoId(null)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                            Ver ficha completa
                            <ChevronRight className="w-3.5 h-3.5 ml-auto text-text-secondary" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => abrirEdicao(ficha)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text-primary hover:bg-surface-alt transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-text-secondary" />
                            Editar ficha
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmandoId(ficha.id); setMenuAbertoId(null); }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir ficha
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Dialog: Editar Ficha ─────────────────────────────────────────────── */}
      <Dialog open={!!fichaEditando} onOpenChange={(open) => { if (!open) setFichaEditando(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Editar Ficha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Tipo de consulta</label>
              <select value={editTipo} onChange={(e) => setEditTipo(e.target.value)} className={inputClass}>
                {TIPOS_CONSULTA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Observações</label>
              <textarea
                value={editObs}
                onChange={(e) => setEditObs(e.target.value)}
                rows={5}
                className={inputClass + ' resize-none'}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'aberta' | 'concluida')} className={inputClass}>
                <option value="aberta">Aberta</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setFichaEditando(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSalvarEdicao} disabled={salvandoEdit} className="px-6 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark disabled:opacity-50 transition-colors">
              {salvandoEdit ? 'Salvando…' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
