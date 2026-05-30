import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { buildPatientContext, type PatientContext } from '@/lib/ai/context';

// Re-export so dex-widget.tsx can import DexPatientContext from this route
export type DexPatientContext = PatientContext;

/**
 * GET /api/dex/patient-context?patientId=xxx
 * Retorna resumo clínico completo do paciente para o DEX exibir quando aberto no perfil.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const dentista = await getDentistaCached();
  if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const patientId = req.nextUrl.searchParams.get('patientId');
  if (!patientId) return NextResponse.json({ error: 'patientId obrigatório' }, { status: 400 });

  const supabase = await createClient();
  const ctx = await buildPatientContext(patientId, dentista.clinica_id, supabase);

  if (!ctx) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });

  return NextResponse.json(ctx satisfies DexPatientContext);
}
