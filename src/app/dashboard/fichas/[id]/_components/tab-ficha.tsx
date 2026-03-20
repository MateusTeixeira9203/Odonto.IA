"use client";

import { TabsContent } from "@/components/ui/tabs";
import { AnamneseCard } from "./anamnese-card";
import { AnexosCard } from "./anexos-card";
import { OdontogramaCard } from "./odontograma-card";
import type { FichaArquivo } from "@/types/database";

interface TabFichaProps {
  queixaPrincipal: string;
  historicoDental: string;
  historicoMedico: string;
  anotacoes: string;
  salvandoAnamnese: boolean;
  salvandoAnotacoes: boolean;
  estaProcessandoAudio: boolean;
  estaGravando: boolean;
  timerFormatado: string;
  dentesSelecionados: string[];
  documentos: FichaArquivo[];
  fotosficha: FichaArquivo[];
  signedUrls: Record<string, string>;
  docInputId: string;
  fotoInputId: string;
  uploadandoDoc: boolean;
  uploadandoFoto: boolean;
  onQueixaPrincipalChange: (valor: string) => void;
  onHistoricoDentalChange: (valor: string) => void;
  onHistoricoMedicoChange: (valor: string) => void;
  onAnotacoesChange: (valor: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleDente: (dente: string) => void;
  onDocInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFoto: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoverDocumento: (arquivo: FichaArquivo) => void;
  onOpenFotoLightbox: (index: number) => void;
  onRemoverFoto: (arquivo: FichaArquivo) => void;
}

export function TabFicha({
  queixaPrincipal,
  historicoDental,
  historicoMedico,
  anotacoes,
  salvandoAnamnese,
  salvandoAnotacoes,
  estaProcessandoAudio,
  estaGravando,
  timerFormatado,
  dentesSelecionados,
  documentos,
  fotosficha,
  signedUrls,
  docInputId,
  fotoInputId,
  uploadandoDoc,
  uploadandoFoto,
  onQueixaPrincipalChange,
  onHistoricoDentalChange,
  onHistoricoMedicoChange,
  onAnotacoesChange,
  onStartRecording,
  onStopRecording,
  onToggleDente,
  onDocInputChange,
  onUploadFoto,
  onRemoverDocumento,
  onOpenFotoLightbox,
  onRemoverFoto,
}: TabFichaProps): React.JSX.Element {
  return (
    <TabsContent value="ficha" className="mt-0">
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
        <div className="space-y-4">
          <AnamneseCard
            queixaPrincipal={queixaPrincipal}
            historicoDental={historicoDental}
            historicoMedico={historicoMedico}
            anotacoes={anotacoes}
            salvandoAnamnese={salvandoAnamnese}
            salvandoAnotacoes={salvandoAnotacoes}
            estaProcessandoAudio={estaProcessandoAudio}
            estaGravando={estaGravando}
            timerFormatado={timerFormatado}
            onQueixaPrincipalChange={onQueixaPrincipalChange}
            onHistoricoDentalChange={onHistoricoDentalChange}
            onHistoricoMedicoChange={onHistoricoMedicoChange}
            onAnotacoesChange={onAnotacoesChange}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
          />
        </div>

        <div className="space-y-4">
          <div className="sticky top-6 self-start space-y-4">
            <OdontogramaCard
              dentesSelecionados={dentesSelecionados}
              onToggleDente={onToggleDente}
            />
            <AnexosCard
              documentos={documentos}
              fotosficha={fotosficha}
              signedUrls={signedUrls}
              docInputId={docInputId}
              fotoInputId={fotoInputId}
              uploadandoDoc={uploadandoDoc}
              uploadandoFoto={uploadandoFoto}
              onDocInputChange={onDocInputChange}
              onUploadFoto={onUploadFoto}
              onRemoverDocumento={onRemoverDocumento}
              onOpenFotoLightbox={onOpenFotoLightbox}
              onRemoverFoto={onRemoverFoto}
            />
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
