'use server';

import { revalidatePath } from 'next/cache';
import { requireClinicContext } from '@/server/auth/clinic';
import { inserirNotificacao } from '@/lib/notificacoes';
import { buildCsv } from '@/lib/export/csv';
import { registrarPagamento, type FormaPagamento } from '@/app/dashboard/orcamentos/actions';
import { horasLiquidasNoMes, janelaDoMes, mesBRT, mesesAte, ultimosDiasBRT, type TurnoClinico } from '@/lib/financeiro/calculos';
import { dentistaFinanceiroSchema, despesaFinanceiroSchema, mesFinanceiroSchema, receitaFinanceiroSchema } from '@/lib/financeiro/schemas';
import { cobrançasAtivasComSaldo } from '@/lib/financeiro/cobrancas';
import { agregarFluxoFinanceiro } from '@/lib/financeiro/agregacao';
import { deriveEstadoOrcamento } from '@/lib/orcamentos/estado';

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

function mesWindow(mesISO: string): { inicioDate: string; fimDate: string } {
  const parsed = mesFinanceiroSchema.safeParse(mesISO);
  if (!parsed.success) throw new Error('Mês inválido.');
  const { inicio, fim } = janelaDoMes(parsed.data);
  return { inicioDate: inicio, fimDate: fim };
}

async function resolverDentistaFiltro(
  context: Awaited<ReturnType<typeof requireClinicContext>>,
  dentistaFiltro?: string,
): Promise<string | null> {
  if (context.role !== 'secretaria') return context.dentistaId;
  if (!dentistaFiltro) return null;
  const parsed = dentistaFinanceiroSchema.safeParse(dentistaFiltro);
  if (!parsed.success) throw new Error('Dentista selecionado inválido.');
  const { data, error } = await context.supabase
    .from('dentistas')
    .select('id')
    .eq('id', parsed.data)
    .eq('clinica_id', context.clinicId)
    .eq('ativo', true)
    .in('role', ['admin', 'dentista'])
    .maybeSingle();
  if (error) throw new Error(`Falha ao validar dentista: ${error.message}`);
  if (!data) throw new Error('Dentista selecionado não está ativo nesta clínica.');
  return data.id;
}

