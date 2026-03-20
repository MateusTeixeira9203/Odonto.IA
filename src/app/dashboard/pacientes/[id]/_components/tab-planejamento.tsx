"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ClipboardList, ChevronRight } from "lucide-react";
import type { Planejamento } from "@/types/database";

interface Props {
  planejamentos: Planejamento[];
  pacienteId: string;
}

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  apresentado: { label: "Apresentado", className: "bg-primary/10 text-primary" },
  aprovado: { label: "Aprovado", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
} as const;

export function TabPlanejamento({ planejamentos, pacienteId }: Props): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-muted-foreground">
          {planejamentos.length} planejamento{planejamentos.length !== 1 ? "s" : ""}
        </p>
        <Link
          href={`/dashboard/fichas/nova?paciente_id=${pacienteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Criar via Nova Ficha
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {planejamentos.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border flex flex-col items-center gap-3 py-14">
          <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
          <div className="text-center">
            <p className="font-sans text-sm font-medium text-foreground">Nenhum planejamento ainda</p>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              Os planejamentos são criados a partir das fichas clínicas
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {planejamentos.map((plano) => {
            const cfg = STATUS_CONFIG[plano.status] ?? STATUS_CONFIG.rascunho;
            return (
              <div
                key={plano.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground truncate">
                    {plano.titulo}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {format(new Date(plano.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
