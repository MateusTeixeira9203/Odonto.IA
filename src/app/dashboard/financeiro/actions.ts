'use server';

import { revalidatePath } from 'next/cache';
import { requireClinicContext } from '@/server/auth/clinic';
import { inserirNotificacao } from '@/lib/notificacoes';
import { buildCsv } from '@/lib/export/csv';

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
  mes: string;
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
  dentistaId?: string;
};

export type DayPoint = {
  dia: string;
  diaISO: string;
  receita: number;
  despesas: number;
};

export type ReceitaManual = {
  id: string;
  clinica_id: string;
  dentista_id: string | null;
  valor: number;
  forma: 'pix' | 'dinheiro' | 'transferencia' | 'outro';
  data: string;
  descricao: string | null;
  created_at: string;
};

export type NovaReceitaForm = {
  valor: number;
  forma: 'pix' | 'dinheiro' | 'transferencia' | 'outro';
  data: string;
  descricao?: string;
  dentistaId?: string;
};

export type HoraClinicaResult = {
  despesasFixas: number;
  horasNoMes: number | null;
  custoPorHora: number | null;
};

export type PagamentoPago = {
  id: string;
  clinica_id: string;
  orcamento_id: string;
  paciente_id: string;
  paciente_nome: string;
  dentista_id: string;
  valor: number;
  forma_pagamento: string | null;
  data_pagamento: string;
  created_at: string;
};

export type PagamentoPendente = {
  id: string;
  orcamento_id: string;
  paciente_id: string;
  paciente_nome: string;
  dentista_id: string;
  valor: number;
  data_vencimento: string | null;
  created_at: string;
};

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

export async function listarDespesas(mesISO: string): Promise<Despesa[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let query = supabase
    .from('despesas')
    .select('*')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate)
    .order('data', { ascending: false });

  // Admin e dentista têm escopo individual: veem apenas os próprios registros
  if (role !== 'secretaria') {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data } = await query;
  return (data ?? []) as Despesa[];
}

export async function calcularSaldoMes(mesISO: string): Promise<SaldoMes> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const { inicio, fim, inicioDate, fimDate } = mesWindow(mesISO);
  const scopado = role !== 'secretaria';

  let despesasQuery = supabase
    .from('despesas')
    .select('valor')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate);

  let pagamentosQuery = supabase
    .from('pagamentos')
    .select('valor')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioDate)
    .lt('data_pagamento', fimDate);

  let receitasQuery = supabase
    .from('receitas_manuais')
    .select('valor')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate);

  if (scopado) {
    despesasQuery   = despesasQuery.eq('dentista_id', dentistaId);
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
    receitasQuery   = receitasQuery.eq('dentista_id', dentistaId);
  }

  const [{ data: pagamentos }, { data: despesasData }, { data: receitasData }] = await Promise.all([
    pagamentosQuery,
    despesasQuery,
    receitasQuery,
  ]);

  const receitaPagamentos = (pagamentos  ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const receitaManuais    = (receitasData ?? []).reduce((s, r) => s + Number(r.valor), 0);
  const receita  = receitaPagamentos + receitaManuais;
  const despesas = (despesasData ?? []).reduce((s, d) => s + Number(d.valor), 0);
  return { receita, despesas, saldo: receita - despesas };
}

export async function listarUltimos7Dias(): Promise<DayPoint[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const now = new Date();
  const dias: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  const inicioDate = dias[0].toISOString().split('T')[0];
  const scopado = role !== 'secretaria';

  let despesas7Query = supabase
    .from('despesas')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate);

  let pagamentosQuery = supabase
    .from('pagamentos')
    .select('valor, data_pagamento')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioDate);

  if (scopado) {
    despesas7Query  = despesas7Query.eq('dentista_id', dentistaId);
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
  }

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    pagamentosQuery,
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

export async function listarUltimosMeses(n = 6): Promise<ChartPoint[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const now = new Date();
  const inicioJanela = new Date(now.getFullYear(), now.getMonth() - n + 1, 1);
  const scopado = role !== 'secretaria';

  let pagamentosQuery = supabase
    .from('pagamentos')
    .select('valor, data_pagamento')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioJanela.toISOString().split('T')[0]);

  let despesasQuery = supabase
    .from('despesas')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioJanela.toISOString().split('T')[0]);

  if (scopado) {
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
    despesasQuery   = despesasQuery.eq('dentista_id', dentistaId);
  }

  const [{ data: pagamentos }, { data: despesasData }] = await Promise.all([
    pagamentosQuery,
    despesasQuery,
  ]);

  const result: ChartPoint[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const receita = (pagamentos ?? [])
      .filter(p => (p.data_pagamento as string)?.startsWith(mesISO))
      .reduce((s, p) => s + Number(p.valor), 0);

    const desp = (despesasData ?? [])
      .filter(x => (x.data as string).startsWith(mesISO))
      .reduce((s, x) => s + Number(x.valor), 0);

    result.push({ mes: MES_PT[d.getMonth()], mesISO, receita, despesas: desp });
  }

  return result;
}

