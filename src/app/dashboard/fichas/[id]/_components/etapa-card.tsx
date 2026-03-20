"use client";

import { Image as ImageIcon, Pencil, X } from "lucide-react";
import { ETAPA_STATUS_LABEL, etapaStatusClassName, type EtapaStatus } from "./ficha-helpers";
import type { FichaArquivo, PlanejamentoEtapa } from "@/types/database";

interface EtapaCardProps {
  etapa: PlanejamentoEtapa;
  index: number;
  imageName: string | null;
  isVinculando: boolean;
  radiografias: FichaArquivo[];
  onStatusChange: (etapa: PlanejamentoEtapa, status: EtapaStatus) => void;
  onAbrirVincularImagem: () => void;
  onFecharVincularImagem: () => void;
  onVincularImagem: (etapaId: string, arquivoId: string | null) => void;
  onEditar: () => void;
  onRemover: () => void;
}

export function EtapaCard({
  etapa,
  index,
  imageName,
  isVinculando,
  radiografias,
  onStatusChange,
  onAbrirVincularImagem,
  onFecharVincularImagem,
  onVincularImagem,
  onEditar,
  onRemover,
}: EtapaCardProps): React.JSX.Element {
  const status = (etapa.status as EtapaStatus) ?? "aberto";

  return (
    <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-surface font-mono text-xs text-brand-muted">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div
              title="Clique para alterar o status"
              className={`relative inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-medium ${etapaStatusClassName(status)}`}
            >
              {ETAPA_STATUS_LABEL[status]}
              <select
                value={status}
                onChange={(event) => onStatusChange(etapa, event.target.value as EtapaStatus)}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                onClick={(event) => event.stopPropagation()}
              >
                <option value="aberto">Aberto</option>
                <option value="pendente">Pendente</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>

            {(etapa.dentes ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {[...(etapa.dentes ?? [])]
                  .sort((a, b) => Number(a) - Number(b))
                  .map((dente) => (
                    <span
                      key={dente}
                      className="inline-flex items-center rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[0.65rem] text-teal"
                    >
                      {dente}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <p className="font-sans text-sm font-medium text-brand-black">{etapa.titulo}</p>

          {etapa.descricao_simples && (
            <p className="font-sans text-xs text-brand-muted">{etapa.descricao_simples}</p>
          )}

          {etapa.imagem_arquivo_id && (
            <div className="flex items-center gap-1.5">
              <ImageIcon size={11} className="text-brand-muted" />
              <span className="font-mono text-[0.65rem] text-brand-muted">
                {imageName ?? "Imagem vinculada"}
              </span>
              <button
                className="text-brand-muted/50 transition-colors hover:text-red-400"
                onClick={() => onVincularImagem(etapa.id, null)}
                title="Desvincular imagem"
              >
                <X size={10} />
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isVinculando ? (
            <div className="flex items-center gap-1">
              <select
                className="rounded border border-brand-border bg-white px-1.5 py-1 font-sans text-xs"
                defaultValue={etapa.imagem_arquivo_id ?? ""}
                onChange={(event) => onVincularImagem(etapa.id, event.target.value || null)}
                autoFocus
              >
                <option value="">Sem imagem</option>
                {radiografias.map((radiografia) => (
                  <option key={radiografia.id} value={radiografia.id}>
                    {radiografia.nome_original}
                  </option>
                ))}
              </select>
              <button
                className="text-brand-muted hover:text-brand-black"
                onClick={onFecharVincularImagem}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            radiografias.length > 0 && (
              <button
                className="flex size-7 items-center justify-center rounded text-brand-muted transition-colors hover:text-teal"
                onClick={onAbrirVincularImagem}
                title="Vincular radiografia"
              >
                <ImageIcon size={13} />
              </button>
            )
          )}

          <button
            className="flex size-7 items-center justify-center rounded text-brand-muted transition-colors hover:text-brand-black"
            onClick={onEditar}
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            className="flex size-7 items-center justify-center rounded text-brand-muted transition-colors hover:text-red-500"
            onClick={onRemover}
            title="Remover"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