export async function listarDespesas(mesISO: string, dentistaFiltro?: string): Promise<Despesa[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let query = supabase
    .from('despesas')
    .select('*')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate)
    .order('data', { ascending: false });

  if (dentistaId) {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar despesas: ${error.message}`);
  return (data ?? []) as Despesa[];
}

export async function calcularSaldoMes(mesISO: string, dentistaFiltro?: string): Promise<SaldoMes> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let despesasQuery = supabase
    .from('despesas')
    .select('valor')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate);

  // R-114 — regra única: pagamento pago conta (I7). O filtro do R-65 escondia dinheiro real
  // (14 de 35 rascunhos da ClinDent tinham pagamento pago) porque status podia discordar do
  // que já tinha sido aprovado por item — o guard de aceitar pagamento agora vive na ESCRITA
  // (orcamentoAceitaPagamento), não precisa ser refeito na leitura.
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

  if (dentistaId) {
    despesasQuery   = despesasQuery.eq('dentista_id', dentistaId);
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
    receitasQuery   = receitasQuery.eq('dentista_id', dentistaId);
  }

  const [
    { data: pagamentos, error: errPag },
    { data: despesasData, error: errDesp },
    { data: receitasData, error: errRec },
  ] = await Promise.all([pagamentosQuery, despesasQuery, receitasQuery]);

  if (errPag || errDesp || errRec) {
    throw new Error(`Falha ao calcular saldo do mês: ${(errPag ?? errDesp ?? errRec)?.message}`);
  }

  return agregarFluxoFinanceiro({
    pagamentos: (pagamentos ?? []).map((pagamento) => ({ valor: Number(pagamento.valor), status: 'pago' })),
    receitasManuais: (receitasData ?? []).map((receita) => ({ valor: Number(receita.valor) })),
    despesas: (despesasData ?? []).map((despesa) => ({ valor: Number(despesa.valor) })),
  });
}

export async function listarUltimos7Dias(dentistaFiltro?: string): Promise<DayPoint[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const dias = ultimosDiasBRT(7);
  const inicioDate = dias[0]?.diaISO;
  if (!inicioDate) return [];

  let despesas7Query = supabase
    .from('despesas')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate);

  // R-114 — regra única (I7): pagamento pago conta, sem condição por status do pai.
  let pagamentosQuery = supabase
    .from('pagamentos')
    .select('valor, data_pagamento')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioDate);

  let receitasQuery = supabase
    .from('receitas_manuais')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate);

  if (dentistaId) {
    despesas7Query  = despesas7Query.eq('dentista_id', dentistaId);
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
    receitasQuery = receitasQuery.eq('dentista_id', dentistaId);
  }

  const [{ data: pagamentos, error: errPag }, { data: despesasData, error: errDesp }, { data: receitas, error: errRec }] = await Promise.all([
    pagamentosQuery,
    despesas7Query,
    receitasQuery,
  ]);
  if (errPag || errDesp || errRec) {
    throw new Error(`Falha ao carregar últimos 7 dias: ${(errPag ?? errDesp ?? errRec)?.message}`);
  }

  return dias.map(({ dia, diaISO }) => {
    const fluxo = agregarFluxoFinanceiro({
      pagamentos: (pagamentos ?? []).filter((pagamento) => pagamento.data_pagamento === diaISO)
        .map((pagamento) => ({ valor: Number(pagamento.valor), status: 'pago' })),
      receitasManuais: (receitas ?? []).filter((receita) => receita.data === diaISO)
        .map((receita) => ({ valor: Number(receita.valor) })),
      despesas: (despesasData ?? []).filter((despesa) => despesa.data === diaISO)
        .map((despesa) => ({ valor: Number(despesa.valor) })),
    });
    return { dia, diaISO, receita: fluxo.receita, despesas: fluxo.despesas };
  });
}

export async function listarUltimosMeses(n = 6, mesReferencia?: string, dentistaFiltro?: string): Promise<ChartPoint[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);
  if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error('Janela de meses inválida.');

  const referencia = mesReferencia ?? mesBRT();
  const meses = mesesAte(referencia, n);
  if (meses.length === 0) throw new Error('Mês inválido.');
  const inicioJanela = `${meses[0]}-01`;

  // R-114 — regra única (I7): pagamento pago conta, sem condição por status do pai.
  let pagamentosQuery = supabase
    .from('pagamentos')
    .select('valor, data_pagamento')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioJanela);

  let despesasQuery = supabase
    .from('despesas')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioJanela);

  let receitasQuery = supabase
    .from('receitas_manuais')
    .select('valor, data')
    .eq('clinica_id', clinicId)
    .gte('data', inicioJanela);

  if (dentistaId) {
    pagamentosQuery = pagamentosQuery.eq('dentista_id', dentistaId);
    despesasQuery   = despesasQuery.eq('dentista_id', dentistaId);
    receitasQuery   = receitasQuery.eq('dentista_id', dentistaId);
  }

  const [{ data: pagamentos, error: errPag }, { data: despesasData, error: errDesp }, { data: receitas, error: errRec }] = await Promise.all([
    pagamentosQuery,
    despesasQuery,
    receitasQuery,
  ]);
  if (errPag || errDesp || errRec) {
    throw new Error(`Falha ao carregar últimos meses: ${(errPag ?? errDesp ?? errRec)?.message}`);
  }

  const result: ChartPoint[] = [];

  for (const mesISO of meses) {
    const d = new Date(`${mesISO}-01T12:00:00Z`);

    const fluxo = agregarFluxoFinanceiro({
      pagamentos: (pagamentos ?? []).filter((pagamento) => pagamento.data_pagamento?.startsWith(mesISO))
        .map((pagamento) => ({ valor: Number(pagamento.valor), status: 'pago' })),
      receitasManuais: (receitas ?? []).filter((receita) => receita.data.startsWith(mesISO))
        .map((receita) => ({ valor: Number(receita.valor) })),
      despesas: (despesasData ?? []).filter((despesa) => despesa.data.startsWith(mesISO))
        .map((despesa) => ({ valor: Number(despesa.valor) })),
    });
    result.push({ mes: MES_PT[d.getUTCMonth()], mesISO, receita: fluxo.receita, despesas: fluxo.despesas });
  }

  return result;
}

export async function criarDespesa(
  form: NovaDespesaForm,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const parsed = despesaFinanceiroSchema.safeParse(form);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const context = await requireClinicContext();
  const { supabase, clinicId, dentistaId, role } = context;
  const dados = parsed.data;

  // Secretária precisa especificar o dentista alvo; dentista/admin usa o próprio ID
  let dentistaAlvoId: string | null;
  try {
    dentistaAlvoId = role === 'secretaria' ? await resolverDentistaFiltro(context, dados.dentistaId) : dentistaId;
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : 'Não foi possível validar o dentista.' };
  }

  if (role === 'secretaria' && !dentistaAlvoId) {
    return { ok: false, erro: 'Selecione o dentista responsável pela despesa' };
  }

  const { data, error } = await supabase
    .from('despesas')
    .insert({
      clinica_id:  clinicId,
      dentista_id: dentistaAlvoId,
      valor:       dados.valor,
      categoria:   dados.categoria,
      tipo:        dados.tipo,
      data:        dados.data,
      descricao:   dados.descricao || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, erro: error.message };

  if (role === 'secretaria' && dentistaAlvoId) {
    const valor = dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dentistaAlvoId,
      deDentistaId:   dentistaId,
      tipo:           'sistema',
      titulo:         `Nova despesa lançada — ${dados.categoria}`,
      mensagem:       `A secretária registrou uma saída de ${valor}${dados.descricao ? ` (${dados.descricao})` : ''} em seu nome.`,
      href:           '/dashboard/financeiro',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { ok: true, id: (data as { id: string }).id };
}

export async function excluirDespesa(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  const parsed = dentistaFinanceiroSchema.safeParse(id);
  if (!parsed.success) return { ok: false, erro: 'Lançamento inválido.' };
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  let query = supabase
    .from('despesas')
    .delete()
    .eq('id', parsed.data)
    .eq('clinica_id', clinicId)
    .select('id');
  if (role !== 'secretaria') query = query.eq('dentista_id', dentistaId);
  const { data, error } = await query;

  if (error) return { ok: false, erro: error.message };
  if (!data?.length) return { ok: false, erro: 'Lançamento não encontrado ou sem permissão.' };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { ok: true };
}

export async function listarReceitas(mesISO: string, dentistaFiltro?: string): Promise<ReceitaManual[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let query = supabase
    .from('receitas_manuais')
    .select('*')
    .eq('clinica_id', clinicId)
    .gte('data', inicioDate)
    .lt('data', fimDate)
    .order('data', { ascending: false });

  if (dentistaId) {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar receitas: ${error.message}`);
  return (data ?? []) as ReceitaManual[];
}

