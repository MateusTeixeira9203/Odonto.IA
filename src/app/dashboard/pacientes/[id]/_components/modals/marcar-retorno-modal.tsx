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

export interface MarcarRetornoForm {
  data: string;         // yyyy-MM-dd
  hora: string;         // HH:mm
  duracao: string;      // minutos
  observacoes: string;
}

interface MarcarRetornoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteNome: string;
  form: MarcarRetornoForm;
  setForm: React.Dispatch<React.SetStateAction<MarcarRetornoForm>>;
  error: string | null;
  saving: boolean;
  onMarcarRetorno: () => void;
}

export function MarcarRetornoModal({
  open,
  onOpenChange,
  pacienteNome,
  form,
  setForm,
  error,
  saving,
  onMarcarRetorno,
}: MarcarRetornoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold text-xl text-text-primary">
            Marcar retorno
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Agende o retorno de {pacienteNome}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retorno-data">Data</Label>
              <Input
                id="retorno-data"
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retorno-hora">Hora</Label>
              <Input
                id="retorno-hora"
                type="time"
                value={form.hora}
                onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="retorno-duracao">Duração (minutos)</Label>
            <Input
              id="retorno-duracao"
              type="number"
              min="15"
              step="15"
              value={form.duracao}
              onChange={(e) => setForm((f) => ({ ...f, duracao: e.target.value }))}
              className="rounded-xl bg-surface-alt border-border text-text-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retorno-obs">Observações</Label>
            <Input
              id="retorno-obs"
              placeholder="Ex: Consulta de rotina, limpeza..."
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              className="rounded-xl bg-surface-alt border-border text-text-primary"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
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
            onClick={onMarcarRetorno}
            disabled={saving}
            className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : (
              'Marcar retorno'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