export async function criarDespesa(
  form: NovaDespesaForm,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  // Secretária precisa especificar o dentista alvo; dentista/admin usa o próprio ID
  const dentistaAlvoId = role === 'secretaria' ? form.dentistaId ?? null : dentistaId;

  if (role === 'secretaria' && !dentistaAlvoId) {
    return { ok: false, erro: 'Selecione o dentista responsável pela despesa' };
  }

  const { data, error } = await supabase
    .from('despesas')
    .insert({
      clinica_id:  clinicId,
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

  if (role === 'secretaria' && dentistaAlvoId) {
    const valor = form.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dentistaAlvoId,
      deDentistaId:   dentistaId,
      tipo:           'sistema',
      titulo:         `Nova despesa lançada — ${form.categoria}`,
      mensagem:       `A secretária registrou uma saída de ${valor}${form.descricao ? ` (${form.descricao})` : ''} em seu nome.`,
      href:           '/dashboard/financeiro',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true, id: (data as { id: string }).id };
}

export async function excluirDespesa(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { error } = await supabase
    .from('despesas')
    .delete()
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true };
}

export async function listarReceitas(mesISO: string): Promise<ReceitaManual[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let query = supabase
    .from('receitas_manuais')
    .select('*')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate)
    .order('data', { ascending: false });

  if (role !== 'secretaria') {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data } = await query;
  return (data ?? []) as ReceitaManual[];
}

