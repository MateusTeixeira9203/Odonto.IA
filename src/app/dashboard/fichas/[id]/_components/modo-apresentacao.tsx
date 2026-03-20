"use client";

import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import type { PlanejamentoEtapa } from "@/types/database";

type EtapaStatus = "aberto" | "pendente" | "concluido";

const ETAPA_STATUS_LABEL: Record<EtapaStatus, string> = {
  aberto: "Aberto",
  pendente: "Pendente",
  concluido: "Concluído",
};

interface ModoApresentacaoProps {
  etapas: PlanejamentoEtapa[];
  index: number;
  signedUrls: Record<string, string>;
  onClose: () => void;
  onAnterior: () => void;
  onProximo: () => void;
  onIndexChange: (i: number) => void;
}

export function ModoApresentacao({
  etapas,
  index,
  signedUrls,
  onClose,
  onAnterior,
  onProximo,
  onIndexChange,
}: ModoApresentacaoProps): React.JSX.Element | null {
  const etapa = etapas[index];
  if (!etapa) return null;

  const imagemUrl = etapa.imagem_arquivo_id
    ? signedUrls[etapa.imagem_arquivo_id]
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-white/30">
            Etapa {index + 1} / {etapas.length}
          </p>
          <p className="font-sans text-sm text-white/60">{etapa.titulo}</p>
        </div>
        <button
          className="flex size-8 items-center justify-center rounded text-white/60 hover:text-white transition-colors"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo */}
        <div className="flex flex-col justify-center px-12 py-8 w-80 shrink-0 border-r border-white/10 space-y-4">
          <p className="font-mono text-[0.6rem] uppercase tracking-widest text-white/30">
            Etapa {index + 1}
          </p>
          <p className="font-serif text-xl text-white leading-snug">{etapa.titulo}</p>

          {(etapa.dentes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...(etapa.dentes ?? [])]
                .sort((a, b) => Number(a) - Number(b))
                .map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-teal/20 px-2.5 py-0.5 font-mono text-xs text-teal"
                  >
                    Dente {d}
                  </span>
                ))}
            </div>
          )}

          {etapa.descricao_simples && (
            <p className="font-sans text-sm text-white/50">{etapa.descricao_simples}</p>
          )}

          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 font-mono text-xs ${
              (etapa.status as EtapaStatus) === "concluido"
                ? "bg-green-500/20 text-green-400"
                : (etapa.status as EtapaStatus) === "pendente"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {ETAPA_STATUS_LABEL[(etapa.status as EtapaStatus) ?? "aberto"]}
          </span>
        </div>

        {/* Painel direito: imagem */}
        <div className="flex flex-1 items-center justify-center p-8">
          {imagemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagemUrl}
              alt={etapa.titulo}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ImageIcon className="size-16 text-white/10" />
              <p className="font-mono text-xs text-white/20">Sem imagem vinculada</p>
            </div>
          )}
        </div>
      </div>

      {/* Setas de navegação */}
      {etapas.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={onAnterior}
          >
            <ChevronLeft size={24} />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={onProximo}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Dots de progresso */}
      <div className="flex items-center justify-center gap-2 py-4">
        {etapas.map((_, i) => (
          <button
            key={i}
            className={`rounded-full transition-all ${
              i === index
                ? "size-2.5 bg-white"
                : "size-1.5 bg-white/30 hover:bg-white/50"
            }`}
            onClick={() => onIndexChange(i)}
          />
        ))}
      </div>
    </div>
  );
}
