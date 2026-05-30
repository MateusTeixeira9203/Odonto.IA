import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { buildConsultationContext, type ConsultationContext } from '@/lib/ai/context';

export type DexConsultationContext = ConsultationContext;

/**
 * GET /api/dex/consultation-context?agendamentoId=xxx
 * Retorna contexto clínico completo da consulta ativa para o DEX.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const agendamentoId = req.nextUrl.searchParams.get('agendamentoId');
  if (!agendamentoId) return NextResponse.json({ error: 'agendamentoId obrigatório' }, { status: 400 });

  const supabase = await createClient();
  const ctx = await buildConsultationContext(agendamentoId, dentista.clinica_id, supabase);

  if (!ctx) return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 });

  return NextResponse.json(ctx satisfies DexConsultationContext);
}
