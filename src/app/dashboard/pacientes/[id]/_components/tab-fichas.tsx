"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  X,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/dentai";
import { ARCADA_SUPERIOR, ARCADA_INFERIOR } from "@/app/dashboard/fichas/[id]/_components/ficha-helpers";
import { deletarFicha, criarFichaInline } from "../actions";
import type { FichaResumida } from "./paciente-detail-client";

const TIPOS_CONSULTA = [
  "Consulta de rotina",
  "Urgência / dor",
  "Retorno",
  "Procedimento",
  "Avaliação inicial",
  "Outro",
];

interface Props {
  fichas: FichaResumida[];
  pacienteId: string;
  dentistaId: string;
  clinicaId: string;
}

export function TabFichas({ fichas, pacienteId }: Props): React.JSX.Element {
  const router = useRouter();
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);

  // Form inline de nova evolução
  const [novaEvolucaoAberta, setNovaEvolucaoAberta] = useState(false);
  const [tipo, setTipo] = useState(TIPOS_CONSULTA[0]);
  const [observacoes, setObservacoes] = useState("");
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function handleDeletar(fichaId: string) {
    setDeletando(true);
    try {
      await deletarFicha(fichaId);
      setConfirmandoId(null);
      router.refresh();
      toast.success("Ficha excluída");
    } catch {
      toast.error("Erro ao excluir ficha");
    } finally {
      setDeletando(false);
    }
  }

  function toggleDente(dente: string) {
    setDentesSelecionados((prev) =>
      prev.includes(dente) ? prev.filter((d) => d !== dente) : [...prev, dente]
    );
  }

  async function handleSalvarEvolucao() {
    if (!observacoes.trim() && !tipo) {
      toast.error("Preencha ao menos o tipo ou observações");
      return;
    }
    setSalvando(true);
    const result = await criarFichaInline({
      pacienteId,
      queixaPrincipal: tipo,
      anotacoes: observacoes,
      dentesAfetados: dentesSelecionados,
    });
    setSalvando(false);
    if (result.error) {
      toast.error("Erro ao criar ficha");
    } else {
      toast.success("Ficha criada com sucesso");
      setNovaEvolucaoAberta(false);
      setTipo(TIPOS_CONSULTA[0]);
      setObservacoes("");
      setDentesSelecionados([]);
      router.refresh();
    }
  }

  function renderArcada(dentes: readonly string[]) {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        {dentes.map((dente) => (
          <button
            key={dente}
            type="button"
            onClick={() => toggleDente(dente)}
            className={`flex w-8 h-8 items-center justify-center rounded border text-xs font-mono font-medium transition-colors ${
              dentesSelecionados.includes(dente)
                ? "border-teal bg-teal text-white"
                : "border-border bg-surface-alt text-text-secondary hover:border-teal/50 hover:text-text-primary"
            }`}
          >
            {dente}
          </button>
        ))}
      </div>
    );
  }

  const inputClass =
    "w-full font-sans text-sm px-3 py-2 rounded-xl border border-border bg-surface-alt text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-teal transition-colors";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="font-sans text-sm text-muted-foreground">
          {fichas.length} ficha{fichas.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={() => setNovaEvolucaoAberta((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:bg-teal-dark transition-colors"
        >
          {novaEvolucaoAberta ? (
            <>
              <X className="w-3.5 h-3.5" />
              Cancelar
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Nova Evolução
            </>
          )}
        </button>
      </div>

      {/* ── Painel inline de nova evolução ──────────────────────────────────── */}
      {novaEvolucaoAberta && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="font-sans text-sm font-semibold text-foreground">Nova Evolução</p>
            <p className="font-sans text-xs text-muted-foreground mt-0.5">
              Salva como nova ficha clínica
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            {/* Coluna esquerda — campos */}
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo de consulta</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className={inputClass}
                >
                  {TIPOS_CONSULTA.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Observações / Evolução</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Descreva a evolução clínica, procedimentos realizados…"
                  rows={5}
                  className={inputClass + " resize-none"}
                />
              </div>

              {dentesSelecionados.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Dentes selecionados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...dentesSelecionados].sort((a, b) => Number(a) - Number(b)).map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-0.5 font-mono text-xs text-teal"
                      >
                        {d}
                        <button type="button" onClick={() => toggleDente(d)} className="hover:text-primary/60">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="font-sans text-xs text-muted-foreground/60">
                Para gravação de voz e anexos, abra a ficha completa após salvar.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNovaEvolucaoAberta(false)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarEvolucao}
                  disabled={salvando}
                  className="flex-1 py-2 rounded-xl text-sm font-bold bg-teal text-white disabled:opacity-50 transition-colors"
                >
                  {salvando ? "Salvando…" : "Salvar Ficha"}
                </button>
              </div>
            </div>

            {/* Coluna direita — odontograma */}
            <div className="p-4 space-y-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground text-center">
                Odontograma ISO
              </p>
              <div className="space-y-2">
                <p className="text-center font-mono text-[0.6rem] text-muted-foreground/60">
                  Arcada Superior
                </p>
                {renderArcada(ARCADA_SUPERIOR)}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-[0.6rem] text-muted-foreground">↑ sup · inf ↓</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {renderArcada(ARCADA_INFERIOR)}
                <p className="text-center font-mono text-[0.6rem] text-muted-foreground/60">
                  Arcada Inferior
                </p>
              </div>
              {dentesSelecionados.length === 0 && (
                <p className="text-center font-sans text-xs text-muted-foreground/50 py-2">
                  Clique nos dentes para marcar
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de fichas ─────────────────────────────────────────────────── */}
      {fichas.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border flex flex-col items-center gap-3 py-12">
          <FileText className="w-8 h-8 text-muted-foreground/30" />
          <p className="font-sans text-sm text-muted-foreground">Nenhuma ficha ainda</p>
          <Link
            href={`/dashboard/fichas/nova?paciente_id=${pacienteId}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Criar primeira ficha →
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {fichas.map((ficha) =>
            confirmandoId === ficha.id ? (
              <div
                key={ficha.id}
                className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="font-sans text-sm text-red-700 dark:text-red-400">
                    Apagar ficha de {format(new Date(ficha.created_at), "dd/MM/yyyy")}?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setConfirmandoId(null)}
                  >
                    cancelar
                  </button>
                  <button
                    disabled={deletando}
                    onClick={() => handleDeletar(ficha.id)}
                    className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    {deletando ? "Apagando…" : "Apagar"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={ficha.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">
                    {ficha.queixa_principal ?? "Ficha clínica"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {format(new Date(ficha.created_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={ficha.status === "aberta" ? "warning" : "success"}>
                    {ficha.status === "aberta" ? "Aberta" : "Concluída"}
                  </Badge>
                  {/* Menu ... */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuAbertoId(menuAbertoId === ficha.id ? null : ficha.id)}
                      className="flex w-7 h-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuAbertoId === ficha.id && (
                      <div className="absolute right-0 top-8 z-10 w-40 bg-card rounded-xl border border-border shadow-float overflow-hidden">
                        <Link
                          href={`/dashboard/fichas/${ficha.id}`}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                          onClick={() => setMenuAbertoId(null)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          Ver ficha completa
                          <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmandoId(ficha.id);
                            setMenuAbertoId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir ficha
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
