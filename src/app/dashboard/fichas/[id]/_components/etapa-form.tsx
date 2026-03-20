"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EtapaForm } from "./ficha-helpers";
import type { ProcedimentoClinica } from "../actions";

const SELECT_CLASS =
  "w-full rounded-xl border border-brand-border bg-brand-bg px-2.5 py-1.5 font-sans text-sm text-brand-black focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

interface EtapaFormFieldsProps {
  etapaForm: EtapaForm;
  procedimentos: ProcedimentoClinica[];
  dentesSelecionados: string[];
  onProcedimentoChange: (proc: ProcedimentoClinica | null) => void;
  onTituloChange: (valor: string) => void;
  onObservacaoChange: (valor: string) => void;
  onUseSelectedTeeth: () => void;
  onRemoveTooth: (dente: string) => void;
}

export function EtapaFormFields({
  etapaForm,
  procedimentos,
  dentesSelecionados,
  onProcedimentoChange,
  onTituloChange,
  onObservacaoChange,
  onUseSelectedTeeth,
  onRemoveTooth,
}: EtapaFormFieldsProps): React.JSX.Element {
  // Categorias únicas ordenadas para agrupar o select
  const categorias = Array.from(new Set(procedimentos.map((p) => p.categoria))).sort();

  const procedimentoSelecionado = procedimentos.find((p) => p.id === etapaForm.procedimento_id) ?? null;
  const modoManual = etapaForm.procedimento_id === null;

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value;
    if (value === "__manual__") {
      onProcedimentoChange(null);
    } else {
      const proc = procedimentos.find((p) => p.id === value) ?? null;
      onProcedimentoChange(proc);
    }
  }

  return (
    <>
      {/* Dentes */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
            Dentes
          </p>
          {dentesSelecionados.length > 0 && (
            <button
              className="font-mono text-xs text-teal hover:underline"
              onClick={onUseSelectedTeeth}
            >
              Usar seleção do odontograma ({dentesSelecionados.length})
            </button>
          )}
        </div>

        {etapaForm.dentes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {[...etapaForm.dentes]
              .sort((a, b) => Number(a) - Number(b))
              .map((dente) => (
                <span
                  key={dente}
                  className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 font-mono text-xs text-teal"
                >
                  {dente}
                  <button
                    onClick={() => onRemoveTooth(dente)}
                    className="text-teal/60 hover:text-teal"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
          </div>
        ) : (
          <p className="font-sans text-xs text-brand-muted">Nenhum dente selecionado</p>
        )}
      </div>

      {/* Procedimento: select dos cadastrados + fallback texto livre */}
      <div className="space-y-1.5">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
          O que será feito
        </p>

        <select
          value={etapaForm.procedimento_id ?? "__manual__"}
          onChange={handleSelectChange}
          className={SELECT_CLASS}
        >
          <option value="__manual__">— Digitar manualmente —</option>
          {categorias.map((cat) => (
            <optgroup key={cat} label={cat}>
              {procedimentos
                .filter((p) => p.categoria === cat)
                .map((proc) => (
                  <option key={proc.id} value={proc.id}>
                    {proc.nome}
                    {proc.preco_padrao != null
                      ? ` • R$ ${proc.preco_padrao.toFixed(2).replace(".", ",")}`
                      : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        {/* Modo manual: campo de texto livre */}
        {modoManual && (
          <Input
            placeholder="Ex: Canal radicular, Extração, Restauração..."
            value={etapaForm.titulo}
            onChange={(event) => onTituloChange(event.target.value)}
            className="border-brand-border bg-brand-bg font-sans text-sm focus:border-teal"
          />
        )}

        {/* Modo procedimento: mostra nome + preço do cadastro */}
        {!modoManual && procedimentoSelecionado && (
          <div className="flex items-center gap-2 rounded-lg border border-teal/20 bg-teal/5 px-3 py-1.5">
            <span className="flex-1 font-sans text-sm text-brand-black">
              {procedimentoSelecionado.nome}
            </span>
            {procedimentoSelecionado.preco_padrao != null && (
              <span className="font-mono text-xs font-medium text-teal">
                R$ {procedimentoSelecionado.preco_padrao.toFixed(2).replace(".", ",")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Observação */}
      <div className="space-y-1.5">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
          Observação
        </p>
        <Textarea
          placeholder="Detalhes adicionais..."
          value={etapaForm.observacao}
          onChange={(event) => onObservacaoChange(event.target.value)}
          className="min-h-[60px] resize-none rounded border-brand-border bg-brand-bg p-3 font-sans text-sm focus:border-teal"
        />
      </div>
    </>
  );
}
