'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Users, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layout/page-container';
import type { ClinicaResult, ResultadosClinica } from '@/server/clinica/contracts';

type Props = { clinicaId: string; mesInicial: string; initialResult: ClinicaResult<ResultadosClinica>; load: (input: { clinicaIdEsperada: string; mes: string; dentistaId: string | null }) => Promise<ClinicaResult<ResultadosClinica>> };
const moeda = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function ResultadosClinicaWorkspace({ clinicaId, mesInicial, initialResult, load }: Props) {
  const [result, setResult] = useState(initialResult);
  const [mes, setMes] = useState(mesInicial);
  const [dentista, setDentista] = useState(initialResult.ok ? initialResult.data.dentistaFiltro ?? '' : '');
  const [profissionais, setProfissionais] = useState(initialResult.ok ? initialResult.data.profissionais : []);
  const [busy, setBusy] = useState(false);
  const [privado, setPrivado] = useState(false);
  const request = useRef(0);
  async function atualizar() {
    const atual = ++request.current;
    setBusy(true);
    try {
      const next = await load({ clinicaIdEsperada: clinicaId, mes, dentistaId: dentista || null });
      if (request.current === atual) {
        setResult(next);
        if (next.ok) setProfissionais(next.data.profissionais);
      }
    } catch { if (request.current === atual) setResult({ ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar os resultados. Tente novamente.' }); }
    finally { if (request.current === atual) setBusy(false); }
  }
  const data = result.ok ? result.data : null;
  const dinheiro = (value: number) => privado ? '••••' : moeda(value);
  const entradas = data ? data.recebidoClinicaCentavos + (data.dentistaFiltro ? 0 : data.receitasManuaisCentavos) : 0;
  const saldo = data ? entradas - data.despesasClinicaCentavos : 0;
  const metrics = data ? [
    ['Recebido pela clínica', entradas, data.dentistaFiltro ? 'Recebimentos dos atendimentos selecionados' : 'Pagamentos confirmados e entradas manuais'],
    ['A receber pela clínica', data.aReceberClinicaCentavos, 'Saldo atual das cobranças, de todos os períodos'],
    ['Despesas da clínica', data.despesasClinicaCentavos, 'Saídas da unidade no mês, sem rateio'],
    [data.dentistaFiltro ? 'Recebido diretamente pelo dentista' : 'Saldo de caixa da clínica', data.dentistaFiltro ? data.recebidoDiretoCentavos : saldo, data.dentistaFiltro ? 'Separado do caixa da clínica' : 'Entradas menos despesas; não representa lucro'],
  ] as const : [];
  return <PageContainer variant="wide">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1"><h2 className="font-heading text-2xl font-bold text-foreground">Resultados da clínica</h2><p className="mt-1 text-sm text-muted-foreground">Atendimentos e dinheiro recebido, com cada origem identificada.</p></div>
      <Button variant="outline" size="icon" className="size-11" aria-label={privado ? 'Mostrar valores' : 'Ocultar valores'} onClick={() => setPrivado(!privado)}>{privado ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
    </div>
    <form onSubmit={e => { e.preventDefault(); void atualizar(); }} className="mb-8 flex flex-wrap items-end gap-4">
      <label className="grid gap-2 text-sm text-foreground">Período<input aria-label="Período" type="month" min="2000-01" max="2100-12" required value={mes} onChange={e => setMes(e.target.value)} className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring" /></label>
      <label className="grid flex-1 gap-2 text-sm text-foreground sm:max-w-sm">Profissional<select aria-label="Profissional" value={dentista} onChange={e => setDentista(e.target.value)} className="min-h-11 max-w-full rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-ring"><option value="">Toda a clínica</option>{profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <Button type="submit" disabled={busy} className="min-h-11">{busy ? 'Atualizando…' : 'Atualizar'}</Button>
    </form>
    <div role="status" aria-live="polite" className="sr-only">{busy ? 'Carregando resultados.' : data ? `Resultados de ${data.mes} carregados.` : ''}</div>
    {!result.ok && <section role="alert" className="rounded-xl border border-border bg-card p-6 text-foreground"><p>{result.mensagem}</p><Button className="mt-4" variant="outline" onClick={() => void atualizar()} disabled={busy}>Tentar novamente</Button></section>}
    {data && <div aria-busy={busy} className={busy ? 'pointer-events-none opacity-60' : ''}>
      <p className="mb-4 text-xs text-muted-foreground">Período exibido: {data.mes.split('-').reverse().join('/')} · {data.dentistaFiltro ? data.profissionais.find(p => p.id === data.dentistaFiltro)?.nome : 'Toda a clínica'}</p>
      <section aria-label="Resumo financeiro" className="grid gap-4 md:grid-cols-2">
        {metrics.map(([title, value, hint]) => <article key={title} className="rounded-xl border border-border bg-card p-6"><h3 className="font-sans text-sm font-semibold text-muted-foreground">{title}</h3><p className="my-3 break-words font-mono text-3xl font-semibold tabular-nums text-foreground">{dinheiro(value)}</p><p className="text-xs leading-relaxed text-muted-foreground">{hint}</p></article>)}
      </section>
      <section aria-label="Operação da clínica" className="my-8 rounded-xl border border-border bg-card p-6">
        <h2 className="mb-6 font-heading text-xl text-foreground">Como estão os atendimentos</h2>
        <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">{[['Realizados',data.realizados],['Faltas',data.faltas],['Cancelados',data.cancelados],['A confirmar amanhã',data.confirmacoesAmanha]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</dd></div>)}</dl>
      </section>
      <section className="rounded-xl border border-border bg-card p-6" aria-label="Resultados por profissional">
        <h2 className="font-heading text-xl text-foreground">Por profissional</h2><p className="mb-6 mt-1 text-sm text-muted-foreground">Recebimentos dos atendimentos no mês. O valor recebido pela clínica não é renda pessoal do dentista.</p>
        {data.porProfissional.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum profissional neste período ou filtro.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">Recebimentos separados por titular e atendimentos de cada profissional</caption><thead><tr className="border-b border-border text-muted-foreground">{['Profissional','Realizados','Para a clínica','Direto ao dentista','Faltas'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium first:pl-0">{label}</th>)}</tr></thead><tbody>{data.porProfissional.map(p => <tr key={p.id} className="border-b border-border text-foreground last:border-0"><th scope="row" className="py-4 pr-3 font-medium">{p.nome}</th><td className="px-3 py-4 font-mono">{p.realizados}</td><td className="px-3 py-4 font-mono whitespace-nowrap">{dinheiro(p.recebidoClinicaCentavos)}</td><td className="px-3 py-4 font-mono whitespace-nowrap">{dinheiro(p.recebidoDiretoCentavos)}</td><td className="px-3 py-4 font-mono">{p.faltas}</td></tr>)}</tbody></table></div>}
      </section>
    </div>}
    <nav aria-label="Gestão da unidade" className="mt-8 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href="/equipe"><Users aria-hidden="true" className="size-4" />Equipe<ArrowRight aria-hidden="true" className="size-4" /></Link><Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" href="/estoque"><Package aria-hidden="true" className="size-4" />Estoque<ArrowRight aria-hidden="true" className="size-4" /></Link></nav>
  </PageContainer>;
}
