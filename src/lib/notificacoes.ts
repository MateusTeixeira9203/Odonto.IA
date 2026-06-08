import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoNotificacao =
  // Operacional — secretaria
  | 'orcamento_enviado'
  | 'follow_up'
  | 'briefing'
  | 'sistema'
  | 'consulta_finalizada'
  | 'agendamento_criado'
  // Operacional — dentista
  | 'checkin_paciente'
  | 'agendamento_cancelado'
  | 'pagamento_confirmado'
  // Cross-clínica
  | 'convite_clinica';

export interface NotificacaoPayload {
  clinicaId: string;
  /** Role que deve receber: 'secretaria' | 'dentista' | 'admin' | 'all' */
  paraRole: string;
  /** Quando preenchido, a notificação é direcionada a um dentista específico */
  paraDentistaId?: string;
  deDentistaId?: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  href?: string;
}

/**
 * Insere uma notificação interna entre membros da clínica.
 * Best-effort: erros são logados mas não propagados.
 */
export async function inserirNotificacao(
  supabase: SupabaseClient,
  payload: NotificacaoPayload,
): Promise<void> {
  try {
    const { error } = await supabase.from('notificacoes').insert({
      clinica_id:       payload.clinicaId,
      para_role:        payload.paraRole,
      para_dentista_id: payload.paraDentistaId ?? null,
      de_dentista_id:   payload.deDentistaId ?? null,
      tipo:             payload.tipo,
      titulo:           payload.titulo,
      mensagem:         payload.mensagem,
      href:             payload.href ?? null,
    });
    if (error) console.error('[notificacoes] Erro ao inserir:', error.message);
  } catch (err) {
    console.error('[notificacoes] Exceção:', err);
  }
}
