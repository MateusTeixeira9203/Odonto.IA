'use client';

// Painel de detalhe de UM dente (Odontograma v3 — Fatia A).
// Design aprovado 18/07 (DESIGN-odontograma-v3.md §3): dente anatômico real como
// figura + mapa oclusal contornado pras 5 faces. Toque cicla estados; NADA persiste
// aqui — o painel só edita o rascunho de eventos; salvar é do "Confirmar e salvar"
// da tela-mãe (invariante #1).

import { useMemo, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  faceLabel,
  corDoRegistro,
  TIPO_LABEL,
  type FaceDental,
  type OdontogramaEventoDraft,
  type TipoRegistroOdontograma,
  type StatusRegistro,
  type AncoraClinica,
} from '@/types/odontograma';
import { TOOTH_CLASS, DIMS, occlusalContourPath, occlusalZonePoints, occlusalLabelPos } from './tooth-geometry';
import { ToothSVG, buildResumos, TOOTH_NAMES, getQuadrantLabel } from './Odontograma';
// Detalhe de especialidade (migration 106) — resolvido por tipo CONCRETO, não pelo
// registry apagado (o registry só lê metadados; Form/Card são invocados com o tipo
// real, mesma convenção do orto em FichasTab).
import { endoDetalheSchema } from '@/lib/especialidades/endo';
import { EndoForm } from '@/components/fichas/endo-form';
import { implanteDetalheSchema } from '@/lib/especialidades/implante';
import { ImplanteForm } from '@/components/fichas/implante-form';

const FACES: FaceDental[] = ['V', 'M', 'O', 'D', 'L'];

const COR_TOKEN = {
  coral: 'var(--color-coral)',
  teal:  'var(--color-teal)',
  slate: 'var(--color-slate)',
} as const;

// Versão calibrada pra TEXTO (a cor cheia acima reprova AA em light mode sobre o
// próprio fundo tingido — achado auditoria UX 19/07). Fill/borda/ponto continuam
// usando COR_TOKEN normalmente; só cor-de-texto usa este mapa.
const COR_TOKEN_INK = {
  coral: 'var(--color-coral-ink)',
  teal:  'var(--color-teal-ink)',
  slate: 'var(--color-slate-ink)',
} as const;

/** Rótulo falado do estado de uma face, pro aria-label — cor sozinha não é
 * acessível (achado auditoria UX 19/07, CRITICAL #3: faces eram inoperáveis
 * por teclado/leitor de tela). */
const ROTULO_ESTADO_FACE = { coral: 'a fazer', teal: 'feito', slate: 'pré-existente' } as const;

/** Chips de ação a nível de dente inteiro — cada um cicla os `modos` e depois remove. */
const CHIPS: { tipo: TipoRegistroOdontograma; modos: StatusRegistro[] }[] = [
  { tipo: 'endodontia',       modos: ['indicado', 'realizado'] },
  { tipo: 'coroa',            modos: ['indicado', 'realizado'] },
  { tipo: 'implante',         modos: ['indicado', 'realizado'] },
  { tipo: 'pino_nucleo',      modos: ['indicado', 'realizado'] },
  { tipo: 'exodontia',        modos: ['indicado', 'realizado'] },
  { tipo: 'inclusao',         modos: ['indicado'] },
  { tipo: 'fratura',          modos: ['indicado'] },
  { tipo: 'lesao_periapical', modos: ['indicado'] },
  { tipo: 'selante',          modos: ['realizado'] },
];

export interface ToothDetailPanelProps {
  dente: number;
  /** Lista COMPLETA de rascunhos (o painel filtra e devolve a lista completa editada). */
  eventos: OdontogramaEventoDraft[];
  onChange: (eventos: OdontogramaEventoDraft[]) => void;
  onClose: () => void;
  /** Data clínica default pros "realizado" (YYYY-MM-DD) — o dentista pode sobrescrever por evento. */
  dataPadrao: string;
  readOnly?: boolean;
  className?: string;
}

