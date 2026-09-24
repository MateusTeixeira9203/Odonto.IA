'use client';

import { useActionState, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createClinicTransaction, type ClinicTransactionState } from '@/app/consultorio/financeiro-clinica/actions';

const initialState: ClinicTransactionState = { ok: false, message: '' };

export function ClinicTransactionActions({ canWrite }: { canWrite: boolean }): React.JSX.Element | null {
  const [type, setType] = useState<'entrada' | 'saida' | null>(null);
  const [state, action, pending] = useActionState(createClinicTransaction, initialState);
  if (!canWrite) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setType('saida')}><ArrowUpRight className="size-4" />Registrar saída</Button>
        <Button className="min-h-11" onClick={() => setType('entrada')}><ArrowDownLeft className="size-4" />Registrar entrada</Button>
      </div>
      <Dialog open={type !== null} onOpenChange={(open) => !open && setType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{type === 'saida' ? 'Registrar saída da clínica' : 'Registrar entrada da clínica'}</DialogTitle>
            <DialogDescription>{type === 'saida' ? 'Compras de estoque entram como saída uma vez. O consumo não cria outra saída de caixa.' : 'Recebimentos de pacientes vêm do orçamento. Use esta entrada para receitas avulsas da unidade.'}</DialogDescription>
          </DialogHeader>
          {type && <form action={action} className="space-y-4">
            <input type="hidden" name="tipo" value={type} />
            <label className="block text-sm font-medium text-foreground">Valor<Input className="mt-2" name="valor" type="number" min="0.01" step="0.01" required /></label>
            <label className="block text-sm font-medium text-foreground">Data<Input className="mt-2" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            <label className="block text-sm font-medium text-foreground">Descrição<Input className="mt-2" name="descricao" minLength={2} maxLength={160} required /></label>
            {type === 'saida' ? <label className="block text-sm font-medium text-foreground">Categoria<Input className="mt-2" name="categoria" placeholder="Ex.: aluguel, laboratório, insumos" required /></label> : <label className="block text-sm font-medium text-foreground">Forma<select name="forma" className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label>}
            {state.message && <p role="status" className={state.ok ? 'text-sm text-teal' : 'text-sm text-destructive'}>{state.message}</p>}
            <Button type="submit" className="w-full min-h-11" disabled={pending}>{pending ? 'Registrando…' : 'Confirmar lançamento'}</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </>
  );
}
