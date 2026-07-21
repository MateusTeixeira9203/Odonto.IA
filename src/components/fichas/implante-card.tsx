'use client';

// Card de leitura de implante (Roadmap A — migration 106, camada 3).
// DESIGN: plans/specs/spec-106-detalhe-especialidade.md §5.2.

import type { PluginCardProps } from '@/lib/especialidades/plugin';
import { PLATAFORMA_LABEL, CARGA_LABEL, type ImplanteDetalhe } from '@/lib/especialidades/implante';

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-32 shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{rotulo}</span>
      {valor ? (
        <span className={`text-text-primary ${mono ? 'font-mono tabular-nums' : ''}`}>{valor}</span>
      ) : (
        <span className="text-text-secondary/70">— não informado</span>
      )}
    </div>
  );
}

export function ImplanteCard({ valor }: PluginCardProps<ImplanteDetalhe>) {
  const medidas = valor.diametro != null && valor.comprimento != null
    ? `${valor.diametro} × ${valor.comprimento} mm`
    : null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-ink mb-3">
        {[valor.marca, valor.linha].filter(Boolean).join(' · ') || 'Implante'}
      </p>
      <div className="flex flex-col gap-2">
        <Linha rotulo="Medidas" valor={medidas} mono />
        <Linha rotulo="Plataforma" valor={valor.plataforma ? PLATAFORMA_LABEL[valor.plataforma] : null} />
        <Linha rotulo="Torque de inserção" valor={valor.torque != null ? `${valor.torque} Ncm` : null} mono />
        <Linha rotulo="Protocolo de carga" valor={valor.carga ? CARGA_LABEL[valor.carga] : null} />
        <Linha rotulo="Lote" valor={valor.lote} mono />
      </div>
    </div>
  );
}
