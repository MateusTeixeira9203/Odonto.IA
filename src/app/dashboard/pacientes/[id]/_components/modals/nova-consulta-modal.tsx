'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ConsultaForm = {
  data: string;
  hora: string;
  duracao: string;
  observacoes: string;
};

interface NovaConsultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteNome: string;
  consultaForm: ConsultaForm;
  setConsultaForm: React.Dispatch<React.SetStateAction<ConsultaForm>>;
  consultaError: string | null;
  consultaSaving: boolean;
  onNovaConsulta: () => void;
}

export function NovaConsultaModal({
  open,
  onOpenChange,
  pacienteNome,
  consultaForm,
  setConsultaForm,
  consultaError,
  consultaSaving,
  onNovaConsulta,
}: NovaConsultaModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold text-xl text-text-primary">
            Nova Consulta
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Agende uma consulta para {pacienteNome}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="consulta-data">Data</Label>
              <Input
                id="consulta-data"
                type="date"
                value={consultaForm.data}
                onChange={(e) => setConsultaForm((f) => ({ ...f, data: e.target.value }))}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consulta-hora">Hora</Label>
              <Input
                id="consulta-hora"
                type="time"
                value={consultaForm.hora}
                onChange={(e) => setConsultaForm((f) => ({ ...f, hora: e.target.value }))}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consulta-duracao">Duração (minutos)</Label>
            <Input
              id="consulta-duracao"
              type="number"
              min="15"
              step="15"
              value={consultaForm.duracao}
              onChange={(e) => setConsultaForm((f) => ({ ...f, duracao: e.target.value }))}
              className="rounded-xl bg-surface-alt border-border text-text-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consulta-obs">Observações</Label>
            <Input
              id="consulta-obs"
              placeholder="Ex: Consulta de rotina, limpeza..."
              value={consultaForm.observacoes}
              onChange={(e) => setConsultaForm((f) => ({ ...f, observacoes: e.target.value }))}
              className="rounded-xl bg-surface-alt border-border text-text-primary"
            />
          </div>
          {consultaError && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {consultaError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border text-text-primary hover:bg-surface-alt"
          >
            Cancelar
          </Button>
          <Button
            onClick={onNovaConsulta}
            disabled={consultaSaving}
            className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 flex items-center gap-2"
          >
            {consultaSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : (
              'Agendar Consulta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
