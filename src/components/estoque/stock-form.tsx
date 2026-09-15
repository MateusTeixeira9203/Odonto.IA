'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AjustarContagemSchema,
  CadastrarItemSchema,
  ConsumirMaterialSchema,
  CorrigirMovimentoSchema,
  DescartarMaterialSchema,
  EditarItemSchema,
  ReceberMaterialSchema,
  type ItemResumo,
  type LoteResumo,
  type MovimentoResumo,
  type TitularEstoque,
} from '@/server/estoque/contracts';
import type { StockMutation, StockPorts } from './stock-ports';
import { useStockMutation } from './use-stock-mutation';
import { canonicalStockQuantity, formatStockQuantity, STOCK_UNITS } from './stock-format';

const TITLES: Record<StockMutation, string> = {
  cadastrarItem: 'Novo material', editarItem: 'Editar material', receberMaterial: 'Registrar entrada',
  consumirMaterial: 'Registrar consumo', descartarMaterial: 'Descartar material',
  ajustarContagem: 'Conferir inventário', corrigirMovimento: 'Corrigir movimentação',
};
export const stockSelectClass = 'min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const VALIDATION_IDEMPOTENCY_KEY = '00000000-0000-4000-8000-000000000000';
const FIELD_IDS = {
  nome: 'estoque-nome-error',
  minimo: 'estoque-minimo-error',
  lote: 'estoque-lote-error',
  codigo: 'estoque-codigo-error',
  quantidade: 'estoque-quantidade-error',
  motivo: 'estoque-motivo-error',
  motivoVencido: 'estoque-motivo-vencido-error',
} as const;

type FieldName = keyof typeof FIELD_IDS;
type FieldErrors = Partial<Record<FieldName, string>>;

function stockActionValidation(action: StockMutation, payload: Record<string, unknown>) {
  const input = { ...payload, chaveIdempotencia: VALIDATION_IDEMPOTENCY_KEY };
  switch (action) {
    case 'cadastrarItem': return CadastrarItemSchema.safeParse(input);
    case 'editarItem': return EditarItemSchema.safeParse(input);
    case 'receberMaterial': return ReceberMaterialSchema.safeParse(input);
    case 'consumirMaterial': return ConsumirMaterialSchema.safeParse(input);
    case 'descartarMaterial': return DescartarMaterialSchema.safeParse(input);
    case 'ajustarContagem': return AjustarContagemSchema.safeParse(input);
    case 'corrigirMovimento': return CorrigirMovimentoSchema.safeParse(input);
  }
}

function fieldForIssue(path: PropertyKey[]): FieldName | null {
  const [first, second] = path;
  if (first === 'nome') return 'nome';
  if (first === 'minimo') return 'minimo';
  if (first === 'loteId') return 'lote';
  if (first === 'novoLote' && second === 'codigoFabricante') return 'codigo';
  if (first === 'quantidade' || first === 'quantidadeBase' || first === 'quantidadeContada'
    || (first === 'substituicao' && second === 'quantidade')) return 'quantidade';
  if (first === 'motivo') return 'motivo';
  if (first === 'motivoVencido') return 'motivoVencido';
  return null;
}

function messageForField(field: FieldName): string {
  const messages: Record<FieldName, string> = {
    nome: 'Informe um nome entre 1 e 120 caracteres.',
    minimo: 'Informe um estoque mínimo em quantidade válida.',
    lote: 'Selecione um lote para continuar.',
    codigo: 'Informe o código do lote.',
    quantidade: 'Informe uma quantidade válida, com até seis casas decimais.',
    motivo: 'Informe um motivo entre 1 e 500 caracteres.',
    motivoVencido: 'Confirme e explique o recebimento de material vencido.',
  };
  return messages[field];
}

function correctionType(movement?: MovimentoResumo): 'entrada' | 'consumo' | 'descarte' {
  if (movement?.tipo === 'entrada' || movement?.tipo === 'consumo' || movement?.tipo === 'descarte') {
    return movement.tipo;
  }
  return 'entrada';
}

function correctionQuantity(movement?: MovimentoResumo): string {
  if (!movement) return '';
  return formatStockQuantity(movement.quantidade.replace(/^-/, ''));
}

