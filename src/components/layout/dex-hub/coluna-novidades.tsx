'use client';

import { useEffect, useState } from 'react';
import { NOVIDADES } from '@/lib/novidades';

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function chaveVisto(id: string): string {
  return `dex_novidade_${id}`;
}

function formatarData(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** Coluna 3: novidades do sistema, fonte estática (D8). "Visto" só em localStorage —
 *  não vai ao banco, não entra no badge (D5); o ponto é a única indicação. */
export function ColunaNovidades() {
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);
  // Capturado uma vez (inicializador preguiçoso) — Date.now() direto no render é impuro
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    const set = new Set<string>();
    for (const n of NOVIDADES) {
      if (localStorage.getItem(chaveVisto(n.id))) set.add(n.id);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- OD016-L26: leitura unica do localStorage depois da montagem preserva estado inicial dos indicadores; dono ALFA - Dev 2 (lista unica no vault)
    setVistos(set);
  }, []);

  const abrir = (id: string) => {
    localStorage.setItem(chaveVisto(id), '1');
    setVistos((prev) => new Set(prev).add(id));
    setExpandido((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-teal-ink">Novidades do sistema</span>
        <span className="ml-auto text-[9.5px] text-text-muted">vem da gente</span>
      </div>

      <div className="space-y-[0.45rem]">
        {NOVIDADES.map((n) => {
          const isNovo = agora - new Date(n.data).getTime() < SETE_DIAS_MS;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => abrir(n.id)}
              className="flex w-full items-start gap-[0.65rem] rounded-2xl border border-border bg-surface px-[0.85rem] py-[0.7rem] text-left transition-colors hover:border-teal/45"
            >
              <span
                className={`mt-1 h-[7px] w-[7px] shrink-0 rounded-full ${vistos.has(n.id) ? 'bg-border' : 'bg-teal'}`}
              />
              <span className="min-w-0">
                <span className="text-[12.5px] font-semibold text-text-primary">
                  {n.titulo}
                  {isNovo && (
                    <span className="ml-1.5 rounded-[0.35rem] bg-teal-pale px-[0.38rem] py-[0.12rem] text-[8.5px] font-bold uppercase tracking-[0.1em] text-teal-ink">
                      novo
                    </span>
                  )}
                </span>
                <span className="mt-[0.14rem] block text-[10.5px] text-text-muted">
                  {formatarData(n.data)} · {n.resumo}
                </span>
                {expandido === n.id && (
                  <span className="mt-1.5 block text-[10.5px] leading-relaxed text-text-secondary">
                    {n.detalhe}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
