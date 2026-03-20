"use client";

import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { EtapaCard } from "./etapa-card";
import { EtapaFormFields } from "./etapa-form";
import { type EtapaForm, type EtapaStatus } from "./ficha-helpers";
import { FichaSectionLabel } from "./ficha-shared";
import { RadiografiasCard } from "./radiografias-card";
import type { FichaArquivo, PlanejamentoEtapa } from "@/types/database";
import type { ProcedimentoClinica } from "../actions";

interface TabPlanejamentoProps {
  etapas: PlanejamentoEtapa[];
  procedimentos: ProcedimentoClinica[];
  onProcedimentoChange: (proc: ProcedimentoClinica | null) => void;
  etapaForm: EtapaForm;
  dentesSelecionados: string[];
  radiografias: FichaArquivo[];
  signedUrls: Record<string, string>;
  arquivoNomeById: Record<string, string>;
  novaEtapaOpen: boolean;
  editandoEtapaId: string | null;
  vinculandoEtapaId: string | null;
  salvandoEtapa: boolean;
  uploadandoRx: boolean;
  rxInputId: string;
  onIniciarNovaEtapa: () => void;
  onCancelarEdicao: () => void;
  onAdicionarEtapa: () => void;
  onAtualizarEtapa: () => void;
  onEditarEtapa: (etapa: PlanejamentoEtapa) => void;
  onRemoverEtapa: (etapaId: string) => void;
  onStatusEtapaChange: (etapa: PlanejamentoEtapa, status: EtapaStatus) => void;
  onVincularImagem: (etapaId: string, arquivoId: string | null) => void;
  onAbrirVinculo: (etapaId: string) => void;
  onFecharVinculo: () => void;
  onTituloEtapaChange: (valor: string) => void;
  onObservacaoEtapaChange: (valor: string) => void;
  onUsarSelecaoOdontograma: () => void;
  onRemoverDenteEtapa: (dente: string) => void;
  onUploadRx: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAbrirApresentacao: () => void;
  onOpenLightbox: (index: number) => void;
  onRemoverRx: (arquivo: FichaArquivo) => void;
}

export function TabPlanejamento({
  etapas,
  procedimentos,
  onProcedimentoChange,
  etapaForm,
  dentesSelecionados,
  radiografias,
  signedUrls,
  arquivoNomeById,
  novaEtapaOpen,
  editandoEtapaId,
  vinculandoEtapaId,
  salvandoEtapa,
  uploadandoRx,
  rxInputId,
  onIniciarNovaEtapa,
  onCancelarEdicao,
  onAdicionarEtapa,
  onAtualizarEtapa,
  onEditarEtapa,
  onRemoverEtapa,
  onStatusEtapaChange,
  onVincularImagem,
  onAbrirVinculo,
  onFecharVinculo,
  onTituloEtapaChange,
  onObservacaoEtapaChange,
  onUsarSelecaoOdontograma,
  onRemoverDenteEtapa,
  onUploadRx,
  onAbrirApresentacao,
  onOpenLightbox,
  onRemoverRx,
}: TabPlanejamentoProps): React.JSX.Element {
  return (
    <TabsContent value="planejamento" className="mt-0 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <FichaSectionLabel>Etapas do Procedimento</FichaSectionLabel>
            {!novaEtapaOpen && !editandoEtapaId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={onIniciarNovaEtapa}
              >
                <Plus size={13} />
                Nova Etapa
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {novaEtapaOpen && (
            <div className="space-y-3 rounded-lg border border-teal/30 bg-teal/5 p-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-teal">
                Nova Etapa
              </p>
              <EtapaFormFields
                etapaForm={etapaForm}
                procedimentos={procedimentos}
                dentesSelecionados={dentesSelecionados}
                onProcedimentoChange={onProcedimentoChange}
                onTituloChange={onTituloEtapaChange}
                onObservacaoChange={onObservacaoEtapaChange}
                onUseSelectedTeeth={onUsarSelecaoOdontograma}
                onRemoveTooth={onRemoverDenteEtapa}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onAdicionarEtapa} disabled={salvandoEtapa}>
                  {salvandoEtapa && <Loader2 size={12} className="animate-spin" />}
                  {salvandoEtapa ? "Adicionando..." : "Adicionar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelarEdicao}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {etapas.length === 0 && !novaEtapaOpen && (
            <div className="flex h-24 items-center justify-center rounded border-2 border-dashed border-brand-border">
              <p className="font-sans text-sm text-brand-muted">Nenhuma etapa adicionada ainda</p>
            </div>
          )}

          {etapas.map((etapa, index) => (
            <div key={etapa.id}>
              {editandoEtapaId === etapa.id ? (
                <div className="space-y-3 rounded-lg border border-teal/30 bg-teal/5 p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-widest text-teal">
                    Editando Etapa {index + 1}
                  </p>
                  <EtapaFormFields
                    etapaForm={etapaForm}
                    procedimentos={procedimentos}
                    dentesSelecionados={dentesSelecionados}
                    onProcedimentoChange={onProcedimentoChange}
                    onTituloChange={onTituloEtapaChange}
                    onObservacaoChange={onObservacaoEtapaChange}
                    onUseSelectedTeeth={onUsarSelecaoOdontograma}
                    onRemoveTooth={onRemoverDenteEtapa}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onAtualizarEtapa} disabled={salvandoEtapa}>
                      {salvandoEtapa && <Loader2 size={12} className="animate-spin" />}
                      {salvandoEtapa ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCancelarEdicao}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <EtapaCard
                  etapa={etapa}
                  index={index}
                  imageName={
                    etapa.imagem_arquivo_id ? arquivoNomeById[etapa.imagem_arquivo_id] ?? null : null
                  }
                  isVinculando={vinculandoEtapaId === etapa.id}
                  radiografias={radiografias}
                  onStatusChange={onStatusEtapaChange}
                  onAbrirVincularImagem={() => onAbrirVinculo(etapa.id)}
                  onFecharVincularImagem={onFecharVinculo}
                  onVincularImagem={onVincularImagem}
                  onEditar={() => onEditarEtapa(etapa)}
                  onRemover={() => onRemoverEtapa(etapa.id)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <RadiografiasCard
        etapasCount={etapas.length}
        radiografias={radiografias}
        signedUrls={signedUrls}
        uploadandoRx={uploadandoRx}
        rxInputId={rxInputId}
        onUploadRx={onUploadRx}
        onOpenApresentacao={onAbrirApresentacao}
        onOpenLightbox={onOpenLightbox}
        onRemoverRx={onRemoverRx}
      />
    </TabsContent>
  );
}