function Field({ name, children, error, errorId }: { name: string; children: ReactNode; error?: string; errorId?: string }) {
  return <div className="grid gap-2"><label className="grid gap-2 text-sm font-medium text-foreground">{name}{children}</label>{error && errorId && <p id={errorId} className="text-sm font-normal text-destructive">{error}</p>}</div>;
}

type Props = {
  action: StockMutation;
  clinicId: string;
  titular: TitularEstoque;
  item?: ItemResumo;
  lots: LoteResumo[];
  movement?: MovimentoResumo;
  ports: StockPorts;
  onClose(): void;
  onSaved(): Promise<void>;
  onRefresh(): Promise<void>;
};

export function StockForm({ action, clinicId, titular, item, lots, movement, ports, onClose, onSaved, onRefresh }: Props) {
  const [name, setName] = useState(item?.nome ?? '');
  const [unit, setUnit] = useState<'unidade' | 'g' | 'ml'>(item?.unidadeBase ?? 'unidade');
  const [minimum, setMinimum] = useState(item ? formatStockQuantity(item.minimo).replaceAll('.', '') : '0');
  const [controlled, setControlled] = useState(item?.controlaLote ?? false);
  const [active, setActive] = useState(item?.ativo ?? true);
  const [lotId, setLotId] = useState(movement?.loteId ?? (action === 'receberMaterial' ? '' : lots[0]?.id ?? ''));
  const [code, setCode] = useState('');
  const [validity, setValidity] = useState('');
  const [quantity, setQuantity] = useState(action === 'corrigirMovimento' ? correctionQuantity(movement) : '');
  const [reason, setReason] = useState('');
  const [acceptExpired, setAcceptExpired] = useState(false);
  const [expiredReason, setExpiredReason] = useState('');
  const [expiredDetailsOpen, setExpiredDetailsOpen] = useState(false);
  const [replacementType, setReplacementType] = useState<'entrada' | 'consumo' | 'descarte'>(correctionType(movement));
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FieldErrors>({});
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const operation = useStockMutation(ports[action]);
  const catalog = action === 'cadastrarItem' || action === 'editarItem';
  const receive = action === 'receberMaterial';
  const correction = action === 'corrigirMovimento';
  const canClose = !operation.pending && !operation.uncertain;
  const scopeName = titular.tipo === 'clinica' ? 'Materiais da clínica' : 'Meu estoque';

  function refForField(field: FieldName) {
    return (node: HTMLElement | null) => { fieldRefs.current[field] = node; };
  }

  function clearValidation(field: FieldName) {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setValidationMessage(null);
  }

  function showValidationErrors(issues: { path: PropertyKey[] }[]) {
    const errors: FieldErrors = {};
    let expiredPairInvalid = false;
    for (const issue of issues) {
      const field = fieldForIssue(issue.path);
      if (field && !errors[field]) errors[field] = messageForField(field);
      if (issue.path[0] === 'aceitarVencido' || issue.path[0] === 'motivoVencido') expiredPairInvalid = true;
    }
    if (expiredPairInvalid) setExpiredDetailsOpen(true);
    setValidationErrors(errors);
    setValidationMessage(expiredPairInvalid
      ? 'Para registrar material vencido, confirme a situação e informe o motivo.'
      : 'Revise os campos indicados antes de confirmar.');
    const firstField = (Object.keys(FIELD_IDS) as FieldName[]).find((field) => errors[field]);
    if (firstField) requestAnimationFrame(() => fieldRefs.current[firstField]?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const context = { clinicaIdEsperada: clinicId };
    const target = { ...context, itemId: item?.id, versaoEsperada: item?.versao };
    const expired = acceptExpired ? { aceitarVencido: true, motivoVencido: expiredReason } : {};
    let payload: Record<string, unknown>;
    if (action === 'cadastrarItem') {
      payload = { ...context, titular, nome: name, unidadeBase: unit, comportamento: 'consumivel', controlaLote: controlled, minimo: canonicalStockQuantity(minimum) };
    } else if (action === 'editarItem') {
      payload = { ...target, nome: name, minimo: canonicalStockQuantity(minimum), ativo: active, motivo: reason };
    } else if (receive) {
      payload = { ...target, quantidadeBase: canonicalStockQuantity(quantity), ...expired,
        ...(lotId ? { loteId: lotId } : { novoLote: { codigoFabricante: code.trim() || (item?.controlaLote ? '' : null), validadeISO: validity || null } }) };
    } else if (correction) {
      payload = { ...target, movimentoId: movement?.id, motivo: reason, ...expired,
        substituicao: { tipo: replacementType, quantidade: canonicalStockQuantity(quantity) } };
    } else {
      payload = { ...target, loteId: lotId, motivo: reason,
        [action === 'ajustarContagem' ? 'quantidadeContada' : 'quantidade']: canonicalStockQuantity(quantity) };
    }
    const validation = stockActionValidation(action, payload);
    if (!validation.success) {
      showValidationErrors(validation.error.issues);
      return;
    }
    setValidationErrors({});
    setValidationMessage(null);
    if (await operation.submit(payload)) { await onSaved(); onClose(); }
  }

  async function refresh() {
    setRefreshing(true);
    try { await onRefresh(); operation.clearFailure(); } finally { setRefreshing(false); }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && canClose) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg bg-card">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{TITLES[action]}</DialogTitle>
          <DialogDescription>{item ? `${item.nome} · ${scopeName}` : `${scopeName}. Registre a entrada depois de cadastrar.`}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="space-y-5">
          {validationMessage && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{validationMessage}</p>}
          <fieldset disabled={operation.pending || operation.uncertain || operation.blocked} className="grid gap-4 disabled:opacity-70">
            {catalog && <>
              <Field name="Nome do material" error={validationErrors.nome} errorId={FIELD_IDS.nome}><Input ref={refForField('nome')} className="min-h-11" value={name} onChange={(e) => { setName(e.target.value); clearValidation('nome'); }} required maxLength={120} autoFocus aria-invalid={Boolean(validationErrors.nome)} aria-describedby={validationErrors.nome ? FIELD_IDS.nome : undefined} /></Field>
              {action === 'cadastrarItem' && <Field name="Unidade-base"><select className={stockSelectClass} value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}><option value="unidade">Unidade</option><option value="g">Gramas (g)</option><option value="ml">Mililitros (ml)</option></select></Field>}
              <Field name="Estoque mínimo" error={validationErrors.minimo} errorId={FIELD_IDS.minimo}><Input ref={refForField('minimo')} className="min-h-11" inputMode="decimal" value={minimum} onChange={(e) => { setMinimum(e.target.value); clearValidation('minimo'); }} required maxLength={20} aria-invalid={Boolean(validationErrors.minimo)} aria-describedby={validationErrors.minimo ? FIELD_IDS.minimo : undefined} /></Field>
              {action === 'cadastrarItem'
                ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={controlled} onChange={(e) => setControlled(e.target.checked)} />Exigir identificação de lote</label>
                : <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} />Material ativo — desmarque para arquivar sem apagar o histórico</label>}
            </>}
            {!catalog && <>
              {!correction && <Field name="Lote" error={validationErrors.lote} errorId={FIELD_IDS.lote}><select ref={refForField('lote')} className={stockSelectClass} value={lotId} onChange={(e) => { setLotId(e.target.value); clearValidation('lote'); }} required={!receive} aria-invalid={Boolean(validationErrors.lote)} aria-describedby={validationErrors.lote ? FIELD_IDS.lote : undefined}>
                {receive ? <option value="">Cadastrar lote desta entrada</option> : <option value="" disabled>Selecione o lote</option>}
                {lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.codigoFabricante ?? 'Sem identificação'} · saldo {formatStockQuantity(lot.saldo)}</option>)}
              </select></Field>}
              {receive && !lotId && <div className="grid gap-4 sm:grid-cols-2">
                <Field name="Lote do fabricante" error={validationErrors.codigo} errorId={FIELD_IDS.codigo}><Input ref={refForField('codigo')} className="min-h-11" value={code} onChange={(e) => { setCode(e.target.value); clearValidation('codigo'); }} required={item?.controlaLote} maxLength={120} aria-invalid={Boolean(validationErrors.codigo)} aria-describedby={validationErrors.codigo ? FIELD_IDS.codigo : undefined} /></Field>
                <Field name="Validade (opcional)"><Input className="min-h-11" type="date" value={validity} onChange={(e) => setValidity(e.target.value)} /></Field>
              </div>}
              {correction && <><p className="text-sm text-muted-foreground">O registro original será preservado. Confira o tipo e a quantidade correta para o mesmo lote.</p><Field name="Tipo correto"><select className={stockSelectClass} value={replacementType} onChange={(e) => setReplacementType(e.target.value as typeof replacementType)}><option value="entrada">Entrada</option><option value="consumo">Consumo</option><option value="descarte">Descarte</option></select></Field></>}
              <Field name={`${action === 'ajustarContagem' ? 'Quantidade contada no lote' : 'Quantidade'} (${STOCK_UNITS[item?.unidadeBase ?? 'unidade']})`} error={validationErrors.quantidade} errorId={FIELD_IDS.quantidade}><Input ref={refForField('quantidade')} className="min-h-11" inputMode="decimal" value={quantity} onChange={(e) => { setQuantity(e.target.value); clearValidation('quantidade'); }} required maxLength={20} aria-invalid={Boolean(validationErrors.quantidade)} aria-describedby={validationErrors.quantidade ? FIELD_IDS.quantidade : undefined} /></Field>
              {action === 'ajustarContagem' && <p className="text-sm text-muted-foreground">Informe o que foi contado fisicamente. O sistema calcula a diferença e mantém o histórico.</p>}
            </>}
            {!receive && action !== 'cadastrarItem' && <Field name="Motivo" error={validationErrors.motivo} errorId={FIELD_IDS.motivo}><Input ref={refForField('motivo')} className="min-h-11" value={reason} onChange={(e) => { setReason(e.target.value); clearValidation('motivo'); }} required maxLength={500} aria-invalid={Boolean(validationErrors.motivo)} aria-describedby={validationErrors.motivo ? FIELD_IDS.motivo : undefined} /></Field>}
            {(receive || (correction && replacementType === 'entrada')) && <details open={expiredDetailsOpen} onToggle={(event) => setExpiredDetailsOpen(event.currentTarget.open)} className="text-sm text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Recebimento de material já vencido</summary>
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-5" checked={acceptExpired} onChange={(e) => { setAcceptExpired(e.target.checked); clearValidation('motivoVencido'); }} />Registrar para controle e descarte, sem liberar consumo</label>
              {acceptExpired && <Field name="Motivo do recebimento vencido" error={validationErrors.motivoVencido} errorId={FIELD_IDS.motivoVencido}><Input ref={refForField('motivoVencido')} className="min-h-11" value={expiredReason} onChange={(e) => { setExpiredReason(e.target.value); clearValidation('motivoVencido'); }} required maxLength={500} aria-invalid={Boolean(validationErrors.motivoVencido)} aria-describedby={validationErrors.motivoVencido ? FIELD_IDS.motivoVencido : undefined} /></Field>}
            </details>}
          </fieldset>
          {operation.failure && <div role="alert" className="space-y-3 rounded-lg border border-border bg-muted p-3 text-sm">
            <p>{operation.failure.mensagem}</p>
            {operation.uncertain && <p>A operação pode ter sido registrada. Use “Conferir operação” para recuperar o resultado sem duplicar a movimentação.</p>}
            {operation.failure.codigo === 'CONFLITO' && <Button type="button" variant="outline" className="min-h-11" disabled={refreshing} onClick={refresh}>{refreshing ? 'Atualizando…' : 'Atualizar saldo e conferir novamente'}</Button>}
          </div>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" className="min-h-11" disabled={!canClose} onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="min-h-11" disabled={operation.pending || refreshing || operation.blocked || operation.failure?.codigo === 'CONFLITO'}>
              {operation.pending ? 'Conferindo…' : operation.uncertain ? 'Conferir operação' : action === 'cadastrarItem' ? 'Cadastrar material' : 'Confirmar registro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
