'use client';

import { useActionState, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createClinicTransaction, recordClinicBankBalance, type ClinicTransactionState } from '@/app/consultorio/financeiro-clinica/actions';

const initialState: ClinicTransactionState = { ok: false, message: '' };

type Professional = { id: string; nome: string };

export function ClinicTransactionActions({ canWrite, canManageBalance = false, professionals }: { canWrite: boolean; canManageBalance?: boolean; professionals: Professional[] }): React.JSX.Element | null {
  const [type, setType] = useState<'entrada' | 'saida' | 'saldo' | null>(null);
  const [state, action, pending] = useActionState(createClinicTransaction, initialState);
  const [balanceState, balanceAction, balancePending] = useActionState(recordClinicBankBalance, initialState);
  if (!canWrite) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setType('saida')}><ArrowUpRight className="size-4" />Registrar saída</Button>
        <Button className="min-h-11" onClick={() => setType('entrada')}><ArrowDownLeft className="size-4" />Registrar entrada</Button>
        {canManageBalance && <Button variant="outline" className="min-h-11" onClick={() => setType('saldo')}><Landmark className="size-4" />Informar saldo</Button>}
      </div>
      <Dialog open={type !== null} onOpenChange={(open) => !open && setType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{type === 'saldo' ? 'Informar saldo da conta' : type === 'saida' ? 'Registrar saída da clínica' : 'Registrar entrada da clínica'}</DialogTitle>
            <DialogDescription>{type === 'saldo' ? 'Use o saldo visto na conta nesta data. Ele ancora o fôlego de caixa e não substitui conciliação bancária.' : type === 'saida' ? 'Compras de estoque entram como saída uma vez. O consumo não cria outra saída de caixa.' : 'Use para um recebimento avulso da clínica. Recebimentos de orçamento continuam vinculados ao paciente.'}</DialogDescription>
          </DialogHeader>
          {type === 'saldo' ? <form action={balanceAction} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">Saldo da conta<Input className="mt-2" name="saldo" type="number" step="0.01" required /></label>
            <label className="block text-sm font-medium text-foreground">Data de referência<Input className="mt-2" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            {balanceState.message && <p role="status" className={balanceState.ok ? 'text-sm text-teal' : 'text-sm text-destructive'}>{balanceState.message}</p>}
            <Button type="submit" className="w-full min-h-11" disabled={balancePending}>{balancePending ? 'Salvando…' : 'Salvar saldo informado'}</Button>
          </form> : type && <form action={action} className="space-y-4">
            <input type="hidden" name="tipo" value={type} />
            <label className="block text-sm font-medium text-foreground">Valor<Input className="mt-2" name="valor" type="number" min="0.01" step="0.01" required /></label>
            <label className="block text-sm font-medium text-foreground">Data<Input className="mt-2" name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
            <label className="block text-sm font-medium text-foreground">Descrição<Input className="mt-2" name="descricao" minLength={2} maxLength={160} required /></label>
            {type === 'saida'
              ? <label className="block text-sm font-medium text-foreground">Categoria<Input className="mt-2" name="categoria" placeholder="Ex.: aluguel, laboratório, insumos" required /></label>
              : <><label className="block text-sm font-medium text-foreground">Forma<select name="forma" className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="pix">PIX</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label className="block text-sm font-medium text-foreground">Profissional responsável <span className="font-normal text-muted-foreground">(opcional)</span><select name="dentistaId" className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm" defaultValue=""><option value="">Recebimento geral da clínica</option>{professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome}</option>)}</select></label></>}
            {state.message && <p role="status" className={state.ok ? 'text-sm text-teal' : 'text-sm text-destructive'}>{state.message}</p>}
            <Button type="submit" className="w-full min-h-11" disabled={pending}>{pending ? 'Registrando…' : 'Confirmar lançamento'}</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </>
  );
}
