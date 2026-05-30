'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function salvarFichaConsulta(params: {
  agendamentoId: string;
  pacienteId: string;
  queixa_principal: string;
  anotacoes: string;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
}): Promise<{ error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();

  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) redirect('/onboarding');

  const { error: fichaError } = await supabase.from('fichas').insert({
    clinica_id:          clinicId,
    paciente_id:         params.pacienteId,
    dentista_id:         dentistaPerfil.id,
    queixa_principal:    params.queixa_principal,
    anotacoes:           params.anotacoes,
    dentes_afetados:     params.dentes_afetados,
    dentes_observacoes:  params.dentes_observacoes,
    status:              'concluida',
  });

  if (fichaError) {
    console.error('[salvarFichaConsulta]', fichaError.message);
    return { error: 'Erro ao salvar a ficha. Tente novamente.' };
  }

  await supabase
    .from('agendamentos')
    .update({ status: 'completed' })
    .eq('id', params.agendamentoId)
    .eq('clinica_id', clinicId);

  return {};
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

export async function finalizarConsulta(params: {
  agendamentoId: string;
  pacienteId: string;
  queixa_principal: string;
  anotacoes: string;
  dentes_afetados: number[];
  dentes_observacoes: Record<string, string>;
  resumo: string;
  conduta: string;
  proximosPassos: string;
  followUpData: string;
}): Promise<{ error?: string }> {
  const { supabase, user, clinicId, role } = await requireClinicContext();
  if (role === 'secretaria') return { error: 'Sem permissão.' };

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (!dentistaPerfil) return { error: 'Perfil não encontrado.' };

  const anotacoesCompletas = [
    params.anotacoes,
    params.resumo       ? `\n\n📋 Resumo: ${params.resumo}` : '',
    params.conduta      ? `\n💊 Conduta: ${params.conduta}` : '',
    params.proximosPassos ? `\n➡️ Próximos passos: ${params.proximosPassos}` : '',
    params.followUpData ? `\n📅 Retorno: ${params.followUpData}` : '',
  ].filter(Boolean).join('');

  const { error: fichaError } = await supabase.from('fichas').insert({
    clinica_id:         clinicId,
    paciente_id:        params.pacienteId,
    dentista_id:        dentistaPerfil.id,
    queixa_principal:   params.queixa_principal,
    anotacoes:          anotacoesCompletas,
    dentes_afetados:    params.dentes_afetados,
    dentes_observacoes: params.dentes_observacoes,
    status:             'concluida',
  });

  if (fichaError) return { error: fichaError.message };

  await supabase
    .from('agendamentos')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', params.agendamentoId)
    .eq('clinica_id', clinicId);

  revalidatePath('/dashboard/agendamentos');
  return {};
}
