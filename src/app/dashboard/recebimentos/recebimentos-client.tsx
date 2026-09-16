'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageContainer } from '@/components/layout/page-container';
import { formatarCentavos, parseValorCentavos } from '@/lib/financeiro/valor-centavos';
import type { RecebimentoInput } from '@/server/financeiro/recebimentos';
import type { RecebimentoRow, RecebimentosPage } from '@/server/financeiro/recebimentos-reader';
import { listarMaisRecebimentosClinica, operarRecebimentoClinica } from '@/app/clinica/recebimentos-actions';

const FORMAS = [
  ['dinheiro', 'Dinheiro'], ['pix', 'PIX'], ['cartao_credito', 'Cartão de crédito'],
  ['cartao_debito', 'Cartão de débito'], ['boleto', 'Boleto'], ['outro', 'Outro'],
] as const;
type FormaPagamento = (typeof FORMAS)[number][0];
type Pagamento = RecebimentoRow['pagamentos'][number];
type Modal =
  | { acao: 'registrar'; row: RecebimentoRow }
  | { acao: 'confirmar'; row: RecebimentoRow; pagamento: Pagamento }
  | { acao: 'corrigir'; row: RecebimentoRow; pagamento: Pagamento }
  | { acao: 'estornar'; row: RecebimentoRow; pagamento: Pagamento };
type RecebimentoOperation =
  | Pick<Extract<RecebimentoInput, { acao: 'registrar' }>, 'acao' | 'payload'>
  | Pick<Extract<RecebimentoInput, { acao: 'confirmar' }>, 'acao' | 'payload'>
  | Pick<Extract<RecebimentoInput, { acao: 'corrigir' }>, 'acao' | 'payload'>
  | Pick<Extract<RecebimentoInput, { acao: 'estornar' }>, 'acao' | 'payload'>;

function hoje(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}
function valorTexto(valorCentavos: number): string {
  if (!Number.isSafeInteger(valorCentavos)) return '';
  const sinal = valorCentavos < 0 ? '-' : '';
  const digitos = String(Math.abs(valorCentavos)).padStart(3, '0');
  return `${sinal}${digitos.slice(0, -2)},${digitos.slice(-2)}`;
}
function isFormaPagamento(value: string): value is FormaPagamento { return FORMAS.some(([forma]) => forma === value); }

