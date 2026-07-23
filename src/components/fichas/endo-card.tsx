'use client';

// Card de leitura da odontometria endodôntica (Roadmap A — migration 106, camada 3).
// DESIGN: plans/specs/spec-106-detalhe-especialidade.md §5.1 (tabela §04/§05 do artefato).
//
// Campo não ditado aparece com borda tracejada coral — nunca inventado (I5). Números
// sempre em DM Mono tabular, alinhados à direita (dígito a dígito, invariante da casa).

import type { PluginCardProps } from '@/lib/especialidades/plugin';
import type { EndoDetalhe } from '@/lib/especialidades/endo';

function Cel({ valor, destaque }: { valor: string | number | null; destaque?: boolean }) {
  if (valor == null) {
    return (
      <span className="inline-block w-14 text-right font-mono text-xs border border-dashed border-coral rounded px-1.5 py-0.5 text-coral-ink">
        —
      </span>
    );
  }
  return (
    <span className={`inline-block w-14 text-right font-mono tabular-nums text-xs px-1.5 py-0.5 ${destaque ? 'text-teal-ink font-bold' : 'text-text-primary'}`}>
      {valor}
    </span>
  );
}

export function EndoCard({ valor }: PluginCardProps<EndoDetalhe>) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-ink mb-2">Ficha endodôntica</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[380px]">
          <thead>
            <tr>
              <th className="text-left text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5 pr-2">Canal</th>
              <th className="text-left text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5 pr-2">Referência</th>
              <th className="text-right text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5 pr-2">Raiz</th>
              <th className="text-right text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5 pr-2">Lima inicial</th>
              <th className="text-right text-[9px] font-bold uppercase tracking-wider text-text-secondary pb-1.5">Lima final</th>
            </tr>
          </thead>
          <tbody>
            {valor.canais.map((c, i) => (
              <tr key={i} className="border-t border-border">
                <td className="py-1.5 pr-2 font-semibold text-text-primary">{c.nome || '—'}</td>
                <td className="py-1.5 pr-2 text-text-secondary">{c.referencia ?? '—'}</td>
                <td className="py-1.5 pr-2 text-right"><Cel valor={c.comprimentoRaiz} /></td>
                <td className="py-1.5 pr-2 text-right"><Cel valor={c.limaInicial} /></td>
                <td className="py-1.5 text-right"><Cel valor={c.limaFinal} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(valor.obturacao || valor.cimento) && (
        <div className="flex gap-4 flex-wrap mt-2.5 text-[11px] text-text-secondary">
          {valor.obturacao && <span>Obturação: <b className="text-text-primary">{valor.obturacao}</b></span>}
          {valor.cimento && <span>Cimento: <b className="text-text-primary">{valor.cimento}</b></span>}
        </div>
      )}
    </div>
  );
}
