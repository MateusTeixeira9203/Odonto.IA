import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoNotificacao =
  | 'orcamento_gerado'
  | 'orcamento_enviado'
  | 'follow_up'
  | 'briefing'
  | 'sistema';

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
