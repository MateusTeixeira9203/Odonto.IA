import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface PatientContext {
  id: string;
  nome: string;
  idadeStr: string;
  observacoes: string | null;
  fichasRecentes: {
    data: string;
    queixa: string | null;
    anotacoes: string | null;
    alergias: string | null;
    medicamentos: string | null;
    historicoDental: string | null;
  }[];
  orcamentosAbertos: {
    descricao: string;
    total: number;
    status: string;
    diasAtualizacao: number;
  }[];
  planejamentoAtivo: {
    titulo: string;
    etapas: { titulo: string; dente: string | null; status: string }[];
  } | null;
}

export interface ConsultationContext {
  agendamentoId: string;
  hora: string;
  observacoesAgendamento: string | null;
  paciente: PatientContext;
}

export interface ClinicOperationalContext {
  dataHoje: string;
  totalPacientes: number;
  agendaHoje: { hora: string; nome: string; status: string }[];
  orcamentosPendentes: { nome: string; total: number; status: string }[];
  followUpUrgente: { nome: string; diasSemRetorno: number; total: number }[];
  aprovadosSemAgendamento: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcIdade(dataNascimento: string | null): string {
  if (!dataNascimento) return 'idade não informada';
  return `${new Date().getFullYear() - new Date(dataNascimento).getFullYear()} anos`;
}

type EtapaRaw = { titulo: string; dente: string | null; status: string; ordem: number };
type PlanejamentoRaw = { titulo: string; planejamento_etapas: EtapaRaw[] };

// ─── Builder 1: Patient context ───────────────────────────────────────────────

export async function buildPatientContext(
  patientId: string,
  clinicId: string,
  supabase: SupabaseClient,
): Promise<PatientContext | null> {
  const now = new Date();

  const [pacienteRes, fichasRes, orcamentosRes, planejamentoRes] = await Promise.all([
    supabase
      .from('pacientes')
      .select('id, nome, data_nascimento, observacoes')
      .eq('id', patientId)
      .eq('clinica_id', clinicId)
      .maybeSingle(),

    supabase
      .from('fichas')
      .select('created_at, queixa_principal, anotacoes, alergias, medicamentos_em_uso, historico_dental')
      .eq('paciente_id', patientId)
      .eq('clinica_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('orcamentos')
      .select('total, status, updated_at, orcamento_itens(descricao)')
      .eq('paciente_id', patientId)
      .eq('clinica_id', clinicId)
      .in('status', ['rascunho', 'enviado', 'aprovado'])
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('planejamentos')
      .select('titulo, planejamento_etapas(titulo, dente, status, ordem)')
      .eq('paciente_id', patientId)
      .eq('clinica_id', clinicId)
      .in('status', ['rascunho', 'apresentado', 'aprovado'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!pacienteRes.data) return null;

  const p = pacienteRes.data as {
    id: string;
    nome: string;
    data_nascimento: string | null;
    observacoes: string | null;
  };

  const fichasRecentes = (fichasRes.data ?? []).map((f) => ({
    data: new Date(f.created_at as string).toLocaleDateString('pt-BR'),
    queixa: (f.queixa_principal as string | null) ?? null,
    anotacoes: (f.anotacoes as string | null) ?? null,
    alergias: (f.alergias as string | null) ?? null,
    medicamentos: (f.medicamentos_em_uso as string | null) ?? null,
    historicoDental: (f.historico_dental as string | null) ?? null,
  }));

  const orcamentosAbertos = (orcamentosRes.data ?? []).map((o) => {
    const itens = (o.orcamento_itens as { descricao: string }[] | null) ?? [];
    return {
      descricao: itens.map((i) => i.descricao).filter(Boolean).join(', ') || 'sem descrição',
      total: (o.total as number) ?? 0,
      status: o.status as string,
      diasAtualizacao: Math.floor((now.getTime() - new Date(o.updated_at as string).getTime()) / 86400000),
    };
  });

  let planejamentoAtivo: PatientContext['planejamentoAtivo'] = null;
  if (planejamentoRes.data) {
    const raw = planejamentoRes.data as unknown as PlanejamentoRaw;
    planejamentoAtivo = {
      titulo: raw.titulo,
      etapas: (raw.planejamento_etapas ?? [])
        .sort((a, b) => a.ordem - b.ordem)
        .map((e) => ({ titulo: e.titulo, dente: e.dente, status: e.status })),
    };
  }

  return {
    id: p.id,
    nome: p.nome,
    idadeStr: calcIdade(p.data_nascimento),
    observacoes: p.observacoes,
    fichasRecentes,
    orcamentosAbertos,
    planejamentoAtivo,
  };
}

// ─── Builder 2: Consultation context (for briefing) ───────────────────────────

export async function buildConsultationContext(
  agendamentoId: string,
  clinicId: string,
  supabase: SupabaseClient,
): Promise<ConsultationContext | null> {
  const { data: ag } = await supabase
    .from('agendamentos')
    .select('data_hora, observacoes, paciente:pacientes(id, nome, data_nascimento, observacoes)')
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!ag) return null;

  const rawPaciente = ag.paciente as unknown as {
    id: string;
    nome: string;
    data_nascimento: string | null;
    observacoes: string | null;
  } | null;

  if (!rawPaciente) return null;

  const hora = new Date(ag.data_hora as string).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const paciente = await buildPatientContext(rawPaciente.id, clinicId, supabase);
  if (!paciente) return null;

  return {
    agendamentoId,
    hora,
    observacoesAgendamento: (ag.observacoes as string | null) ?? null,
    paciente,
  };
}

// ─── Builder 3: Clinic operational context (for DEX chat) ─────────────────────

export async function buildClinicOperationalContext(
  clinicId: string,
  supabase: SupabaseClient,
): Promise<ClinicOperationalContext> {
  const agora = new Date();
  const hojeInicio = new Date(agora); hojeInicio.setHours(0, 0, 0, 0);
  const hojeFim    = new Date(agora); hojeFim.setHours(23, 59, 59, 999);
  const tresDiasAtras = new Date(agora); tresDiasAtras.setDate(agora.getDate() - 3);

  const [agendamentosRes, orcamentosRes, pacientesRes, followUpRes, aprovadosRes, futuroAgendsRes] =
    await Promise.all([
      supabase
        .from('agendamentos')
        .select('data_hora, status, paciente:pacientes(nome)')
        .eq('clinica_id', clinicId)
        .gte('data_hora', hojeInicio.toISOString())
        .lte('data_hora', hojeFim.toISOString())
        .not('status', 'eq', 'cancelled')
        .order('data_hora', { ascending: true })
        .limit(20),

      supabase
        .from('orcamentos')
        .select('status, total, paciente:pacientes(nome), created_at')
        .eq('clinica_id', clinicId)
        .in('status', ['rascunho', 'enviado'])
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', clinicId),

      supabase
        .from('orcamentos')
        .select('paciente_id, total, updated_at, paciente:pacientes(nome)')
        .eq('clinica_id', clinicId)
        .eq('status', 'enviado')
        .lte('updated_at', tresDiasAtras.toISOString())
        .order('updated_at', { ascending: true })
        .limit(8),

      supabase
        .from('orcamentos')
        .select('paciente_id, paciente:pacientes(nome)')
        .eq('clinica_id', clinicId)
        .eq('status', 'aprovado')
        .limit(50),

      supabase
        .from('agendamentos')
        .select('paciente_id')
        .eq('clinica_id', clinicId)
        .gte('data_hora', agora.toISOString())
        .not('status', 'eq', 'cancelled'),
    ]);

  const agendaHoje = (agendamentosRes.data ?? []).map((ag) => ({
    hora: new Date(ag.data_hora as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    nome: (ag.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
    status: ag.status as string,
  }));

  const orcamentosPendentes = (orcamentosRes.data ?? []).map((o) => ({
    nome: (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
    total: (o.total as number) ?? 0,
    status: o.status as string,
  }));

  const followUpUrgente = (followUpRes.data ?? []).map((o) => ({
    nome: (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente',
    diasSemRetorno: Math.floor((agora.getTime() - new Date(o.updated_at as string).getTime()) / 86400000),
    total: (o.total as number) ?? 0,
  }));

  const futuroIds = new Set((futuroAgendsRes.data ?? []).map((a) => a.paciente_id as string));
  const aprovadosSemAgendamento = (aprovadosRes.data ?? [])
    .filter((o) => !futuroIds.has(o.paciente_id as string))
    .map((o) => (o.paciente as unknown as { nome: string } | null)?.nome ?? 'Paciente')
    .filter((nome, i, arr) => arr.indexOf(nome) === i)
    .slice(0, 6);

  return {
    dataHoje: agora.toLocaleDateString('pt-BR'),
    totalPacientes: pacientesRes.count ?? 0,
    agendaHoje,
    orcamentosPendentes,
    followUpUrgente,
    aprovadosSemAgendamento,
  };
}
