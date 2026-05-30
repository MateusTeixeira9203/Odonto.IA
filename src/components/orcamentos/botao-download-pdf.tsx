"use client";

import { FileDown } from "lucide-react";

interface BotaoDownloadPDFProps {
  orcamentoId: string;
}

export function BotaoDownloadPDF({ orcamentoId }: BotaoDownloadPDFProps) {
  return (
    <button
      onClick={() => window.open(`/api/orcamentos/${orcamentoId}/pdf`, '_blank')}
      className="p-2 rounded-xl hover:bg-surface-alt transition-colors text-text-secondary hover:text-text-primary"
      title="Visualizar / Imprimir PDF"
    >
      <FileDown className="w-4 h-4" />
    </button>
  );
}
