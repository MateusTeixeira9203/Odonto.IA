'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { inserirNotificacao } from '@/lib/notificacoes';

export async function salvarFichaConsulta(params: {
  agendamentoId:      string;
  pacienteId:         string;
  queixa_principal:   string;
  anotacoes:          string;
  dentes_afetados:    number[];
  dentes_observacoes: Record<string, string>;
  // Novos campos opcionais:
  procedimentos?:     string[];
  conduta?:           string;
  retorno_sugerido?:  string | null;
  alerta_novo?:       string | null;
}): Promise<{ fichaId?: string; error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect('/onboarding');

  const { data: fichaData, error: fichaError } = await supabase.from('fichas').insert({
    clinica_id:          clinicId,
    paciente_id:         params.pacienteId,
    dentista_id:         dentistaPerfil.id,
    queixa_principal:    params.queixa_principal,
    anotacoes:           params.anotacoes,
    dentes_afetados:     params.dentes_afetados,
    dentes_observacoes:  params.dentes_observacoes,
    // Novos campos:
    ...(params.procedimentos !== undefined && { procedimentos: params.procedimentos }),
    ...(params.conduta !== undefined && { conduta: params.conduta }),
    ...(params.retorno_sugerido !== undefined && { retorno_sugerido: params.retorno_sugerido }),
    ...(params.alerta_novo != null && { alerta_novo: params.alerta_novo }),
    status:              'concluida',
    origem:              'modo_consulta',
  }).select('id').single();

  if (fichaError) {
    console.error('[salvarFichaConsulta]', fichaError.message);
    return { error: 'Erro ao salvar a ficha. Tente novamente.' };
  }

  await supabase
    .from('agendamentos')
    .update({ status: 'completed' })
    .eq('id', params.agendamentoId)
    .eq('clinica_id', clinicId);

  // Busca nome do paciente para a notificação
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('nome')
    .eq('id', params.pacienteId)
    .maybeSingle<{ nome: string }>();

  // Notifica a secretaria que a consulta foi finalizada
  await inserirNotificacao(supabase, {
    clinicaId:     clinicId,
    paraRole:      'secretaria',
    deDentistaId:  dentistaPerfil.id,
    tipo:          'consulta_finalizada',
    titulo:        `Consulta finalizada — ${paciente?.nome ?? 'Paciente'}`,
    mensagem:      'A consulta foi encerrada pelo dentista.',
    href:          '/dashboard/agendamentos',
  });

  return { fichaId: (fichaData as { id: string }).id };
}

export async function salvarAssinaturaConsulta(
  fichaId: string,
  pacienteId: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão' };

  const db = createServiceClient();

  const { data: ficha } = await db
    .from('fichas')
    .select('id')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .maybeSingle();

  if (!ficha) return { ok: false, error: 'Ficha não encontrada' };

  const base64 = assinaturaDataUrl.split(',')[1];
  if (!base64) return { ok: false, error: 'Assinatura inválida' };
  const buffer = Buffer.from(base64, 'base64');

  const storagePath = `${clinicId}/${pacienteId}/assinatura_${fichaId}.png`;

  const { error: storageErr } = await db.storage
    .from('fichas')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

  if (storageErr) return { ok: false, error: storageErr.message };

  const { error: dbErr } = await db
    .from('fichas')
    .update({ assinatura_url: storagePath, assinado_em: new Date().toISOString() })
    .eq('id', fichaId)
    .eq('clinica_id', clinicId);

  if (dbErr) return { ok: false, error: dbErr.message };

  return { ok: true };
}

export async function iniciarAtendimentoConsulta(agendamentoId: string): Promise<{ error?: string }> {
  const { supabase, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('status')
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId)
    .maybeSingle<{ status: string }>();

  if (!ag) return { error: 'Agendamento não encontrado.' };
  if (['completed', 'cancelled', 'no_show'].includes(ag.status)) return { error: 'Atendimento já encerrado.' };
  if (ag.status === 'in_progress') return {};

  const { error } = await supabase
    .from('agendamentos')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/agendamentos');
  return {};
}

// finalizarConsulta foi removida — fluxo de finalização usa salvarFichaConsulta diretamente.
