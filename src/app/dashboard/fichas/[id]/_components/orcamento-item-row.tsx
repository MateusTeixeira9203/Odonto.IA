"use client";

import { useState } from "react";
import type { PlanejamentoEtapa, OrcamentoItem } from "@/types/database";

type EtapaStatus = "aberto" | "pendente" | "concluido";

const ETAPA_STATUS_LABEL: Record<EtapaStatus, string> = {
  aberto: "Aberto",
  pendente: "Pendente",
  concluido: "Concluído",
};

function etapaStatusClassName(status: EtapaStatus): string {
  if (status === "concluido") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (status === "pendente") return "bg-primary/15 text-primary";
  return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
}

interface OrcamentoItemRowProps {
  etapa: PlanejamentoEtapa;
  item: OrcamentoItem | undefined;
  onStatusChange: (etapa: PlanejamentoEtapa, status: EtapaStatus) => void;
  onPrecoSalvo: (etapaId: string, itemId: string, preco: number | null) => void;
}

export function OrcamentoItemRow({
  etapa,
  item,
  onStatusChange,
  onPrecoSalvo,
}: OrcamentoItemRowProps): React.JSX.Element {
  const [preco, setPreco] = useState(
    item?.preco_unitario != null ? String(item.preco_unitario) : ""
  );
  const s = (etapa.status as EtapaStatus) ?? "aberto";

  function handleBlur(): void {
    if (!item) return;
    const valor = preco.trim() === "" ? null : Number(preco);
    const atual = item.preco_unitario;
    if ((valor === null && atual === null) || valor === atual) return;
    onPrecoSalvo(etapa.id, item.id, valor);
  }

  return (
    <div
      className="grid items-center gap-3 rounded border border-brand-border bg-brand-bg px-3 py-2.5"
      style={{ gridTemplateColumns: "1fr 100px 140px 110px" }}
    >
      <div>
        <p className="font-sans text-sm text-brand-black">{etapa.titulo}</p>
        {etapa.descricao_simples && (
          <p className="font-mono text-xs text-brand-muted mt-0.5 truncate">
            {etapa.descricao_simples}
          </p>
        )}
      </div>

      {/* Status interativo */}
      <div
        className={`relative inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-medium w-fit ${etapaStatusClassName(s)}`}
      >
        {ETAPA_STATUS_LABEL[s]}
        <select
          value={s}
          onChange={(e) => onStatusChange(etapa, e.target.value as EtapaStatus)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        >
          <option value="aberto">Aberto</option>
          <option value="pendente">Pendente</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>

      <p className="font-mono text-xs text-brand-muted">
        {(etapa.dentes ?? []).length > 0
          ? (etapa.dentes ?? [])
              .sort((a, b) => Number(a) - Number(b))
              .join(", ")
          : "—"}
      </p>

      <div className="flex items-center justify-end">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-brand-muted">
            R$
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            onBlur={handleBlur}
            placeholder="0,00"
            className="w-24 rounded border border-brand-border bg-white pl-7 pr-2 py-1.5 font-mono text-xs text-brand-black text-right focus:border-teal focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
