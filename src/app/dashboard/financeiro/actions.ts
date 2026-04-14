'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Despesa = {
  id: string;
  clinica_id: string;
  dentista_id: string | null;
  valor: number;
  categoria: string;
  tipo: 'fixo' | 'variavel';
  data: string;
  descricao: string | null;
  created_at: string;
};

export type SaldoMes = {
  receita: number;
  despesas: number;
  saldo: number;
};

export type ChartPoint = {
  /** "Jan", "Fev", … */
  mes: string;
  /** "2026-04" */
  mesISO: string;
  receita: number;
  despesas: number;
};

export type NovaDespesaForm = {
  valor: number;
  categoria: string;
  tipo: 'fixo' | 'variavel';
  data: string;
  descricao?: string;
  /** ID do dentista a quem esta despesa pertence.
   *  Obrigatório quando quem cria é secretária no Plano CLÍNICA. */
  dentistaId?: string;
};

export type DayPoint = {
  /** "Seg", "Ter", … ou "Hoje" */
  dia: string;
  /** "2026-04-11" */
  diaISO: string;
  receita: number;
  despesas: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function mesWindow(mesISO: string): { inicio: string; fim: string; inicioDate: string; fimDate: string } {
  const [y, m] = mesISO.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fim    = new Date(y, m,     1);
  return {
    inicio:     inicio.toISOString(),
    fim:        fim.toISOString(),
    inicioDate: inicio.toISOString().split('T')[0],
    fimDate:    fim.toISOString().split('T')[0],
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Lista despesas de um mês (YYYY-MM).
 *  Dentistas vêem apenas as próprias; secretária/admin vêem todas da clínica. */
export async function listarDespesas(mesISO: string): Promise<Despesa[]> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const { inicioDate, fimDate } = mesWindow(mesISO);
  const supabase = await createClient();

  let query = supabase
    .from('despesas')
    .select('*')
    .eq('clinica_id', dentista.clinica_id)
    .gte('data', inicioDate)
    .lt('data', fimDate)
    .order('data', { ascending: false });

  // Silo de privacidade: dentista vê apenas suas próprias despesas
  if (dentista.role === 'dentista') {
    query = query.eq('dentista_id', dentista.id);
  }

  const { data } = await query;
  return (data ?? []) as Despesa[];
}

/** Calcula receita, despesas e lucro líquido de um mês.
 *  Dentistas têm silo: vêem apenas as próprias despesas. */
export async function calcularSaldoMes(mesISO: string): Promise<SaldoMes> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const { inicio, fim, inicioDate, fimDate } = mesWindow(mesISO);
  const supabase = await createClient();

  let despesasQuery = supabase
    .from('despesas')
    .select('valor')
    .eq('clinica_id', dentista.clinica_id)
    .gte('data', inicioDate)
    .lt('data', fimDate);

  if (dentista.role === 'dentista') {
    despesasQuery = despesasQuery.eq('dentista_id', dentista.id);
  }

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('valor')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'pago')
      .gte('created_at', inicio)
      .lt('created_at', fim),
    despesasQuery,
  ]);

  const receita  = (pagamentos   ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const despesas = (despesasData ?? []).reduce((s, d) => s + Number(d.valor), 0);
  return { receita, despesas, saldo: receita - despesas };
}

/** Retorna pontos de dados por dia nos últimos 7 dias (receita + despesas). */
export async function listarUltimos7Dias(): Promise<DayPoint[]> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const now = new Date();

  const dias: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  const inicioDate = dias[0].toISOString().split('T')[0];

  let despesas7Query = supabase
    .from('despesas')
    .select('valor, data')
    .eq('clinica_id', dentista.clinica_id)
    .gte('data', inicioDate);

  if (dentista.role === 'dentista') {
    despesas7Query = despesas7Query.eq('dentista_id', dentista.id);
  }

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('valor, data_pagamento')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'pago')
      .gte('data_pagamento', inicioDate),
    despesas7Query,
  ]);

  const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return dias.map((d, i) => {
    const diaISO = d.toISOString().split('T')[0];

    const receita = (pagamentos ?? [])
      .filter(p => (p.data_pagamento as string) === diaISO)
      .reduce((s, p) => s + Number(p.valor), 0);

    const despesas = (despesasData ?? [])
      .filter(x => (x.data as string) === diaISO)
      .reduce((s, x) => s + Number(x.valor), 0);

    return { dia: i === 6 ? 'Hoje' : DIAS_PT[d.getDay()], diaISO, receita, despesas };
  });
}

/** Retorna pontos de dados para os últimos N meses (receita + despesas). */
export async function listarUltimosMeses(n = 6): Promise<ChartPoint[]> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const now = new Date();
  const inicioJanela = new Date(now.getFullYear(), now.getMonth() - n + 1, 1);

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('valor, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .eq('status', 'pago')
      .gte('created_at', inicioJanela.toISOString()),
    supabase
      .from('despesas')
      .select('valor, data')
      .eq('clinica_id', dentista.clinica_id)
      .gte('data', inicioJanela.toISOString().split('T')[0]),
  ]);

  const result: ChartPoint[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const receita = (pagamentos ?? [])
      .filter(p => (p.created_at as string).startsWith(mesISO))
      .reduce((s, p) => s + Number(p.valor), 0);

    const desp = (despesasData ?? [])
      .filter(x => (x.data as string).startsWith(mesISO))
      .reduce((s, x) => s + Number(x.valor), 0);

    result.push({ mes: MES_PT[d.getMonth()], mesISO, receita, despesas: desp });
  }

  return result;
}

/** Cria uma nova despesa.
 *  Admin/dentista: dentista_id é o próprio ID.
 *  Secretária: deve passar form.dentistaId (dentista alvo). */
export async function criarDespesa(
  form: NovaDespesaForm,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Secretária deve sempre especificar o dentista alvo
  const dentistaAlvoId =
    dentista.role === 'secretaria'
      ? form.dentistaId ?? null
      : dentista.id;

  if (dentista.role === 'secretaria' && !dentistaAlvoId) {
    return { ok: false, erro: 'Selecione o dentista responsável pela despesa' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('despesas')
    .insert({
      clinica_id:  dentista.clinica_id,
      dentista_id: dentistaAlvoId,
      valor:       form.valor,
      categoria:   form.categoria.trim() || 'outro',
      tipo:        form.tipo,
      data:        form.data,
      descricao:   form.descricao?.trim() || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, erro: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true, id: (data as { id: string }).id };
}

/** Remove uma despesa (com validação de clinica_id). */
export async function excluirDespesa(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const { error } = await supabase
    .from('despesas')
    .delete()
    .eq('id', id)
    .eq('clinica_id', dentista.clinica_id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true };
}
