"use client";

import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FichaSectionLabel, FichaWaveform } from "./ficha-shared";

interface AnamneseCardProps {
  queixaPrincipal: string;
  historicoDental: string;
  historicoMedico: string;
  anotacoes: string;
  salvandoAnamnese: boolean;
  salvandoAnotacoes: boolean;
  estaProcessandoAudio: boolean;
  estaGravando: boolean;
  timerFormatado: string;
  onQueixaPrincipalChange: (valor: string) => void;
  onHistoricoDentalChange: (valor: string) => void;
  onHistoricoMedicoChange: (valor: string) => void;
  onAnotacoesChange: (valor: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function AnamneseCard({
  queixaPrincipal,
  historicoDental,
  historicoMedico,
  anotacoes,
  salvandoAnamnese,
  salvandoAnotacoes,
  estaProcessandoAudio,
  estaGravando,
  timerFormatado,
  onQueixaPrincipalChange,
  onHistoricoDentalChange,
  onHistoricoMedicoChange,
  onAnotacoesChange,
  onStartRecording,
  onStopRecording,
}: AnamneseCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <FichaSectionLabel>Anamnese</FichaSectionLabel>
          {salvandoAnamnese && (
            <span className="font-mono text-xs text-brand-muted">✓ Salvo</span>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
            Queixa Principal
          </p>
          <Textarea
            value={queixaPrincipal}
            onChange={(event) => onQueixaPrincipalChange(event.target.value)}
            placeholder="Descreva a queixa principal do paciente..."
            className="min-h-[80px] resize-none rounded border-brand-border bg-brand-bg p-3 font-sans text-sm focus:border-teal"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
              Histórico Dental
            </p>
            <Textarea
              value={historicoDental}
              onChange={(event) => onHistoricoDentalChange(event.target.value)}
              placeholder="Tratamentos anteriores, problemas recorrentes..."
              className="min-h-[90px] resize-none rounded border-brand-border bg-brand-bg p-3 font-sans text-sm focus:border-teal"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
              Histórico Médico
            </p>
            <Textarea
              value={historicoMedico}
              onChange={(event) => onHistoricoMedicoChange(event.target.value)}
              placeholder="Doenças, cirurgias, condições crônicas..."
              className="min-h-[90px] resize-none rounded border-brand-border bg-brand-bg p-3 font-sans text-sm focus:border-teal"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-brand-muted">
                Anotações
              </p>
              {salvandoAnotacoes && (
                <span className="font-mono text-xs text-brand-muted">✓ Salvo</span>
              )}
            </div>

            {estaProcessandoAudio ? (
              <div className="flex items-center gap-2 rounded border border-brand-border bg-brand-bg px-3 py-1.5">
                <FichaWaveform />
                <span className="font-mono text-xs text-brand-muted">Transcrevendo...</span>
              </div>
            ) : estaGravando ? (
              <Button
                variant="destructive"
                size="sm"
                className="animate-record-pulse gap-1.5"
                onClick={onStopRecording}
              >
                <Square size={13} />
                Parar
                <span className="ml-0.5 font-mono">{timerFormatado}</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onStartRecording}>
                <Mic size={14} />
                Gravar
              </Button>
            )}
          </div>

          <Textarea
            value={anotacoes}
            onChange={(event) => onAnotacoesChange(event.target.value)}
            placeholder="Anote os procedimentos, observações e o que o paciente relatou. Você também pode gravar sua voz."
            className="min-h-[120px] resize-none rounded border-brand-border bg-brand-bg p-3 font-sans text-sm focus:border-teal"
          />
        </div>
      </CardContent>
    </Card>
  );
}
