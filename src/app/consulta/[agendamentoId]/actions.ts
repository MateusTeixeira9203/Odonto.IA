'use server';

import { requireClinicContext } from '@/server/auth/clinic';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { inserirNotificacao } from '@/lib/notificacoes';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

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
  alerta_novo?:       string | null;
  /** v3 — eventos de odontograma revisados pelo dentista na confirmação (Fatia A). */
  odontograma_eventos?: OdontogramaEventoDraft[];
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
    ...(params.alerta_novo != null && { alerta_novo: params.alerta_novo }),
    status:              'concluida',
    origem:              'modo_consulta',
  }).select('id').single();

  if (fichaError) {
    console.error('[salvarFichaConsulta]', fichaError.message);
    return { error: 'Erro ao salvar a ficha. Tente novamente.' };
  }

  const fichaId = (fichaData as { id: string }).id;

  // v3 — event-log do odontograma (migration 101). Fail-soft deliberado (espírito D5):
  // a ficha v2 JÁ está salva; se a camada visual falhar, loga e segue — o dado clínico
  // textual não se perde e o odontograma degrada pra "sem registro".
  const eventos = params.odontograma_eventos ?? [];
  if (eventos.length > 0) {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const rows = eventos.map((ev) => ({
      clinica_id:     clinicId,
      paciente_id:    params.pacienteId,
      dentista_id:    dentistaPerfil.id,
      ficha_id:       fichaId,
      grupo_id:       ev.grupo_id,
      tipo:           ev.tipo,
      status:         ev.status,
      origem:         ev.origem,
      nivel:          ev.ancora.nivel,
      arcada:         ev.ancora.arcada ?? null,
      quadrante:      ev.ancora.quadrante ?? null,
      dente:          ev.ancora.dente ?? null,
      faces:          ev.ancora.faces ?? [],
      papel_no_grupo: ev.papel_no_grupo,
      observacao:     ev.observacao || null,
      // Data clínica: obrigatória no realizado da clínica (default hoje BRT — rede de
      // segurança; a UI já manda explícita). Indicado nunca tem data (constraint SQL).
      realizado_em:
        ev.status === 'realizado'
          ? (ev.realizado_em ?? (ev.origem === 'clinica' ? hoje : null))
          : null,
    }));
    const { error: eventosError } = await supabase.from('odontograma_eventos').insert(rows);
    if (eventosError) {
      console.error('[salvarFichaConsulta] odontograma_eventos:', eventosError.message);
    }
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

  return { fichaId };
}

export async function salvarAssinaturaConsulta(
  fichaId: string,
  pacienteId: string,
  assinaturaDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, dentistaId, role } = await requireClinicContext();
  if (role === 'secretaria') return { ok: false, error: 'Sem permissão' };

  const db = createServiceClient();

  // dono: só o dentista que criou a ficha pode assiná-la
  const { data: ficha } = await db
    .from('fichas')
    .select('id')
    .eq('id', fichaId)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .eq('dentista_id', dentistaId)
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
    .eq('clinica_id', clinicId)
    .eq('dentista_id', dentistaId);

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