export async function criarReceita(
  form: NovaReceitaForm,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const dentistaAlvoId = role === 'secretaria' ? form.dentistaId ?? null : dentistaId;

  if (role === 'secretaria' && !dentistaAlvoId) {
    return { ok: false, erro: 'Selecione o dentista responsável pela entrada' };
  }

  const { data, error } = await supabase
    .from('receitas_manuais')
    .insert({
      clinica_id:  clinicId,
      dentista_id: dentistaAlvoId,
      valor:       form.valor,
      forma:       form.forma,
      data:        form.data,
      descricao:   form.descricao?.trim() || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, erro: error.message };

  if (role === 'secretaria' && dentistaAlvoId) {
    const valor = form.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const forma = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro' }[form.forma] ?? form.forma;
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dentistaAlvoId,
      deDentistaId:   dentistaId,
      tipo:           'sistema',
      titulo:         `Nova entrada lançada — ${forma}`,
      mensagem:       `A secretária registrou uma entrada de ${valor}${form.descricao ? ` (${form.descricao})` : ''} em seu nome.`,
      href:           '/dashboard/financeiro',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true, id: (data as { id: string }).id };
}

export async function excluirReceita(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  const { error } = await supabase
    .from('receitas_manuais')
    .delete()
    .eq('id', id)
    .eq('clinica_id', clinicId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  return { ok: true };
}

export async function calcularHoraClinica(mesISO: string): Promise<HoraClinicaResult> {
  const { supabase, clinicId } = await requireClinicContext();

  const { inicioDate, fimDate } = mesWindow(mesISO);

  const [{ data: despesasFixas }, { data: horarios }] = await Promise.all([
    supabase
      .from('despesas')
      .select('valor')
      .eq('clinica_id', clinicId)
      .eq('tipo', 'fixo')
      .gte('data', inicioDate)
      .lt('data', fimDate),
    supabase
      .from('horarios_disponiveis')
      .select('dia_semana, hora_inicio, hora_fim')
      .eq('clinica_id', clinicId)
      .eq('ativo', true),
  ]);

  const totalFixas = (despesasFixas ?? []).reduce((s, d) => s + Number(d.valor), 0);

  if (!horarios || horarios.length === 0) {
    return { despesasFixas: totalFixas, horasNoMes: null, custoPorHora: null };
  }

  const [ano, mes] = mesISO.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const contadorDia: Record<number, number> = {};
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    contadorDia[dow] = (contadorDia[dow] ?? 0) + 1;
  }

  let horasNoMes = 0;
  for (const h of horarios) {
    const [sh, sm] = (h.hora_inicio as string).split(':').map(Number);
    const [eh, em] = (h.hora_fim as string).split(':').map(Number);
    const hPorDia = (eh + em / 60) - (sh + sm / 60);
    if (hPorDia > 0) {
      horasNoMes += hPorDia * (contadorDia[h.dia_semana as number] ?? 0);
    }
  }

  const custoPorHora = horasNoMes > 0 ? totalFixas / horasNoMes : null;
  return { despesasFixas: totalFixas, horasNoMes, custoPorHora };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportarFinanceiroCsv(
  mesISO: string,
): Promise<{ csv: string; filename: string }> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();
  const { inicioDate, fimDate } = mesWindow(mesISO);
  const scopado = role !== 'secretaria';

  type Row = { tipo: string; data: string; descricao: string; forma: string; valor: number };

  let despesasQ = supabase.from('despesas').select('valor, data, descricao, categoria, tipo')
    .eq('clinica_id', clinicId).gte('data', inicioDate).lt('data', fimDate);
  let receitasQ = supabase.from('receitas_manuais').select('valor, data, descricao, forma')
    .eq('clinica_id', clinicId).gte('data', inicioDate).lt('data', fimDate);
  let pagamentosQ = supabase
    .from('pagamentos')
    .select('valor, data_pagamento, forma_pagamento, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId).eq('status', 'pago')
    .gte('data_pagamento', inicioDate).lt('data_pagamento', fimDate);

  if (scopado) {
    despesasQ   = despesasQ.eq('dentista_id', dentistaId);
    receitasQ   = receitasQ.eq('dentista_id', dentistaId);
    pagamentosQ = pagamentosQ.eq('dentista_id', dentistaId);
  }

  const [{ data: despesas }, { data: receitas }, { data: pagamentos }] =
    await Promise.all([despesasQ, receitasQ, pagamentosQ]);

  type RawDesp = { valor: number; data: string; descricao: string | null; categoria: string; tipo: string };
  type RawRec  = { valor: number; data: string; descricao: string | null; forma: string };
  type RawPag  = { valor: number; data_pagamento: string | null; forma_pagamento: string | null; paciente: { nome: string } | { nome: string }[] | null };

  const rows: Row[] = [
    ...((despesas ?? []) as RawDesp[]).map(d => ({
      tipo: 'Saída', data: d.data,
      descricao: d.descricao ?? d.categoria,
      forma: d.tipo === 'fixo' ? 'Fixo' : 'Variável',
      valor: -d.valor,
    })),
    ...((receitas ?? []) as RawRec[]).map(r => ({
      tipo: 'Entrada Manual', data: r.data,
      descricao: r.descricao ?? r.forma,
      forma: r.forma.toUpperCase(),
      valor: r.valor,
    })),
    ...((pagamentos ?? []) as unknown as RawPag[]).filter(p => p.data_pagamento).map(p => {
      const pac = Array.isArray(p.paciente) ? p.paciente[0] : p.paciente;
      return {
        tipo: 'Recebimento', data: p.data_pagamento!,
        descricao: (pac as { nome: string } | null)?.nome ?? 'Paciente',
        forma: p.forma_pagamento ?? '—',
        valor: p.valor,
      };
    }),
  ].sort((a, b) => a.data.localeCompare(b.data));

  const csv = buildCsv(rows, [
    { header: 'Tipo',        value: r => r.tipo },
    { header: 'Data',        value: r => r.data },
    { header: 'Descrição',   value: r => r.descricao },
    { header: 'Forma',       value: r => r.forma },
    { header: 'Valor (R$)',  value: r => r.valor.toFixed(2).replace('.', ',') },
  ]);

  return { csv, filename: `financeiro-${mesISO}.csv` };
}

export async function listarPagamentosPagos(mesISO: string): Promise<PagamentoPago[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let query = supabase
    .from('pagamentos')
    .select('id, clinica_id, orcamento_id, paciente_id, dentista_id, valor, forma_pagamento, data_pagamento, created_at, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioDate)
    .lt('data_pagamento', fimDate)
    .order('data_pagamento', { ascending: false });

  if (role !== 'secretaria') {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data } = await query;

  type Raw = {
    id: string; clinica_id: string; orcamento_id: string; paciente_id: string;
    dentista_id: string; valor: number; forma_pagamento: string | null;
    data_pagamento: string | null; created_at: string;
    paciente: { nome: string } | null;
  };

  return ((data ?? []) as unknown as Raw[])
    .filter(p => p.data_pagamento != null)
    .map(p => ({
      id:              p.id,
      clinica_id:      p.clinica_id,
      orcamento_id:    p.orcamento_id,
      paciente_id:     p.paciente_id,
      paciente_nome:   p.paciente?.nome ?? 'Paciente',
      dentista_id:     p.dentista_id,
      valor:           Number(p.valor),
      forma_pagamento: p.forma_pagamento,
      data_pagamento:  p.data_pagamento!,
      created_at:      p.created_at,
    }));
}

export async function listarPagamentosPendentes(): Promise<PagamentoPendente[]> {
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  let query = supabase
    .from('pagamentos')
    .select('id, orcamento_id, paciente_id, dentista_id, valor, data_vencimento, created_at, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  if (role !== 'secretaria') {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data } = await query;

  type Raw = {
    id: string; orcamento_id: string; paciente_id: string; dentista_id: string;
    valor: number; data_vencimento: string | null; created_at: string;
    paciente: { nome: string } | null;
  };

  return ((data ?? []) as unknown as Raw[]).map(p => ({
    id:             p.id,
    orcamento_id:   p.orcamento_id,
    paciente_id:    p.paciente_id,
    paciente_nome:  p.paciente?.nome ?? 'Paciente',
    dentista_id:    p.dentista_id,
    valor:          Number(p.valor),
    data_vencimento: p.data_vencimento,
    created_at:     p.created_at,
  }));
}
