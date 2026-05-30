"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  ZoomIn,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  FileImage,
  Trash2,
} from "lucide-react";

interface Documento {
  id: string;
  nome: string;
  url: string;
  tipo: string;  // MIME type
  date?: string; // data formatada para exibição
}

interface GaleriaImagensProps {
  documentos: Documento[];
  selecionados?: string[];
  onSelecionar?: (ids: string[]) => void;
  modoSelecao?: boolean;
  onDelete?: (id: string, e: React.MouseEvent) => void;
}

function getFileIcon(tipo: string): React.ElementType {
  if (tipo.startsWith("image/")) return FileImage;
  if (tipo.includes("pdf")) return FileText;
  if (tipo.includes("sheet") || tipo.includes("excel")) return FileSpreadsheet;
  if (tipo.includes("presentation") || tipo.includes("powerpoint")) return Presentation;
  if (tipo.includes("word")) return FileText;
  return File;
}

function isImage(tipo: string): boolean {
  return tipo.startsWith("image/");
}

export function GaleriaImagens({
  documentos,
  selecionados = [],
  onSelecionar,
  modoSelecao = false,
  onDelete,
}: GaleriaImagensProps): React.JSX.Element {
  const [imagemAmpliada, setImagemAmpliada] = useState<Documento | null>(null);

  function toggleSelecao(id: string): void {
    if (!onSelecionar) return;
    if (selecionados.includes(id)) {
      onSelecionar(selecionados.filter((s) => s !== id));
    } else {
      onSelecionar([...selecionados, id]);
    }
  }

  function handleClick(doc: Documento): void {
    if (modoSelecao) {
      toggleSelecao(doc.id);
    } else if (isImage(doc.tipo)) {
      setImagemAmpliada(doc);
    } else {
      window.open(doc.url, "_blank");
    }
  }

  if (documentos.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary">
        <FileImage className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum arquivo nesta categoria</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {documentos.map((doc) => {
          const Icon = getFileIcon(doc.tipo);
          const isSelecionado = selecionados.includes(doc.id);
          const ehImagem = isImage(doc.tipo);

          return (
            <motion.div
              key={doc.id}
              whileHover={{ y: -4 }}
              onClick={() => handleClick(doc)}
              className={`group bg-surface rounded-xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer ${
                isSelecionado
                  ? "border-teal ring-2 ring-teal/20"
                  : "border-border hover:border-teal/50"
              }`}
            >
              {/* Thumbnail ou ícone */}
              <div className="aspect-square relative bg-surface-alt overflow-hidden flex items-center justify-center">
                {ehImagem ? (
                  <Image
                    src={doc.url}
                    alt={doc.nome}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                  />
                ) : (
                  <Icon className="w-10 h-10 text-text-secondary group-hover:text-teal transition-colors" />
                )}

                {/* Overlay de ações */}
                <div
                  className={`absolute inset-0 flex items-center justify-center gap-2 bg-black/40 transition-opacity ${
                    modoSelecao
                      ? "opacity-100 bg-black/50"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {modoSelecao ? (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isSelecionado
                          ? "bg-teal text-white"
                          : "bg-white/20 text-white border-2 border-white/50"
                      }`}
                    >
                      {isSelecionado && <Check className="w-5 h-5" />}
                    </div>
                  ) : (
                    <>
                      {ehImagem && (
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      )}
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(doc.id, e); }}
                          className="w-8 h-8 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Metadados */}
              <div className="p-3">
                <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-1 truncate">
                  {doc.nome}
                </div>
                {doc.date && (
                  <div className="text-[9px] font-medium text-text-secondary truncate">
                    {doc.date}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Lightbox de imagem ampliada */}
      <AnimatePresence>
        {imagemAmpliada && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
            onClick={() => setImagemAmpliada(null)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <button
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={() => setImagemAmpliada(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative z-10 w-full max-w-4xl"
              style={{ minHeight: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full" style={{ minHeight: 400, height: "70vh" }}>
                <Image
                  src={imagemAmpliada.url}
                  alt={imagemAmpliada.nome}
                  fill
                  className="object-contain"
                  referrerPolicy="no-referrer"
                  sizes="100vw"
                />
              </div>
            </motion.div>
            <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm z-10">
              {imagemAmpliada.nome}
            </p>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
