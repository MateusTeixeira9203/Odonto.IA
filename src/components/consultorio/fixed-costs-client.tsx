'use client';

import { useState, useTransition } from 'react';
import { Pencil, Plus, Save } from 'lucide-react';

import type { ClinicFinancialData } from '@/server/financeiro/clinica';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { saveFixedCost } from '@/app/dashboard/meu-consultorio/financeiro-clinica/custos/actions';

type Recurrence = ClinicFinancialData['recorrencias'][number];
type Form = { id: string | null; descricao: string; categoria: string; valor: string; diaVencimento: string; ativo: boolean };
const emptyForm = (): Form => ({ id: null, descricao: '', categoria: 'Operacional', valor: '', diaVencimento: '5', ativo: true });
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function FixedCostsClient({ initialCosts }: { initialCosts: Recurrence[] }): React.JSX.Element {
  const [costs, setCosts] = useState(initialCosts);
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function edit(cost: Recurrence): void {
    setMessage(null);
    setForm({ id: cost.id, descricao: cost.descricao, categoria: cost.categoria, valor: String(cost.valor), diaVencimento: String(cost.diaVencimento), ativo: cost.ativo });
  }

  function save(): void {
    if (!form) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveFixedCost({ ...form, valor: Number(form.valor.replace(',', '.')), diaVencimento: Number(form.diaVencimento) });
      if (!result.ok) { setMessage(result.mensagem); return; }
      const changed: Recurrence = { id: form.id ?? crypto.randomUUID(), descricao: form.descricao, categoria: form.categoria, valor: Number(form.valor.replace(',', '.')), diaVencimento: Number(form.diaVencimento), ativo: form.ativo };
      setCosts((previous) => form.id ? previous.map((cost) => cost.id === form.id ? changed : cost) : [...previous, changed]);
      setForm(null);
      setMessage('Custo fixo salvo. A projeção usa esta regra; o caixa só muda quando a despesa for lançada.');
    });
  }

  return <div className="space-y-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="font-heading text-2xl text-text-primary">Custos fixos</h2><p className="mt-1 max-w-2xl text-sm text-text-secondary">Essas regras servem para projeção mensal. Registre a despesa efetivamente paga no financeiro para alterar o caixa.</p></div><Button onClick={() => { setMessage(null); setForm(emptyForm()); }}><Plus />Adicionar custo fixo</Button></div>{message ? <p role="status" className="rounded-lg border border-teal/30 bg-teal-pale px-4 py-3 text-sm text-teal-ink">{message}</p> : null}{form ? <Card><CardHeader><CardTitle>{form.id ? 'Editar custo fixo' : 'Novo custo fixo'}</CardTitle><CardDescription>O vencimento vai de 1 a 28 para não depender do tamanho do mês.</CardDescription></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2"><Field label="Descrição"><Input value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} /></Field><Field label="Categoria"><Input value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })} /></Field><Field label="Valor mensal (R$)"><Input inputMode="decimal" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></Field><Field label="Dia de vencimento"><Input type="number" min={1} max={28} value={form.diaVencimento} onChange={(event) => setForm({ ...form, diaVencimento: event.target.value })} /></Field></div><label className="mt-4 flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={form.ativo} onChange={(event) => setForm({ ...form, ativo: event.target.checked })} />Considerar este custo na projeção mensal</label><div className="mt-5 flex gap-2"><Button disabled={pending} onClick={save}>{pending ? 'Salvando…' : <><Save />Salvar custo</>}</Button><Button variant="outline" disabled={pending} onClick={() => setForm(null)}>Cancelar</Button></div></CardContent></Card> : null}<Card><CardContent className="overflow-x-auto pt-4"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-text-secondary"><tr><th className="pb-3 font-medium">Custo</th><th className="pb-3 font-medium">Categoria</th><th className="pb-3 text-right font-medium">Valor mensal</th><th className="pb-3 text-right font-medium">Vencimento</th><th className="pb-3 text-right font-medium">Ação</th></tr></thead><tbody>{costs.length === 0 ? <tr><td colSpan={5} className="border-t border-border py-6 text-text-secondary">Nenhum custo fixo configurado.</td></tr> : costs.map((cost) => <tr key={cost.id} className="border-t border-border"><td className="py-4 font-medium text-text-primary">{cost.descricao}{!cost.ativo ? <span className="ml-2 text-xs font-normal text-text-secondary">Pausado</span> : null}</td><td className="py-4 text-text-secondary">{cost.categoria}</td><td className="py-4 text-right font-mono text-text-primary">{money.format(cost.valor)}</td><td className="py-4 text-right text-text-secondary">dia {cost.diaVencimento}</td><td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => edit(cost)}><Pencil />Editar</Button></td></tr>)}</tbody></table></CardContent></Card></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
