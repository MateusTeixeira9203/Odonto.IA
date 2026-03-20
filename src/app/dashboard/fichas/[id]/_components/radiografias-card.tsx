"use client";

import { Image as ImageIcon, Loader2, Plus, Presentation, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FichaSectionLabel } from "./ficha-shared";
import type { FichaArquivo } from "@/types/database";

interface RadiografiasCardProps {
  etapasCount: number;
  radiografias: FichaArquivo[];
  signedUrls: Record<string, string>;
  uploadandoRx: boolean;
  rxInputId: string;
  onUploadRx: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenApresentacao: () => void;
  onOpenLightbox: (index: number) => void;
  onRemoverRx: (arquivo: FichaArquivo) => void;
}

export function RadiografiasCard({
  etapasCount,
  radiografias,
  signedUrls,
  uploadandoRx,
  rxInputId,
  onUploadRx,
  onOpenApresentacao,
  onOpenLightbox,
  onRemoverRx,
}: RadiografiasCardProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <FichaSectionLabel>Radiografias</FichaSectionLabel>
          <div className="flex items-center gap-2">
            {etapasCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onOpenApresentacao}
              >
                <Presentation size={13} />
                Apresentar
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => document.getElementById(rxInputId)?.click()}
            >
              {uploadandoRx ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </Button>
            <input
              id={rxInputId}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,.pdf"
              className="hidden"
              onChange={onUploadRx}
              disabled={uploadandoRx}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {radiografias.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded border-2 border-dashed border-brand-border font-sans text-sm text-brand-muted">
            Nenhuma radiografia adicionada ainda
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {radiografias.map((radiografia, index) => (
              <div
                key={radiografia.id}
                className="group relative overflow-hidden rounded border border-brand-border bg-brand-bg"
              >
                {signedUrls[radiografia.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrls[radiografia.id]}
                    alt={radiografia.nome_original}
                    className="h-36 w-full cursor-pointer object-cover"
                    onClick={() => onOpenLightbox(index)}
                  />
                ) : (
                  <div
                    className="flex h-36 cursor-pointer items-center justify-center bg-brand-surface"
                    onClick={() => onOpenLightbox(index)}
                  >
                    <ImageIcon className="size-8 text-brand-muted/30" />
                  </div>
                )}

                <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                  <div className="flex justify-end">
                    <button
                      className="flex size-6 items-center justify-center rounded-full bg-white/90 text-red-500 hover:bg-red-50"
                      onClick={() => void onRemoverRx(radiografia)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      className="flex flex-1 items-center justify-center gap-1 rounded bg-white/90 px-1 py-1.5 text-xs font-medium text-brand-black hover:bg-white"
                      onClick={() => onOpenLightbox(index)}
                    >
                      <ZoomIn size={11} /> Ampliar
                    </button>
                  </div>
                </div>

                <p className="truncate px-2 py-1.5 font-mono text-xs text-brand-muted">
                  {radiografia.nome_original}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
