"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/dentai";
import { OrcamentoItemRow } from "./orcamento-item-row";
import type { PlanejamentoEtapa, Orcamento, OrcamentoItem } from "@/types/database";

type EtapaStatus = "aberto" | "pendente" | "concluido";
type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado";

const ORC_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const ORC_STATUS_VARIANT: Record<OrcamentoStatus, "gray" | "teal" | "success" | "error"> = {
  rascunho: "gray",
  enviado: "teal",
  aprovado: "success",
  recusado: "error",
};

interface TabOrcamentoProps {
  etapas: PlanejamentoEtapa[];
  orcamento: Orcamento | null;
  orcamentoItens: OrcamentoItem[];
  onStatusOrcamento: (status: OrcamentoStatus) => void;
  onStatusChange: (etapa: PlanejamentoEtapa, status: EtapaStatus) => void;
  onPrecoSalvo: (etapaId: string, itemId: string, preco: number | null) => void;
  onIrParaPlanejamento: () => void;
}

export function TabOrcamento({
  etapas,
  orcamento,
  orcamentoItens,
  onStatusOrcamento,
  onStatusChange,
  onPrecoSalvo,
  onIrParaPlanejamento,
}: TabOrcamentoProps): React.JSX.Element {
  if (etapas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Receipt size={40} className="text-brand-muted/30" />
          <p className="font-serif text-lg text-brand-black">Nenhum orçamento gerado</p>
          <p className="font-sans text-sm text-brand-muted max-w-xs">
            Adicione etapas no Planejamento para gerar um orçamento automaticamente
          </p>
          <Button variant="outline" className="mt-2" onClick={onIrParaPlanejamento}>
            Ir para Planejamento
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalCalculado = orcamento?.total;
  const todosPrecosPreenchidos = orcamentoItens.every((i) => i.preco_total != null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
            Orçamento
          </p>
          <div className="flex items-center gap-3">
            {orcamento && (
              <div className="relative inline-flex" title="Clique para alterar o status">
                <Badge
                  variant={
                    ORC_STATUS_VARIANT[orcamento.status as OrcamentoStatus] ?? "gray"
                  }
                >
                  {ORC_STATUS_LABEL[orcamento.status as OrcamentoStatus] ??
                    orcamento.status}
                </Badge>
                <select
                  value={orcamento.status}
                  onChange={(e) => onStatusOrcamento(e.target.value as OrcamentoStatus)}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="enviado">Enviado</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="recusado">Recusado</option>
                </select>
              </div>
            )}
            <p className="font-mono text-xs text-brand-muted">
              {etapas.length} etapa{etapas.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Cabeçalho da tabela */}
        <div
          className="grid font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted px-3 pb-1"
          style={{ gridTemplateColumns: "1fr 100px 140px 110px" }}
        >
          <span>Procedimento</span>
          <span>Status</span>
          <span>Dentes</span>
          <span className="text-right">Valor (R$)</span>
        </div>

        {/* Itens */}
        {etapas.map((etapa) => (
          <OrcamentoItemRow
            key={etapa.id}
            etapa={etapa}
            item={orcamentoItens.find((i) => i.etapa_id === etapa.id)}
            onStatusChange={onStatusChange}
            onPrecoSalvo={onPrecoSalvo}
          />
        ))}

        {/* Total */}
        <div className="flex items-center justify-between pt-3 border-t border-brand-border">
          <p className="font-mono text-xs text-brand-muted">
            {!todosPrecosPreenchidos
              ? "Preencha os valores para calcular o total"
              : "Total calculado automaticamente"}
          </p>
          <p className="font-mono text-sm font-semibold text-brand-black">
            {totalCalculado != null
              ? new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalCalculado)
              : "—"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