export function RecebimentosOperacionaisClient({ clinicaId, initialPage }: { clinicaId: string; initialPage: RecebimentosPage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [carregandoMais, startCarregarMais] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [rows, setRows] = useState(initialPage.itens);
  const [proximoOffset, setProximoOffset] = useState(initialPage.proximoOffset);
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<'' | FormaPagamento>('');
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState('');
  const tentativaRef = useRef<{ fingerprint: string; chave: string } | null>(null);

  useEffect(() => {
    setRows(initialPage.itens);
    setProximoOffset(initialPage.proximoOffset);
  }, [initialPage]);

  function abrir(proxima: Modal) {
    setErro(null);
    tentativaRef.current = null;
    setModal(proxima);
    setMotivo('');
    if (proxima.acao === 'registrar') {
      setValor('');
      setForma('');
      setData(hoje());
      return;
    }
    if (proxima.acao === 'estornar') return;
    setForma(isFormaPagamento(proxima.pagamento.formaPagamento ?? '') ? proxima.pagamento.formaPagamento as FormaPagamento : '');
    setData(proxima.pagamento.data ?? hoje());
    setValor(proxima.acao === 'corrigir' ? valorTexto(proxima.pagamento.valorCentavos) : '');
  }

  function chavePara(input: RecebimentoOperation): string {
    const fingerprint = JSON.stringify({ acao: input.acao, payload: input.payload });
    if (tentativaRef.current?.fingerprint === fingerprint) return tentativaRef.current.chave;
    const chave = crypto.randomUUID();
    tentativaRef.current = { fingerprint, chave };
    return chave;
  }

  function enviar(input: RecebimentoOperation) {
    const completo: RecebimentoInput = { ...input, clinicaIdEsperada: clinicaId, chaveIdempotencia: chavePara(input) };
    startTransition(async () => {
      setErro(null);
      try {
        const resultado = await operarRecebimentoClinica(completo);
        if (!resultado.ok) {
          setErro(resultado.mensagem);
          return;
        }
        setModal(null);
        router.refresh();
      } catch {
        // Mantém a chave desta tentativa: uma repetição após falha de transporte é idempotente.
        setErro('Não foi possível concluir. Tente novamente com os mesmos dados.');
      }
    });
  }

  function carregarMais() {
    if (proximoOffset === null) return;
    startCarregarMais(async () => {
      setErro(null);
      try {
        const resultado = await listarMaisRecebimentosClinica({
          clinicaIdEsperada: clinicaId,
          offset: proximoOffset,
        });
        if (!resultado.ok) {
          setErro(resultado.mensagem);
          return;
        }
        setRows((atuais) => [...atuais, ...resultado.data.itens.filter((item) => !atuais.some((atual) => atual.orcamentoId === item.orcamentoId))]);
        setProximoOffset(resultado.data.proximoOffset);
      } catch {
        setErro('Não foi possível carregar mais recebimentos. Tente novamente.');
      }
    });
  }

  function confirmarEnvio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    if (modal.acao === 'estornar') {
      if (!motivo.trim()) { setErro('Informe o motivo do estorno.'); return; }
      enviar({ acao: 'estornar', payload: { pagamentoId: modal.pagamento.id, atualizadoEm: modal.pagamento.atualizadoEm, motivo: motivo.trim() } });
      return;
    }
    if (!forma || !data) { setErro('Informe a forma e a data do recebimento.'); return; }
    if (modal.acao === 'confirmar') {
      enviar({ acao: 'confirmar', payload: { pagamentoId: modal.pagamento.id, atualizadoEm: modal.pagamento.atualizadoEm, formaPagamento: forma, data } });
      return;
    }
    const valorCentavos = parseValorCentavos(valor);
    if (valorCentavos === null) { setErro('Informe um valor válido, com no máximo dois centavos.'); return; }
    if (modal.acao === 'registrar') {
      enviar({ acao: 'registrar', payload: { orcamentoId: modal.row.orcamentoId, valorCentavos, formaPagamento: forma, data } });
      return;
    }
    enviar({ acao: 'corrigir', payload: { pagamentoId: modal.pagamento.id, atualizadoEm: modal.pagamento.atualizadoEm, valorCentavos, formaPagamento: forma, data } });
  }

  const precisaValor = modal?.acao === 'registrar' || modal?.acao === 'corrigir';
  const precisaFormaData = modal?.acao === 'registrar' || modal?.acao === 'confirmar' || modal?.acao === 'corrigir';
  const titulo = modal?.acao === 'registrar' ? 'Registrar recebimento'
    : modal?.acao === 'confirmar' ? 'Confirmar recebimento'
      : modal?.acao === 'corrigir' ? 'Corrigir recebimento' : 'Estornar recebimento';

  return (
    <PageContainer variant="wide">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Cobranças e pagamentos autorizados para esta clínica.</p>
      </header>
      {erro && <p aria-live="polite" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
      <div className="space-y-3">
        {rows.map((row) => (
          <section key={row.orcamentoId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold text-foreground">{row.pacienteNome}</p><p className="text-sm text-muted-foreground">{row.dentistaNome} · saldo <span className="font-mono">{formatarCentavos(row.saldoCentavos)}</span></p></div>
              {row.saldoCentavos > 0 && row.capacidades.podeRegistrar && <Button disabled={pending} onClick={() => abrir({ acao: 'registrar', row })}>Registrar recebimento</Button>}
            </div>
            {row.pagamentos.map((pagamento) => (
              <div key={pagamento.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground"><span className="font-mono text-foreground">{formatarCentavos(pagamento.valorCentavos)}</span> · {pagamento.status}</span>
                <div className="flex flex-wrap gap-2">
                  {pagamento.status === 'pendente' && row.capacidades.podeConfirmar && <Button size="sm" variant="outline" disabled={pending} onClick={() => abrir({ acao: 'confirmar', row, pagamento })}>Confirmar</Button>}
                  {pagamento.status === 'pago' && row.capacidades.podeCorrigir && <Button size="sm" variant="outline" disabled={pending} onClick={() => abrir({ acao: 'corrigir', row, pagamento })}>Corrigir</Button>}
                  {pagamento.status === 'pago' && row.capacidades.podeEstornar && <Button size="sm" variant="outline" disabled={pending} onClick={() => abrir({ acao: 'estornar', row, pagamento })}>Estornar</Button>}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
      {!rows.length && <p className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">Nenhuma cobrança autorizada.</p>}
      {proximoOffset !== null && <div className="mt-4 flex justify-center"><Button variant="outline" disabled={pending || carregandoMais} onClick={carregarMais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</Button></div>}
      <Dialog open={modal !== null} onOpenChange={(open) => { if (!open && !pending) setModal(null); }}>
        <DialogContent className="bg-card text-foreground sm:max-w-md" onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (pending) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{modal?.row.pacienteNome} · {modal?.row.dentistaNome}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={confirmarEnvio}>
            {precisaValor && <div className="space-y-2"><Label htmlFor="recebimento-valor">Valor</Label><Input id="recebimento-valor" value={valor} onChange={(event) => setValor(event.target.value)} inputMode="decimal" placeholder="0,00" autoComplete="off" /></div>}
            {precisaFormaData && <>
              <div className="space-y-2"><Label htmlFor="recebimento-forma">Forma de pagamento</Label><select id="recebimento-forma" value={forma} onChange={(event) => setForma(event.target.value as '' | FormaPagamento)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"><option value="" disabled>Selecione a forma</option>{FORMAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="recebimento-data">Data</Label><Input id="recebimento-data" type="date" value={data} onChange={(event) => setData(event.target.value)} /></div>
            </>}
            {modal?.acao === 'estornar' && <div className="space-y-2"><Label htmlFor="recebimento-motivo">Motivo</Label><Input id="recebimento-motivo" value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={500} /></div>}
            <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setModal(null)}>Cancelar</Button><Button disabled={pending} type="submit">{pending ? 'Salvando…' : 'Salvar'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
