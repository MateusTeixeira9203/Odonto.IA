"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Search,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  marcarPagamentoPago,
  atualizarStatusOrcamento,
  type FormaPagamento,
  type StatusOrcamento,
} from "../actions";
import type { OrcamentoEnriquecido, MetricasMes } from "./types";

// ── Status configs ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  rascunho: {
    label: "Rascunho",
    className: "bg-muted text-muted-foreground border border-border",
  },
  enviado: {
    label: "Enviado",
    className: "bg-teal-lt/20 text-teal-dark border border-teal/20",
  },
  aprovado: {
    label: "Aprovado",
    className: "bg-teal/10 text-teal border border-teal/20",
  },
  recusado: {
    label: "Recusado",
    className: "bg-red-500/10 text-red-500 border border-red-500/20",
  },
};

const PAGAMENTO_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400",
  },
  pago: {
    label: "Pago",
    className:
      "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border border-destructive/20",
  },
};

const FORMA_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  outro: "Outro",
};

function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  orcamentos: OrcamentoEnriquecido[];
  metricas: MetricasMes;
}

export function OrcamentosClient({ orcamentos, metricas }: Props): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [formas, setFormas] = useState<Record<string, FormaPagamento>>({});

  const selectedOrcamento = orcamentos.find((o) => o.id === orcamentoId) ?? null;

  const mesesDisponiveis = Array.from(
    new Set(orcamentos.map((o) => o.created_at.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const filtrados = orcamentos.filter((o) => {
    if (busca && !o.paciente.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
    if (filtroMes !== "todos" && !o.created_at.startsWith(filtroMes)) return false;
    return true;
  });

  async function handleAtualizarStatus(id: string, status: StatusOrcamento): Promise<void> {
    const result = await atualizarStatusOrcamento(id, status);
    if (result.error) toast.error(`Erro: ${result.error}`);
    else router.refresh();
  }

  async function handleMarcarPago(pagamentoId: string): Promise<void> {
    const forma = formas[pagamentoId];
    if (!forma) { toast.error("Selecione a forma de pagamento"); return; }
    startTransition(async () => {
      const result = await marcarPagamentoPago(pagamentoId, forma);
      if (result.error) toast.error(`Erro: ${result.error}`);
      else { toast.success("Pagamento marcado como pago"); router.refresh(); }
    });
  }

  const sheetPendente = selectedOrcamento
    ? selectedOrcamento.pagamentos.filter((p) => p.status === "pendente").reduce((a, p) => a + Number(p.valor), 0)
    : 0;
  const sheetPago = selectedOrcamento
    ? selectedOrcamento.pagamentos.filter((p) => p.status === "pago").reduce((a, p) => a + Number(p.valor), 0)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-8 max-w-7xl mx-auto w-full"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-10">
        <h1 className="font-serif text-4xl text-text-primary">Orçamentos</h1>
        <Link
          href="/dashboard/fichas/nova"
          className="bg-teal text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-teal-dark transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </Link>
      </header>

      {/* ── Métricas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Aprovados do mês */}
        <div className="rounded-2xl border border-teal/20 bg-teal/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-teal/10 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-teal" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-teal">
              Aprovados
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-teal leading-none">
            {formatBRL(metricas.aprovadosMes)}
          </p>
          <p className="font-mono text-[10px] text-teal/60 mt-1.5 uppercase tracking-wider">
            do mês
          </p>
        </div>

        {/* Pendentes */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Pendentes
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-300 leading-none">
            {formatBRL(metricas.pendente)}
          </p>
          <p className="font-mono text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1.5 uppercase tracking-wider">
            a receber
          </p>
        </div>

        {/* Taxa de conversão */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Conversão
            </span>
          </div>
          <p className="font-mono text-2xl font-bold text-foreground leading-none">
            {metricas.taxaConversao}%
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider">
            aprovados / criados
          </p>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar paciente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-surface-alt border border-border rounded-xl font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal/40 transition-colors"
          />
        </div>

        <Select value={filtroStatus} onValueChange={(v) => { if (v) setFiltroStatus(v); }}>
          <SelectTrigger className="w-36 h-10 rounded-xl bg-muted border-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroMes} onValueChange={(v) => { if (v) setFiltroMes(v); }}>
          <SelectTrigger className="w-44 h-10 rounded-xl bg-muted border-0">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {mesesDisponiveis.map((m) => (
              <SelectItem key={m} value={m}>
                {format(new Date(`${m}-01`), "MMMM yyyy", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-2xl border border-border">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mb-4" />
          <p className="font-serif text-base text-foreground mb-1">Nenhum orçamento encontrado</p>
          <p className="font-sans text-sm text-muted-foreground">
            {busca || filtroStatus !== "todos" ? "Tente outros filtros" : "Crie o primeiro orçamento"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3.5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                  ID / Data
                </th>
                <th className="text-left px-4 py-3.5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                  Paciente
                </th>
                <th className="text-right px-4 py-3.5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                  Valor Total
                </th>
                <th className="text-left px-4 py-3.5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="w-8 px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((orc, i) => {
                const statusCfg = STATUS_CONFIG[orc.status] ?? {
                  label: orc.status,
                  className: "bg-muted text-muted-foreground border border-border",
                };
                return (
                  <tr
                    key={orc.id}
                    onClick={() => setOrcamentoId(orc.id)}
                    className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${
                      i === filtrados.length - 1 ? "border-b-0" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-[0.6rem] text-muted-foreground/60 border border-border rounded px-1.5 py-0.5 inline-block">
                        #{orc.id.split("-")[0].toUpperCase()}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {format(new Date(orc.created_at), "dd/MM/yyyy")}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-sans text-sm font-medium text-foreground">{orc.paciente.nome}</p>
                      <p className="font-mono text-xs text-muted-foreground">{orc.dentista.nome}</p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-sm font-semibold text-foreground text-right">
                      {orc.total != null ? formatBRL(orc.total) : "—"}
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div
                        className={`relative inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}
                      >
                        {statusCfg.label}
                        <select
                          value={orc.status}
                          onChange={(e) => void handleAtualizarStatus(orc.id, e.target.value as StatusOrcamento)}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        >
                          <option value="rascunho">Rascunho</option>
                          <option value="enviado">Enviado</option>
                          <option value="aprovado">Aprovado</option>
                          <option value="recusado">Recusado</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Sheet de detalhe ──────────────────────────────────────────────── */}
      <Sheet open={orcamentoId !== null} onOpenChange={(open) => { if (!open) setOrcamentoId(null); }}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto p-0">
          {selectedOrcamento && (
            <>
              <SheetHeader className="p-6 pb-5 border-b border-border">
                <div className="flex items-start justify-between pr-8">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                      Orçamento #{selectedOrcamento.id.split("-")[0].toUpperCase()}
                    </p>
                    <SheetTitle className="font-serif text-xl text-foreground">
                      {selectedOrcamento.paciente.nome}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      Criado em{" "}
                      {format(new Date(selectedOrcamento.created_at), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </SheetDescription>
                  </div>
                  <div
                    className={`relative inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${
                      STATUS_CONFIG[selectedOrcamento.status]?.className ??
                      "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {STATUS_CONFIG[selectedOrcamento.status]?.label ?? selectedOrcamento.status}
                    <select
                      value={selectedOrcamento.status}
                      onChange={(e) =>
                        void handleAtualizarStatus(
                          selectedOrcamento.id,
                          e.target.value as StatusOrcamento
                        )
                      }
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="enviado">Enviado</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="recusado">Recusado</option>
                    </select>
                  </div>
                </div>
              </SheetHeader>

              <div className="p-6 space-y-6">
                {/* Mini métricas */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/20 p-3.5 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total</p>
                    <p className="font-mono text-base font-bold text-foreground">
                      {selectedOrcamento.total != null ? formatBRL(selectedOrcamento.total) : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3.5 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
                      Pendente
                    </p>
                    <p className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                      {formatBRL(sheetPendente)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3.5 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                      Recebido
                    </p>
                    <p className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {formatBRL(sheetPago)}
                    </p>
                  </div>
                </div>

                {/* Procedimentos */}
                {selectedOrcamento.itens.length > 0 && (
                  <div>
                    <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-3">
                      Procedimentos
                    </p>
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              Dente
                            </th>
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              Procedimento
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrcamento.itens.map((item, i) => (
                            <tr
                              key={item.id}
                              className={`border-b border-border/50 ${
                                i === selectedOrcamento.itens.length - 1 ? "border-b-0" : ""
                              }`}
                            >
                              <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                                {item.dente ?? "—"}
                              </td>
                              <td className="px-4 py-3 font-sans text-foreground">
                                {item.descricao ?? "—"}
                                {item.quantidade > 1 && (
                                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                    ×{item.quantidade}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-foreground text-right font-semibold">
                                {item.preco_total != null ? formatBRL(item.preco_total) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/20">
                            <td
                              colSpan={2}
                              className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase tracking-wider text-right"
                            >
                              Total Geral
                            </td>
                            <td className="px-4 py-3 font-mono text-base font-bold text-foreground text-right">
                              {selectedOrcamento.total != null ? formatBRL(selectedOrcamento.total) : "—"}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pagamentos */}
                {selectedOrcamento.pagamentos.length > 0 && (
                  <div>
                    <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-3">
                      Pagamentos
                    </p>
                    <div className="space-y-3">
                      {selectedOrcamento.pagamentos.map((pg) => {
                        const pgCfg = PAGAMENTO_STATUS_CONFIG[pg.status] ?? {
                          label: pg.status,
                          className: "bg-muted text-muted-foreground border border-border",
                        };
                        return (
                          <div key={pg.id} className="rounded-2xl border border-border bg-muted/10 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-sm font-bold text-foreground">
                                {formatBRL(Number(pg.valor))}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pgCfg.className}`}>
                                {pgCfg.label}
                              </span>
                            </div>
                            {pg.forma_pagamento && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {FORMA_LABELS[pg.forma_pagamento] ?? pg.forma_pagamento}
                              </p>
                            )}
                            {pg.data_pagamento && (
                              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                                Pago em {format(new Date(pg.data_pagamento), "dd/MM/yyyy")}
                              </p>
                            )}
                            {pg.data_vencimento && pg.status === "pendente" && (
                              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                                Vencimento: {format(new Date(pg.data_vencimento), "dd/MM/yyyy")}
                              </p>
                            )}
                            {pg.status === "pendente" && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                                <Select
                                  value={formas[pg.id] ?? ""}
                                  onValueChange={(v) =>
                                    setFormas((prev) => ({ ...prev, [pg.id]: v as FormaPagamento }))
                                  }
                                >
                                  <SelectTrigger className="h-8 flex-1 text-xs">
                                    <SelectValue placeholder="Forma de pagamento" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="pix">Pix</SelectItem>
                                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                                    <SelectItem value="boleto">Boleto</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
                                  disabled={isPending || !formas[pg.id]}
                                  onClick={() => void handleMarcarPago(pg.id)}
                                  className="h-8 px-3 rounded-xl bg-teal text-white text-xs font-medium hover:bg-teal-dark disabled:opacity-50 transition-colors shrink-0"
                                >
                                  {isPending ? "Salvando…" : "Marcar como Pago"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
