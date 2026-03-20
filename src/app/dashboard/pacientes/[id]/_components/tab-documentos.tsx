"use client";

import { format } from "date-fns";
import { FileText, Image, Scan, Paperclip, FolderOpen } from "lucide-react";
import type { FichaArquivo } from "@/types/database";

interface Props {
  arquivos: FichaArquivo[];
}

type TipoArquivo = FichaArquivo["tipo"];

const GRUPOS: { tipo: TipoArquivo; label: string; icon: React.ElementType; color: string }[] = [
  { tipo: "radiografia", label: "Radiografias", icon: Scan, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" },
  { tipo: "foto_ficha", label: "Fotografias", icon: Image, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" },
  { tipo: "documento", label: "Documentos", icon: FileText, color: "bg-primary/10 text-primary" },
];

export function TabDocumentos({ arquivos }: Props): React.JSX.Element {
  if (arquivos.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border flex flex-col items-center gap-3 py-14">
        <FolderOpen className="w-10 h-10 text-muted-foreground/30" />
        <div className="text-center">
          <p className="font-sans text-sm font-medium text-foreground">Nenhum arquivo ainda</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Anexe radiografias, fotos e documentos nas fichas clínicas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {GRUPOS.map(({ tipo, label, icon: Icon, color }) => {
        const itens = arquivos.filter((a) => a.tipo === tipo);
        if (itens.length === 0) return null;

        return (
          <div key={tipo} className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="font-sans text-sm font-semibold text-foreground">{label}</p>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{itens.length}</span>
            </div>
            <div className="divide-y divide-border">
              {itens.map((arquivo) => (
                <div key={arquivo.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-foreground truncate">
                      {arquivo.nome_original}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {format(new Date(arquivo.created_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
