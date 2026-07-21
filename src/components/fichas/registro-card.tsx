'use client';

// Card de registro §11 (Roadmap A — Fatia A0, camada 2 da ficha).
// DESIGN: plans/specs/DESIGN-ficha-a0.md §4 (espelha o card do artefato §11).
//
// Card genérico de UM registro (ou de um GRUPO multi-dente do mesmo procedimento).
// Fiscalização legível: tipo · âncora · estado · data clínica · retroativo · autor+CRO
// · assinatura. Texto tingido usa os tokens -ink (nunca cor cheia — §2 do DESIGN, o
// bug de contraste recorrente da casa). O corpo de especialidade (camada 3: tabela de
// endo, chips de orto) entra como `children`, colapsável.

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  TIPO_LABEL,
  corDoRegistro,
  type TipoRegistroOdontograma,
  type StatusRegistro,
  type OrigemRegistro,
  type AncoraClinica,
} from '@/types/odontograma';

/** View-model do card — a ficha (Fase 4) mapeia os eventos crus pra cá. */
export interface RegistroCardData {
  tipo: TipoRegistroOdontograma;
  status: StatusRegistro;
  origem: OrigemRegistro;
  /** 1 âncora (registro único) ou N (grupo multi-dente do mesmo procedimento). */
  ancoras: AncoraClinica[];
  /** Data clínica (YYYY-MM-DD) — null em indicado/pré-existente sem data. */
  realizadoEm: string | null;
  /** Timestamp ISO em que o registro entrou no prontuário. */
  registradoEm: string;
  autorNome: string;
  autorCro: string | null;
  /** Ficha assinada pelo paciente. */
  assinada: boolean;
  /** Observação do procedimento (material, técnica, intercorrência) — itálico sob o título. */
  observacao: string | null;
  /** Dado clínico da especialidade (migration 106) — cru, ainda não validado por schema. */
  detalhe: unknown | null;
}

export interface RegistroCardProps {
  data: RegistroCardData;
  /** Corpo de especialidade (camada 3) — só passe quando há dado (I2). Torna o card colapsável. */
  children?: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * Alterna planejado ⇄ realizado. Só passe quando o usuário PODE escrever (autor,
   * ficha não assinada) — sem isso o pill é só leitura. Bug 21/07: na ficha salva
   * não havia caminho pra marcar o que foi feito, tudo ficava "Planejado".
   */
  onToggleStatus?: () => void;
}

const PILL: Record<'coral' | 'teal' | 'slate', { label: string; wrap: string; dot: string }> = {
  teal:  { label: 'Realizado',     wrap: 'bg-teal-pale text-teal-ink',   dot: 'bg-teal' },
  coral: { label: 'Planejado',     wrap: 'bg-coral-pale text-coral-ink', dot: 'bg-coral' },
  slate: { label: 'Pré-existente', wrap: 'bg-slate-pale text-slate-ink', dot: 'bg-slate' },
};

/** DD/MM/AAAA de um 'YYYY-MM-DD' SEM new Date() — evita o shift de fuso (UTC) que a casa já corrigiu. */
function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Data BRT (YYYY-MM-DD) de um timestamp — pra comparar com a data clínica sem shift. */
function dataBRT(ts: string): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Letras das faces unidas de todas as âncoras (M·O·D → "MOD"); '' se não houver.
 * União porque um card pode representar N eventos de face MESCLADOS do mesmo dente
 * (o Dex emite 1 evento por face; a UI junta — feedback 21/07).
 */
function facesTitulo(ancoras: AncoraClinica[]): string {
  return [...new Set(ancoras.flatMap((a) => a.faces ?? []))].join('');
}

/** Resumo da âncora pro título: "dente 36" · "dentes 31 · 41 · 42" · "arcada superior" · "quadrante 3". */
function resumoAncora(ancoras: AncoraClinica[]): string {
  const primeiro = ancoras[0];
  if (!primeiro) return '';
  if (primeiro.nivel === 'arcada') return `arcada ${primeiro.arcada ?? ''}`.trim();
  if (primeiro.nivel === 'quadrante') return `quadrante ${primeiro.quadrante ?? ''}`.trim();
  const dentes = [...new Set(ancoras.map((a) => a.dente).filter((d): d is number => d != null))];
  if (dentes.length === 0) return '';
  return dentes.length === 1 ? `dente ${dentes[0]}` : `dentes ${dentes.join(' · ')}`;
}

export function RegistroCard({ data, children, defaultOpen = false, onToggleStatus }: RegistroCardProps) {
  const [aberto, setAberto] = useState(defaultOpen);
  const cor = corDoRegistro(data.status, data.origem);
  const pill = PILL[cor];

  const faces = facesTitulo(data.ancoras);
  const titulo = `${TIPO_LABEL[data.tipo]}${faces ? ` ${faces}` : ''} · ${resumoAncora(data.ancoras)}`;

  const retroativo = data.realizadoEm != null && dataBRT(data.registradoEm) > data.realizadoEm;
  const temCorpo = children != null;

  return (
    <article className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={temCorpo ? () => setAberto((v) => !v) : undefined}
        aria-expanded={temCorpo ? aberto : undefined}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${temCorpo ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-text-primary truncate">{titulo}</p>
          {data.observacao && (
            <p className="text-xs text-text-secondary italic mt-0.5 truncate">&ldquo;{data.observacao}&rdquo;</p>
          )}
          <p className="text-xs text-text-secondary mt-0.5">
            {data.realizadoEm && (
              <span>
                Realizado em <span className="font-mono tabular-nums">{fmtData(data.realizadoEm)}</span>
                {retroativo && <span className="text-warning-ink font-medium"> (retroativo)</span>}
                {' · '}
              </span>
            )}
            <span>
              {data.autorNome}
              {data.autorCro && <span className="font-mono"> · {data.autorCro}</span>}
            </span>
            {data.assinada && <span className="text-teal-ink"> · Assinatura coletada ✓</span>}
          </p>
        </div>

        {onToggleStatus ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleStatus(); }
            }}
            title={data.status === 'realizado' ? 'Marcar como planejado' : 'Marcar como realizado'}
            className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-teal ${pill.wrap}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
            {pill.label}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${pill.wrap}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pill.dot}`} />
            {pill.label}
          </span>
        )}

        {temCorpo && (
          <ChevronRight
            className={`w-4 h-4 shrink-0 text-text-secondary transition-transform ${aberto ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {temCorpo && aberto && (
        <div className="border-t border-border bg-surface-alt/40 px-4 py-3">{children}</div>
      )}
    </article>
  );
}
