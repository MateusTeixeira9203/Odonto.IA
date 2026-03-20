'use client';

import { useState, useRef, useId } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Eye, Trash2, Download, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { uploadPatientPhoto } from '@/lib/storage/uploadPatientPhoto';

export interface FotoItem {
  id: string;
  url: string;
  nome: string;
  created_at: string;
}

interface Props {
  pacienteId: string;
  clinicaId: string;
  fotos: FotoItem[];
  onFotoAdded: (foto: FotoItem) => void;
  onFotoRemoved: (id: string) => void;
}

// Extrai o caminho de storage a partir da URL pública do Supabase
// Formato: .../storage/v1/object/public/fichas/<path>
function storagePathFromUrl(url: string): string {
  const match = /\/fichas\/(.+?)(\?.*)?$/.exec(url);
  return match ? match[1] : '';
}

export function PhotoGallery({
  pacienteId,
  clinicaId,
  fotos,
  onFotoAdded,
  onFotoRemoved,
}: Props): React.JSX.Element {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Foto aberta no modal de visualização
  const [fotoAtiva, setFotoAtiva] = useState<FotoItem | null>(null);
  // Confirmação de exclusão dentro do modal
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  // Estado de upload
  const [uploadando, setUploadando] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  // Exclusão em andamento
  const [excluindo, setExcluindo] = useState(false);

  // Simula barra de progresso durante o upload (Supabase SDK não expõe progresso real)
  function iniciarProgressoSimulado(): () => void {
    setUploadProgress(0);
    const intervalo = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) { clearInterval(intervalo); return prev; }
        return prev + Math.random() * 12;
      });
    }, 180);
    return () => clearInterval(intervalo);
  }

  async function handleArquivoSelecionado(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    // Limpa o input para permitir re-upload do mesmo arquivo
    event.target.value = '';

    setUploadErro(null);
    setUploadando(true);
    const pararProgresso = iniciarProgressoSimulado();

    try {
      const resultado = await uploadPatientPhoto(file, pacienteId, clinicaId);
      pararProgresso();

      if (resultado.error) {
        setUploadErro(resultado.error);
        setUploadProgress(0);
        return;
      }

      setUploadProgress(100);

      // Notifica o componente pai com a nova foto
      onFotoAdded({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: resultado.url,
        nome: file.name,
        created_at: new Date().toISOString(),
      });

      // Reseta a barra após breve exibição do 100%
      setTimeout(() => setUploadProgress(0), 600);
    } catch {
      pararProgresso();
      setUploadErro('Erro inesperado ao fazer upload.');
      setUploadProgress(0);
    } finally {
      setUploadando(false);
    }
  }

  async function handleExcluir(foto: FotoItem): Promise<void> {
    if (excluindo) return;
    setExcluindo(true);

    try {
      // Remove do Supabase Storage
      const storagePath = storagePathFromUrl(foto.url);
      if (storagePath) {
        await supabase.storage.from('fichas').remove([storagePath]);
      }

      // Fecha o modal e notifica o pai
      setFotoAtiva(null);
      setConfirmandoExclusao(false);
      onFotoRemoved(foto.id);
    } catch {
      // Em caso de erro no storage, ainda notifica o pai para limpar o estado
      setFotoAtiva(null);
      setConfirmandoExclusao(false);
      onFotoRemoved(foto.id);
    } finally {
      setExcluindo(false);
    }
  }

  function handleAbrirModal(foto: FotoItem): void {
    setFotoAtiva(foto);
    setConfirmandoExclusao(false);
  }

  function handleFecharModal(): void {
    if (excluindo) return;
    setFotoAtiva(null);
    setConfirmandoExclusao(false);
  }

  function handleDownload(foto: FotoItem): void {
    const link = document.createElement('a');
    link.href = foto.url;
    link.download = foto.nome;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-4">
      {/* Barra de progresso de upload */}
      {uploadando && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="font-sans text-xs text-text-secondary">Enviando foto…</p>
            <p className="font-mono text-xs text-teal">{Math.round(uploadProgress)}%</p>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-alt overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-teal"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Erro de upload */}
      {uploadErro && (
        <p className="font-sans text-xs text-red-500">{uploadErro}</p>
      )}

      {/* Empty state */}
      {fotos.length === 0 && !uploadando ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-14 rounded-2xl border border-dashed border-border bg-surface"
        >
          <ImageIcon className="w-10 h-10 text-text-muted/40" />
          <div className="text-center">
            <p className="font-sans text-sm font-medium text-text-primary">Nenhuma foto ainda</p>
            <p className="font-sans text-xs text-text-secondary mt-1">
              Adicione fotos do paciente para acompanhamento clínico
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadando}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-dark disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Foto
          </button>
        </motion.div>
      ) : (
        <>
          {/* Cabeçalho com contador e botão de adicionar */}
          <div className="flex items-center justify-between">
            <p className="font-sans text-sm text-text-secondary">
              {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadando}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-dashed border-border text-xs font-medium text-text-secondary hover:border-teal hover:text-teal disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Foto
            </button>
          </div>

          {/* Grade de miniaturas: 2 colunas mobile, 3 desktop */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnimatePresence>
              {fotos.map((foto, index) => (
                <motion.div
                  key={foto.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-surface-alt cursor-pointer"
                  onClick={() => handleAbrirModal(foto)}
                >
                  {/* Imagem da miniatura */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={foto.url}
                    alt={foto.nome}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Overlay de hover com ações */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      title="Visualizar"
                      className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleAbrirModal(foto); }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAbrirModal(foto);
                        setConfirmandoExclusao(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nome da foto no rodapé */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                    <p className="font-sans text-xs text-white truncate">{foto.nome}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleArquivoSelecionado}
        disabled={uploadando}
      />

      {/* Modal de visualização fullscreen */}
      <Dialog open={fotoAtiva !== null} onOpenChange={(open) => { if (!open) handleFecharModal(); }}>
        <DialogContent className="max-w-3xl bg-surface border-border p-0 overflow-hidden rounded-2xl">
          {fotoAtiva && (
            <>
              <DialogHeader className="px-6 pt-5 pb-0">
                <DialogTitle className="font-sans text-base font-semibold text-text-primary truncate pr-8">
                  {fotoAtiva.nome}
                </DialogTitle>
                <p className="font-mono text-xs text-text-secondary mt-0.5">
                  {format(new Date(fotoAtiva.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </DialogHeader>

              {/* Imagem em tamanho grande */}
              <div className="px-6 py-4 flex items-center justify-center bg-black/5 dark:bg-black/30 min-h-64 max-h-[60vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoAtiva.url}
                  alt={fotoAtiva.nome}
                  className="max-h-[55vh] max-w-full object-contain rounded-lg"
                />
              </div>

              {/* Ações do modal */}
              <div className="px-6 py-4 border-t border-border flex items-center gap-3">
                {/* Download */}
                <button
                  type="button"
                  onClick={() => handleDownload(fotoAtiva)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>

                <div className="flex-1" />

                {/* Excluir — com etapa de confirmação */}
                {confirmandoExclusao ? (
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-xs text-text-secondary">Excluir permanentemente?</p>
                    <button
                      type="button"
                      onClick={() => setConfirmandoExclusao(false)}
                      disabled={excluindo}
                      className="h-9 px-3 rounded-xl border border-border text-sm text-text-secondary hover:bg-surface-alt disabled:opacity-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExcluir(fotoAtiva)}
                      disabled={excluindo}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {excluindo ? 'Excluindo…' : 'Confirmar exclusão'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(true)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-border text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
