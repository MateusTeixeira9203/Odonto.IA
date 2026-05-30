'use client';

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

interface EditarPacienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editNome: string;
  setEditNome: (v: string) => void;
  editTelefone: string;
  setEditTelefone: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editEndereco: string;
  setEditEndereco: (v: string) => void;
  editError: string | null;
  isPending: boolean;
  onSave: () => void;
}

export function EditarPacienteModal({
  open,
  onOpenChange,
  editNome,
  setEditNome,
  editTelefone,
  setEditTelefone,
  editEmail,
  setEditEmail,
  editEndereco,
  setEditEndereco,
  editError,
  isPending,
  onSave,
}: EditarPacienteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold text-xl text-text-primary">
            Editar Perfil
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Atualize as informações cadastrais do paciente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-nome">Nome Completo</Label>
            <Input
              id="edit-nome"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
              className="rounded-xl bg-surface-alt border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                className="rounded-xl bg-surface-alt border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="rounded-xl bg-surface-alt border-border"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-endereco">Endereço</Label>
            <Input
              id="edit-endereco"
              value={editEndereco}
              onChange={(e) => setEditEndereco(e.target.value)}
              className="rounded-xl bg-surface-alt border-border"
            />
          </div>
          {editError && <p className="text-xs text-red-500">{editError}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={isPending || !editNome.trim()}
            className="bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50"
          >
            {isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
