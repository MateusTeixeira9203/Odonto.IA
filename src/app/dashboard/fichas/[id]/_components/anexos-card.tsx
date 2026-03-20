"use client";

import { FileText, Image as ImageIcon, Loader2, Upload, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FichaSectionLabel } from "./ficha-shared";
import type { FichaArquivo } from "@/types/database";

interface AnexosCardProps {
  documentos: FichaArquivo[];
  fotosficha: FichaArquivo[];
  signedUrls: Record<string, string>;
  docInputId: string;
  fotoInputId: string;
  uploadandoDoc: boolean;
  uploadandoFoto: boolean;
  onDocInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoverDocumento: (arquivo: FichaArquivo) => void;
  onOpenFotoLightbox: (index: number) => void;
  onRemoverFoto: (arquivo: FichaArquivo) => void;
}

export function AnexosCard({
  documentos,
  fotosficha,
  signedUrls,
  docInputId,
  fotoInputId,
  uploadandoDoc,
  uploadandoFoto,
  onDocInputChange,
  onUploadFoto,
  onRemoverDocumento,
  onOpenFotoLightbox,
  onRemoverFoto,
}: AnexosCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <FichaSectionLabel>Anexos</FichaSectionLabel>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => document.getElementById(docInputId)?.click()}
            disabled={uploadandoDoc}
          >
            {uploadandoDoc ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
            )}
            {uploadandoDoc ? "Processando..." : "Documento"}
          </Button>
          <input
            id={docInputId}
            type="file"
            multiple
            accept=".doc,.docx,.pdf,.txt,.pptx"
            className="hidden"
            onChange={onDocInputChange}
            disabled={uploadandoDoc}
          />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => document.getElementById(fotoInputId)?.click()}
            disabled={uploadandoFoto}
          >
            {uploadandoFoto ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ImageIcon size={13} />
            )}
            {uploadandoFoto ? "Enviando..." : "Foto da ficha"}
          </Button>
          <input
            id={fotoInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onUploadFoto}
            disabled={uploadandoFoto}
          />
        </div>

        {documentos.length > 0 && (
          <div className="space-y-1.5">
            {documentos.map((documento) => (
              <div
                key={documento.id}
                className="flex items-center gap-3 rounded border border-brand-border bg-brand-bg px-3 py-2"
              >
                <FileText className="size-4 shrink-0 text-brand-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-brand-black">
                    {documento.nome_original}
                  </p>
                </div>
                <button
                  className="flex size-7 items-center justify-center rounded text-brand-muted transition-colors hover:text-red-500"
                  onClick={() => void onRemoverDocumento(documento)}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {fotosficha.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
              Fotos da ficha ({fotosficha.length})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {fotosficha.map((foto, index) => (
                <div
                  key={foto.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded border border-brand-border bg-brand-bg"
                  onClick={() => onOpenFotoLightbox(index)}
                >
                  {signedUrls[foto.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={signedUrls[foto.id]}
                      alt={foto.nome_original}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="size-5 text-brand-muted/30" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/40 group-hover:opacity-100">
                    <ZoomIn size={16} className="text-white" />
                  </div>

                  <button
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onRemoverFoto(foto);
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