export function ToothDetailPanel({
  dente,
  eventos,
  onChange,
  onClose,
  dataPadrao,
  readOnly = false,
  className,
}: ToothDetailPanelProps) {
  const superior = (dente >= 11 && dente <= 28) || (dente >= 51 && dente <= 65);
  const doDente = useMemo(
    () => eventos.filter((e) => e.ancora.dente === dente),
    [eventos, dente],
  );
  const resumo = useMemo(() => buildResumos(doDente).get(dente) ?? null, [doDente, dente]);

  const cls = TOOTH_CLASS[dente] ?? 'premolar';
  const { crownH, rootH } = DIMS[cls];
  const totalH = crownH + rootH;
  const scale = 1.7;
  const temPreexistente = doDente.some((e) => e.origem === 'preexistente');

  // Detalhe de especialidade (migration 106) — só endo/implante têm Form hoje. Um aberto
  // por vez (regra do artefato de dois-modos §02): abrir outro fecha o anterior.
  const [detalheAbertoIdx, setDetalheAbertoIdx] = useState<number | null>(null);

  function atualizarDetalhe(evento: OdontogramaEventoDraft, detalhe: unknown) {
    onChange(eventos.map((e) => (e === evento ? { ...e, detalhe } : e)));
  }

  const novo = (
    tipo: TipoRegistroOdontograma,
    status: StatusRegistro,
    ancora: AncoraClinica,
  ): OdontogramaEventoDraft => ({
    tipo,
    status,
    origem: 'clinica',
    ancora,
    grupo_id: null,
    papel_no_grupo: null,
    observacao: '',
    realizado_em: status === 'realizado' ? dataPadrao : null,
  });

  /** Toque numa face: sem registro → a fazer → feito → remove (pré-existente reclassifica antes). */
  function cycleFace(face: FaceDental) {
    if (readOnly) return;
    const all = [...eventos];
    const i = all.findIndex(
      (e) => e.tipo === 'carie_restauracao' && e.ancora.dente === dente && (e.ancora.faces ?? []).includes(face),
    );
    if (i === -1) {
      all.push(novo('carie_restauracao', 'indicado', { nivel: 'face', dente, faces: [face] }));
    } else {
      const e = all[i];
      if (e.status === 'indicado') {
        all[i] = { ...e, status: 'realizado', origem: 'clinica', realizado_em: dataPadrao };
      } else if (e.origem === 'preexistente') {
        // badge "reclassificar": vira "feito nesta clínica" mantendo realizado
        all[i] = { ...e, origem: 'clinica', realizado_em: e.realizado_em ?? dataPadrao };
      } else {
        const faces = (e.ancora.faces ?? []).filter((f) => f !== face);
        if (faces.length > 0) all[i] = { ...e, ancora: { ...e.ancora, faces } };
        else all.splice(i, 1);
      }
    }
    onChange(all);
  }

  /** Chips / raiz: cicla os modos do tipo e depois remove. */
  function cycleDenteTipo(tipo: TipoRegistroOdontograma, modos: StatusRegistro[]) {
    if (readOnly) return;
    const all = [...eventos];
    const i = all.findIndex((e) => e.tipo === tipo && e.ancora.dente === dente);
    if (i === -1) {
      const ancora: AncoraClinica =
        tipo === 'selante' ? { nivel: 'face', dente, faces: ['O'] } : { nivel: 'dente', dente };
      all.push(novo(tipo, modos[0], ancora));
      // Endo/implante acabaram de ganhar tabela (migration 106) — abre sozinha na criação,
      // senão o dentista nunca descobre que ela existe (é o "preciso que apareça" de 21/07).
      if (tipo === 'endodontia' || tipo === 'implante') {
        setDetalheAbertoIdx(all.filter((e) => e.ancora.dente === dente).length - 1);
      }
    } else {
      const e = all[i];
      const pos = modos.indexOf(e.status);
      const next = pos === -1 ? null : modos[pos + 1] ?? null;
      if (next == null) all.splice(i, 1);
      else all[i] = { ...e, status: next, origem: 'clinica', realizado_em: next === 'realizado' ? (e.realizado_em ?? dataPadrao) : null };
    }
    onChange(all);
  }

  function setData(evento: OdontogramaEventoDraft, data: string) {
    onChange(eventos.map((e) => (e === evento ? { ...e, realizado_em: data || null } : e)));
  }

  function remover(evento: OdontogramaEventoDraft) {
    if (readOnly) return;
    onChange(eventos.filter((e) => e !== evento));
  }

  function corFace(face: FaceDental): 'coral' | 'teal' | 'slate' | null {
    // Selante pinta a O; cárie/restauração pinta a face declarada.
    const ev = doDente.find(
      (e) =>
        (e.tipo === 'carie_restauracao' || e.tipo === 'selante') &&
        (e.ancora.faces ?? []).includes(face),
    );
    return ev ? corDoRegistro(ev.status, ev.origem) : null;
  }

  function chipEstado(tipo: TipoRegistroOdontograma) {
    const ev = doDente.find((e) => e.tipo === tipo);
    return ev ? corDoRegistro(ev.status, ev.origem) : null;
  }

  const rootFrac = rootH / totalH;

  return (
    <div
      className={cn('rounded-xl border p-4 flex flex-col gap-3', className)}
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      role="region"
      aria-label={`Detalhe do dente ${dente}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-[15px]" style={{ color: 'var(--color-text-primary)' }}>{dente}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {TOOTH_NAMES[dente] ?? ''}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{getQuadrantLabel(dente)}</span>
        {temPreexistente && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
            style={{ background: 'var(--color-slate-pale)', color: 'var(--color-slate-ink)' }}
          >
            Pré-existente
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-teal"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Fechar painel do dente"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Figuras: dente anatômico + mapa oclusal ── */}
      <div className="flex items-center justify-center gap-6 py-1">
        {/* Dente anatômico (mesma geometria da arcada, ampliado) + raiz tocável */}
        <div
          className="relative"
          style={{ height: totalH * scale, width: DIMS[cls].w * scale }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <ToothSVG
              num={dente}
              isUpper={superior}
              state="default"
              hovered={false}
              showCheckbox={false}
              resumo={resumo}
            />
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => cycleDenteTipo('endodontia', ['indicado', 'realizado'])}
              className="absolute left-0 right-0 outline-none focus-visible:ring-1 focus-visible:ring-teal rounded"
              style={
                superior
                  ? { top: 0, height: `${rootFrac * 100}%` }
                  : { bottom: 0, height: `${rootFrac * 100}%` }
              }
              aria-label="Alternar canal (endodontia)"
              title="Tocar a raiz alterna o canal"
            />
          )}
        </div>

        {/* Mapa oclusal — as 5 faces tocáveis */}
        <div className="flex flex-col items-center gap-1.5">
          <svg width={132} height={132} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
            <defs>
              <clipPath id={`occl-clip-${dente}`}>
                <path d={occlusalContourPath(dente)} />
              </clipPath>
              <pattern id={`occl-dots-${dente}`} width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="var(--color-surface)" />
              </pattern>
            </defs>
            <g clipPath={`url(#occl-clip-${dente})`}>
              {FACES.map((face) => {
                const cor = corFace(face);
                const rotulo = `Face ${faceLabel(face, dente)} — ${cor ? ROTULO_ESTADO_FACE[cor] : 'sem registro'}`;
                return (
                  <polygon
                    key={face}
                    points={occlusalZonePoints(face, dente)}
                    onClick={() => cycleFace(face)}
                    role={readOnly ? undefined : 'button'}
                    tabIndex={readOnly ? undefined : 0}
                    aria-label={readOnly ? undefined : rotulo}
                    onKeyDown={readOnly ? undefined : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleFace(face); }
                    }}
                    className={readOnly ? undefined : 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal'}
                    style={{
                      fill: cor
                        ? `color-mix(in srgb, ${COR_TOKEN[cor]} ${cor === 'slate' ? 60 : 75}%, var(--color-surface-alt))`
                        : 'var(--color-surface-alt)',
                      stroke: 'var(--color-border)',
                      strokeWidth: 1,
                      cursor: readOnly ? 'default' : 'pointer',
                      transition: 'fill 0.15s ease',
                    }}
                  >
                    <title>{faceLabel(face, dente)}</title>
                  </polygon>
                );
              })}
              {FACES.map((face) =>
                corFace(face) === 'slate' ? (
                  <polygon
                    key={`dots-${face}`}
                    points={occlusalZonePoints(face, dente)}
                    style={{ fill: `url(#occl-dots-${dente})`, opacity: 0.5, pointerEvents: 'none' }}
                  />
                ) : null,
              )}
              {/* letras das faces */}
              {(['V', 'L', 'M', 'D', 'O'] as const).map((f) => {
                // Posição vem da geometria (respeita oval vs. molar) — bug de corte 21/07.
                const face = f as FaceDental;
                const { x: fx, y } = occlusalLabelPos(face, dente);
                return (
                  <text
                    key={f}
                    x={fx}
                    y={y}
                    textAnchor="middle"
                    style={{
                      fontSize: face === 'O' ? 11 : 9,
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      fill: corFace(face) ? 'var(--color-surface)' : 'var(--color-text-muted)',
                      pointerEvents: 'none',
                    }}
                  >
                    {f}
                  </text>
                );
              })}
            </g>
            <path
              d={occlusalContourPath(dente)}
              style={{ fill: 'none', stroke: 'var(--color-border)', strokeWidth: 1.6 }}
            />
          </svg>
          <span className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {faceLabel('O', dente)} · toque uma face
          </span>
        </div>
      </div>

      {/* ── Chips de ação (dente inteiro) ── */}
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {CHIPS.map(({ tipo, modos }) => {
            const cor = chipEstado(tipo);
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => cycleDenteTipo(tipo, modos)}
                className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all outline-none focus-visible:ring-1 focus-visible:ring-teal"
                style={{
                  background: cor
                    ? `color-mix(in srgb, ${COR_TOKEN[cor]} 16%, var(--color-surface-alt))`
                    : 'var(--color-surface-alt)',
                  color: cor ? COR_TOKEN_INK[cor] : 'var(--color-text-secondary)',
                  border: `1px solid ${cor ? `color-mix(in srgb, ${COR_TOKEN[cor]} 45%, var(--color-border))` : 'var(--color-border)'}`,
                }}
              >
                {TIPO_LABEL[tipo]}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Eventos do dente (com data clínica editável nos "realizado") ── */}
      {doDente.length > 0 && (
        <div className="flex flex-col pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {doDente.map((ev, i) => {
            const cor = corDoRegistro(ev.status, ev.origem);
            // Só endo/implante têm tabela de especialidade hoje (migration 106).
            const temDetalhe = ev.tipo === 'endodontia' || ev.tipo === 'implante';
            const aberto = detalheAbertoIdx === i;
            return (
              <div key={i} style={i > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}>
                <div className="flex items-center gap-2 py-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COR_TOKEN[cor] }} aria-hidden="true" />
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {TIPO_LABEL[ev.tipo]}
                  </span>
                  {(ev.ancora.faces ?? []).length > 0 && (
                    <span className="font-mono text-[10.5px]" style={{ color: 'var(--color-text-muted)' }}>
                      {(ev.ancora.faces ?? []).join(' ')}
                    </span>
                  )}
                  {ev.observacao && (
                    <span className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {ev.observacao}
                    </span>
                  )}
                  <div className="flex-1" />
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${COR_TOKEN[cor]} 15%, var(--color-surface-alt))`,
                      color: COR_TOKEN_INK[cor],
                    }}
                  >
                    {ev.status === 'indicado' ? 'A fazer' : ev.origem === 'preexistente' ? 'Pré-exist.' : 'Feito'}
                  </span>
                  {ev.status === 'realizado' && ev.origem === 'clinica' && !readOnly && (
                    <input
                      type="date"
                      value={ev.realizado_em ?? ''}
                      max={dataPadrao}
                      onChange={(e) => setData(ev, e.target.value)}
                      className="text-[10.5px] font-mono rounded-md px-1.5 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-teal"
                      style={{
                        background: 'var(--color-surface-alt)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                      aria-label={`Data do procedimento — ${TIPO_LABEL[ev.tipo]}`}
                    />
                  )}
                  {temDetalhe && (
                    <button
                      type="button"
                      onClick={() => setDetalheAbertoIdx(aberto ? null : i)}
                      className="flex items-center gap-0.5 text-[10.5px] font-bold shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-teal rounded px-1"
                      style={{ color: 'var(--color-teal-ink)' }}
                    >
                      {readOnly ? 'Ver tabela' : 'Detalhes'}
                      <ChevronRight size={11} strokeWidth={2.6} style={{ transform: aberto ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                    </button>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remover(ev)}
                      className="p-0.5 rounded outline-none focus-visible:ring-1 focus-visible:ring-teal shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={`Remover ${TIPO_LABEL[ev.tipo]}`}
                    >
                      <X size={12} strokeWidth={2.4} />
                    </button>
                  )}
                </div>

                {temDetalhe && aberto && (
                  <div className="pb-3 pl-4">
                    {ev.tipo === 'endodontia' && (
                      <EndoForm
                        valor={endoDetalheSchema.safeParse(ev.detalhe).success ? (endoDetalheSchema.parse(ev.detalhe)) : null}
                        onChange={(v) => atualizarDetalhe(ev, v)}
                        readOnly={readOnly}
                      />
                    )}
                    {ev.tipo === 'implante' && (
                      <ImplanteForm
                        valor={implanteDetalheSchema.safeParse(ev.detalhe).success ? (implanteDetalheSchema.parse(ev.detalhe)) : null}
                        onChange={(v) => atualizarDetalhe(ev, v)}
                        readOnly={readOnly}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
