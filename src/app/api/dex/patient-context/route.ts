import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';

export interface DexPatientContext {
  nome: string;
  idade: string;
  alergias: string | null;
  observacoes: string | null;
  fichasRecentes: { data: string; queixa: string; anotacoes: string }[];
  orcamentosAbertos: { descricao: string; total: number; status: string }[];
}

/**
 * GET /api/dex/patient-context?patientId=xxx
 * Retorna resumo clínico do paciente para o DEX exibir quando aberto no perfil.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ error: 'patientId obrigatório' }, { status: 400 });

  const supabase = await createClient();

  const [pacienteRes, fichasRes, orcRes] = await Promise.all([
    supabase
      .from('pacientes')
      .select('nome, data_nascimento, alergias, observacoes')
      .eq('id', patientId)
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),

    supabase
      .from('fichas')
      .select('created_at, queixa_principal, anotacoes')
      .eq('paciente_id', patientId)
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false })
      .limit(3),

    supabase
      .from('orcamentos')
      .select('total, status, orcamento_itens(descricao)')
      .eq('paciente_id', patientId)
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['rascunho', 'enviado', 'aprovado'])
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  if (!pacienteRes.data) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });

  const p = pacienteRes.data as {
    nome: string;
    data_nascimento: string | null;
    alergias: string | null;
    observacoes: string | null;
  };

  const idade = p.data_nascimento
    ? `${new Date().getFullYear() - new Date(p.data_nascimento).getFullYear()} anos`
    : 'idade não informada';

  const fichasRecentes = (fichasRes.data ?? []).map((f) => ({
    data: new Date(f.created_at as string).toLocaleDateString('pt-BR'),
    queixa: (f.queixa_principal as string | null) ?? 'sem queixa registrada',
    anotacoes: (f.anotacoes as string | null) ?? 'sem anotações',
  }));

  const orcamentosAbertos = (orcRes.data ?? []).map((o) => {
    const itens = (o.orcamento_itens as { descricao: string }[] | null) ?? [];
    return {
      descricao: itens.map((i) => i.descricao).filter(Boolean).join(', ') || 'sem descrição',
      total: (o.total as number) ?? 0,
      status: o.status as string,
    };
  });

  return NextResponse.json({
    nome: p.nome,
    idade,
    alergias: p.alergias,
    observacoes: p.observacoes,
    fichasRecentes,
    orcamentosAbertos,
  } satisfies DexPatientContext);
}
