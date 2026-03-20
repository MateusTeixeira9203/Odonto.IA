"use client";

import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ARCADA_INFERIOR, ARCADA_SUPERIOR } from "./ficha-helpers";
import { FichaSectionLabel } from "./ficha-shared";

interface OdontogramaCardProps {
  dentesSelecionados: string[];
  onToggleDente: (dente: string) => void;
}

export function OdontogramaCard({
  dentesSelecionados,
  onToggleDente,
}: OdontogramaCardProps): React.JSX.Element {
  function renderArcada(dentes: readonly string[]): React.JSX.Element {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {dentes.map((dente) => (
          <button
            key={dente}
            onClick={() => onToggleDente(dente)}
            className={`flex size-8 items-center justify-center rounded border text-xs font-mono font-medium transition-colors ${
              dentesSelecionados.includes(dente)
                ? "border-teal bg-teal text-white"
                : "border-brand-border bg-brand-bg text-brand-muted hover:border-teal/50 hover:text-brand-black"
            }`}
          >
            {dente}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <FichaSectionLabel>Odontograma</FichaSectionLabel>

        <div className="space-y-2">
          <p className="text-center font-mono text-[0.6rem] uppercase tracking-widest text-brand-muted">
            Arcada Superior
          </p>
          {renderArcada(ARCADA_SUPERIOR)}
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-brand-border" />
          <span className="font-mono text-[0.6rem] text-brand-muted">↑ sup · inf ↓</span>
          <div className="h-px flex-1 bg-brand-border" />
        </div>

        <div className="space-y-2">
          {renderArcada(ARCADA_INFERIOR)}
          <p className="text-center font-mono text-[0.6rem] uppercase tracking-widest text-brand-muted">
            Arcada Inferior
          </p>
        </div>

        {dentesSelecionados.length > 0 ? (
          <div className="space-y-2 border-t border-brand-border pt-1">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
              Dentes Afetados
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...dentesSelecionados]
                .sort((a, b) => Number(a) - Number(b))
                .map((dente) => (
                  <span
                    key={dente}
                    className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 font-mono text-xs text-teal"
                  >
                    Dente {dente}
                    <button
                      onClick={() => onToggleDente(dente)}
                      className="ml-0.5 text-teal/60 transition-colors hover:text-teal"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
            </div>
          </div>
        ) : (
          <p className="py-2 text-center font-sans text-xs text-brand-muted">
            Clique nos dentes para selecionar
          </p>
        )}
      </CardContent>
    </Card>
  );
}