export async function criarReceita(
  form: NovaReceitaForm,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const parsed = receitaFinanceiroSchema.safeParse(form);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  const context = await requireClinicContext();
  const { supabase, clinicId, dentistaId, role } = context;
  const dados = parsed.data;

  let dentistaAlvoId: string | null;
  try {
    dentistaAlvoId = role === 'secretaria' ? await resolverDentistaFiltro(context, dados.dentistaId) : dentistaId;
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : 'Não foi possível validar o dentista.' };
  }

  if (role === 'secretaria' && !dentistaAlvoId) {
    return { ok: false, erro: 'Selecione o dentista responsável pela entrada' };
  }

  const { data, error } = await supabase
    .from('receitas_manuais')
    .insert({
      clinica_id:  clinicId,
      dentista_id: dentistaAlvoId,
      valor:       dados.valor,
      forma:       dados.forma,
      data:        dados.data,
      descricao:   dados.descricao || null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, erro: error.message };

  if (role === 'secretaria' && dentistaAlvoId) {
    const valor = dados.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const forma = { pix: 'PIX', dinheiro: 'Dinheiro', transferencia: 'Transferência', outro: 'Outro' }[dados.forma] ?? dados.forma;
    await inserirNotificacao(supabase, {
      clinicaId:      clinicId,
      paraRole:       'dentista',
      paraDentistaId: dentistaAlvoId,
      deDentistaId:   dentistaId,
      tipo:           'pagamento_confirmado',
      titulo:         `Pagamento confirmado — ${forma}`,
      mensagem:       `A secretária registrou uma entrada de ${valor}${dados.descricao ? ` (${dados.descricao})` : ''} em seu nome.`,
      href:           '/dashboard/financeiro',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { ok: true, id: (data as { id: string }).id };
}

export async function excluirReceita(
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  const parsed = dentistaFinanceiroSchema.safeParse(id);
  if (!parsed.success) return { ok: false, erro: 'Lançamento inválido.' };
  const { supabase, clinicId, dentistaId, role } = await requireClinicContext();

  let query = supabase
    .from('receitas_manuais')
    .delete()
    .eq('id', parsed.data)
    .eq('clinica_id', clinicId)
    .select('id');
  if (role !== 'secretaria') query = query.eq('dentista_id', dentistaId);
  const { data, error } = await query;

  if (error) return { ok: false, erro: error.message };
  if (!data?.length) return { ok: false, erro: 'Lançamento não encontrado ou sem permissão.' };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/meu-consultorio/financeiro');
  return { ok: true };
}

export async function calcularHoraClinica(mesISO: string, dentistaFiltro?: string): Promise<HoraClinicaResult> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const { inicioDate, fimDate } = mesWindow(mesISO);

  let despesasQuery = supabase
      .from('despesas')
      .select('valor')
      .eq('clinica_id', clinicId)
      .eq('tipo', 'fixo')
      .gte('data', inicioDate)
      .lt('data', fimDate);
  let horariosQuery = supabase
      .from('horarios_disponiveis')
      .select('dentista_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim')
      .eq('clinica_id', clinicId)
      .eq('ativo', true);
  if (dentistaId) {
    despesasQuery = despesasQuery.eq('dentista_id', dentistaId);
    horariosQuery = horariosQuery.eq('dentista_id', dentistaId);
  }
  const [{ data: despesasFixas, error: errDesp }, { data: horarios, error: errHor }] = await Promise.all([despesasQuery, horariosQuery]);
  if (errDesp || errHor) {
    throw new Error(`Falha ao calcular custo por hora: ${(errDesp ?? errHor)?.message}`);
  }

  const totalFixas = (despesasFixas ?? []).reduce((s, d) => s + Number(d.valor), 0);

  if (!horarios || horarios.length === 0) {
    return { despesasFixas: totalFixas, horasNoMes: null, custoPorHora: null };
  }

  type HorarioRaw = {
    dentista_id: string;
    dia_semana: number;
    hora_inicio: string;
    hora_fim: string;
    almoco_inicio: string | null;
    almoco_fim: string | null;
  };
  const turnos: TurnoClinico[] = ((horarios ?? []) as unknown as HorarioRaw[]).map((horario) => ({
    dentistaId: horario.dentista_id,
    diaSemana: horario.dia_semana,
    horaInicio: horario.hora_inicio,
    horaFim: horario.hora_fim,
    almocoInicio: horario.almoco_inicio,
    almocoFim: horario.almoco_fim,
  }));
  const horasNoMes = horasLiquidasNoMes(mesISO, turnos);

  const custoPorHora = horasNoMes > 0 ? totalFixas / horasNoMes : null;
  return { despesasFixas: totalFixas, horasNoMes, custoPorHora };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportarFinanceiroCsv(
  mesISO: string,
  dentistaFiltro?: string,
): Promise<{ csv: string; filename: string }> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);
  const { inicioDate, fimDate } = mesWindow(mesISO);

  type Row = { tipo: string; data: string; descricao: string; forma: string; valor: number };

  let despesasQ = supabase.from('despesas').select('valor, data, descricao, categoria, tipo')
    .eq('clinica_id', clinicId).gte('data', inicioDate).lt('data', fimDate);
  let receitasQ = supabase.from('receitas_manuais').select('valor, data, descricao, forma')
    .eq('clinica_id', clinicId).gte('data', inicioDate).lt('data', fimDate);
  // R-114 — regra única (I7): pagamento pago conta, sem condição por status do pai.
  let pagamentosQ = supabase
    .from('pagamentos')
    .select('valor, data_pagamento, forma_pagamento, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId).eq('status', 'pago')
    .gte('data_pagamento', inicioDate).lt('data_pagamento', fimDate);

  if (dentistaId) {
    despesasQ   = despesasQ.eq('dentista_id', dentistaId);
    receitasQ   = receitasQ.eq('dentista_id', dentistaId);
    pagamentosQ = pagamentosQ.eq('dentista_id', dentistaId);
  }

  const [
    { data: despesas, error: errDesp },
    { data: receitas, error: errRec },
    { data: pagamentos, error: errPag },
  ] = await Promise.all([despesasQ, receitasQ, pagamentosQ]);

  if (errDesp || errRec || errPag) {
    throw new Error(`Falha ao exportar CSV: ${(errDesp ?? errRec ?? errPag)?.message}`);
  }

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

export async function listarPagamentosPagos(mesISO: string, dentistaFiltro?: string): Promise<PagamentoPago[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  const { inicioDate, fimDate } = mesWindow(mesISO);

  // R-114 — regra única (I7): pagamento pago conta, sem condição por status do pai.
  let query = supabase
    .from('pagamentos')
    .select('id, clinica_id, orcamento_id, paciente_id, dentista_id, valor, forma_pagamento, data_pagamento, created_at, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId)
    .eq('status', 'pago')
    .gte('data_pagamento', inicioDate)
    .lt('data_pagamento', fimDate)
    .order('data_pagamento', { ascending: false });

  if (dentistaId) {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar pagamentos: ${error.message}`);

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

export async function listarPagamentosPendentes(dentistaFiltro?: string): Promise<PagamentoPendente[]> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaId = await resolverDentistaFiltro(context, dentistaFiltro);

  // R-114 — mesma regra única do resto do arquivo (I7). Uma pendência só existe porque a
  // escrita (registrarPagamento/registrarPagamentoRapido) já exigiu item aprovado antes de
  // criá-la — não há mais status de orçamento pra filtrar aqui.
  let query = supabase
    .from('pagamentos')
    .select('id, orcamento_id, paciente_id, dentista_id, valor, data_vencimento, created_at, paciente:pacientes(nome)')
    .eq('clinica_id', clinicId)
    .eq('status', 'pendente')
    .order('data_vencimento', { ascending: true, nullsFirst: false });

  if (dentistaId) {
    query = query.eq('dentista_id', dentistaId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar pagamentos pendentes: ${error.message}`);

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

// ─── Registrar Recebimento (secretária) ───────────────────────────────────────

export type OrcamentoPendente = {
  id: string;
  cobrancaId: string | null;
  total: number | null;
  descricao_resumo: string;
  valor_pendente: number;
  dentistaId: string | null;
  dentistaNome: string | null;
};

export type BuscarOrcamentosPendentesResult = {
  orcamentos: OrcamentoPendente[];
};

export async function buscarOrcamentosPendentesPorPaciente(
  pacienteId: string,
): Promise<BuscarOrcamentosPendentesResult> {
  const context = await requireClinicContext();
  const { supabase, clinicId } = context;
  const dentistaDoEscopo = await resolverDentistaFiltro(context);

  const paciente = dentistaFinanceiroSchema.safeParse(pacienteId);
  if (!paciente.success) throw new Error('Paciente inválido.');

  let cobrancasQuery = supabase
    .from('orcamento_cobrancas')
    .select('id, orcamento_id, dentista_id, valor_final, situacao, itens:orcamento_cobranca_itens!orcamento_cobranca_itens_cobranca_id_fkey(preco_total_snapshot, item:orcamento_itens!orcamento_cobranca_itens_orcamento_item_id_fkey(descricao))')
    .eq('clinica_id', clinicId)
    .eq('paciente_id', paciente.data)
    .eq('situacao', 'aberta');
  if (dentistaDoEscopo) cobrancasQuery = cobrancasQuery.eq('dentista_id', dentistaDoEscopo);
  const { data: cobrancasRaw, error: cobrancasError } = await cobrancasQuery;
  if (cobrancasError) throw new Error(`Falha ao carregar cobranças: ${cobrancasError.message}`);

  const cobrancas = (cobrancasRaw ?? []) as unknown as Array<{
    id: string; orcamento_id: string; dentista_id: string; valor_final: number;
    itens: { preco_total_snapshot: number; item: { descricao: string | null } | null }[];
  }>;
  let cobrancasComoOrcamentos: OrcamentoPendente[] = [];
  if (cobrancas.length > 0) {
    const { data: pagamentosRaw, error: pagamentosError } = await supabase
      .from('pagamentos')
      .select('cobranca_id, valor, status')
      .eq('clinica_id', clinicId)
      .in('cobranca_id', cobrancas.map((c) => c.id));
    if (pagamentosError) throw new Error(`Falha ao carregar recebimentos: ${pagamentosError.message}`);
    const pagamentos = (pagamentosRaw ?? []) as Array<{ cobranca_id: string | null; valor: number; status: string }>;
    cobrancasComoOrcamentos = cobrançasAtivasComSaldo(
        cobrancas.map((cobranca) => ({
          id: cobranca.id,
          orcamentoId: cobranca.orcamento_id,
          dentistaId: cobranca.dentista_id,
          valorFinal: Number(cobranca.valor_final),
          descricoes: cobranca.itens.map((item) => item.item?.descricao ?? null),
        })),
        pagamentos.map((pagamento) => ({ cobrancaId: pagamento.cobranca_id, valor: Number(pagamento.valor), status: pagamento.status })),
        new Map<string, string>(),
      ).map((cobranca) => ({
        id: cobranca.id,
        cobrancaId: cobranca.cobrancaId,
        total: cobranca.total,
        descricao_resumo: cobranca.descricaoResumo,
        valor_pendente: cobranca.valorPendente,
        dentistaId: cobranca.dentistaId,
        dentistaNome: cobranca.dentistaNome,
      }));
  }
  const orcamentosComCobrancaAberta = new Set(cobrancas.map((cobranca) => cobranca.orcamento_id));

  let orcamentosQuery = supabase
    .from('orcamentos')
    .select('id, total, valor_acordado, dentista_id, itens:orcamento_itens(descricao, preco_total, aprovado), pagamentos(id, valor, status)')
    .eq('clinica_id', clinicId)
    .eq('paciente_id', paciente.data);
  if (dentistaDoEscopo) orcamentosQuery = orcamentosQuery.eq('dentista_id', dentistaDoEscopo);
  const { data: orcamentosRaw, error: orcamentosError } = await orcamentosQuery;
  if (orcamentosError) throw new Error(`Falha ao carregar orçamentos: ${orcamentosError.message}`);

  const orcamentos: OrcamentoPendente[] = ((orcamentosRaw ?? []) as unknown as Array<{
    id: string;
    total: number | null;
    valor_acordado: number | null;
    dentista_id: string;
    itens: { descricao: string | null; preco_total: number | null; aprovado: boolean }[];
    pagamentos: { valor: number; status: string }[];
  }>)
    .map((o) => {
      const estado = deriveEstadoOrcamento({
        valorAcordado: o.valor_acordado,
        itens: o.itens.map((item) => ({ precoTotal: item.preco_total, aprovado: item.aprovado })),
        pagamentos: o.pagamentos.map((pagamento) => ({ valor: Number(pagamento.valor), status: pagamento.status })),
      });
      const valorPendente = Math.max(0, estado.valorDevido - estado.valorPago);
      const descricao =
        o.itens
          .map((i) => i.descricao)
          .filter(Boolean)
          .slice(0, 2)
          .join(', ') || 'Orçamento aprovado';
      return { id: o.id, cobrancaId: null, total: estado.valorDevido, descricao_resumo: descricao, valor_pendente: valorPendente, dentistaId: o.dentista_id, dentistaNome: null, estado: estado.estado };
    })
    .filter((o) => !orcamentosComCobrancaAberta.has(o.id) && o.estado === 'aceito' && o.valor_pendente > 0)
    .map((orcamento) => ({
      id: orcamento.id,
      cobrancaId: orcamento.cobrancaId,
      total: orcamento.total,
      descricao_resumo: orcamento.descricao_resumo,
      valor_pendente: orcamento.valor_pendente,
      dentistaId: orcamento.dentistaId,
      dentistaNome: orcamento.dentistaNome,
    }));
  const { data: dentistasRaw, error: dentistasError } = await supabase
    .from('dentistas')
    .select('id, nome')
    .eq('clinica_id', clinicId)
    .in('id', [...new Set([...cobrancasComoOrcamentos, ...orcamentos].map((orcamento) => orcamento.dentistaId).filter((id): id is string => id !== null))]);
  if (dentistasError) throw new Error(`Falha ao carregar responsáveis: ${dentistasError.message}`);
  const nomes = new Map((dentistasRaw ?? []).map((dentista) => [dentista.id, dentista.nome]));
  return { orcamentos: [...cobrancasComoOrcamentos, ...orcamentos].map((orcamento) => ({ ...orcamento, dentistaNome: orcamento.dentistaId ? nomes.get(orcamento.dentistaId) ?? null : null })) };
}

export type FormaRecebimento = 'pix' | 'dinheiro' | 'transferencia' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'outro';

export async function registrarRecebimento(dados: {
  pacienteId: string;
  orcamentoId: string;
  valor: number;
  formaPagamento: FormaRecebimento;
  data: string;
  dentistaId?: string;
}): Promise<{ error?: string; autoAprovado?: boolean }> {
  // Transferência é uma forma apresentada só no Financeiro legado; `pagamentos` não possui
  // esse valor no CHECK, então preservamos a escrita como "outro" em vez de inseri-la sem
  // validação. Todas as demais regras (saldo, tenant e auditoria) são a mesma transação do
  // orçamento, nunca um INSERT paralelo.
  const formaPagamento: FormaPagamento = dados.formaPagamento === 'transferencia'
    ? 'outro'
    : dados.formaPagamento;
  const result = await registrarPagamento({
    orcamentoId: dados.orcamentoId,
    pacienteId: dados.pacienteId,
    valor: dados.valor,
    formaPagamento,
    data: dados.data,
    dentistaId: dados.dentistaId,
  });
  if (!result.error) revalidatePath('/dashboard/meu-consultorio/financeiro');
  return result;
}
