'use client';

// Card de leitura da manutenção ortodôntica (Roadmap A — Fatia A0, camada 3).
// DESIGN: plans/specs/DESIGN-ficha-a0.md §4 (chips §10 do artefato).
//
// Orto é registro de ARCADA — não pinta o odontograma. Aparece SÓ como este card
// (I2: só monta quando há dado). Valores em DM Mono onde são técnicos (fio, elástico).

import type { PluginCardProps } from '@/lib/especialidades/plugin';
import type { OrtoManutencaoDetalhe } from '@/lib/especialidades/orto';

const ARCADA_LABEL: Record<OrtoManutencaoDetalhe['arcada'], string> = {
  superior: 'arcada superior',
  inferior: 'arcada inferior',
  ambas: 'ambas as arcadas',
};

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{rotulo}</span>
      {valor ? (
        <span className={`text-text-primary ${mono ? 'font-mono' : ''}`}>{valor}</span>
      ) : (
        <span className="text-text-secondary/70">— não informado</span>
      )}
    </div>
  );
}

export function OrtoCard({ valor }: PluginCardProps<OrtoManutencaoDetalhe>) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-ink mb-3">
        Manutenção · {ARCADA_LABEL[valor.arcada]}
      </p>
      <div className="flex flex-col gap-2">
        <Linha rotulo="Arco" valor={valor.fio} mono />
        <Linha rotulo="Ativação" valor={valor.ativacao} />
        <Linha rotulo="Elástico corrente" valor={valor.elastico_corrente} mono />
        <Linha rotulo="Intermaxilar" valor={valor.elastico_intermaxilar} mono />
      </div>
    </div>
  );
}
