import { NextRequest, NextResponse } from 'next/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/rate-limit';

export interface DexAlert {
  id: string;
  type: 'warning' | 'info' | 'danger';
  title: string;
  description: string;
  href?: string;
  isNotif?: boolean;
}

/**
 * GET /api/dex/alerts
 * Retorna alertas operacionais calculados + notificações não lidas do BD.
 *
 * PATCH /api/dex/alerts
 * Marca uma notificação do BD como lida (body: { id: string }).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limited = await withRateLimit(req, 'dex:alerts', 60, 60_000);
  if (limited) return limited;

  try {
    const dentista = await getDentistaCached();
    if (!dentista) return NextResponse.json({ alerts: [] });

    const supabase = await createClient();
    const agora = new Date();
    const hojeInicio = new Date(agora);
    hojeInicio.setHours(0, 0, 0, 0);
    const hojeFim = new Date(agora);
    hojeFim.setHours(23, 59, 59, 999);
    const tresDiasAtras = new Date(agora);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    const [
      agendamentosNaoConfirmados,
      orcamentosRascunho,
      orcamentosAtrasados,
      notificacoesDB,
    ] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'scheduled')
        .gte('data_hora', hojeInicio.toISOString())
        .lte('data_hora', hojeFim.toISOString()),

      supabase
        .from('orcamentos')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'rascunho'),

      // Inteligência comercial: orçamentos enviados >3 dias com nome do paciente
      supabase
        .from('orcamentos')
        .select('id, total, paciente:pacientes(nome)')
        .eq('clinica_id', dentista.clinica_id)
        .eq('status', 'enviado')
        .lte('updated_at', tresDiasAtras.toISOString())
        .order('updated_at', { ascending: true })
        .limit(5),

      // Notificações não lidas: role correto E (sem dentista alvo OU para este dentista)
      supabase
        .from('notificacoes')
        .select('id, tipo, titulo, mensagem, href')
        .eq('clinica_id', dentista.clinica_id)
        .or(`para_role.eq.${dentista.role},para_role.eq.all`)
        .or(`para_dentista_id.is.null,para_dentista_id.eq.${dentista.id}`)
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const alerts: DexAlert[] = [];

    // ── Notificações do BD (aparecem primeiro) ──────────────────────────────
    for (const n of notificacoesDB.data ?? []) {
      const typeMap: Record<string, DexAlert['type']> = {
        orcamento_gerado: 'info',
        orcamento_enviado: 'info',
        follow_up: 'warning',
        briefing: 'info',
        sistema: 'warning',
      };
      alerts.push({
        id:          `notif_${n.id}`,
        type:        typeMap[n.tipo as string] ?? 'info',
        title:       n.titulo as string,
        description: n.mensagem as string,
        href:        (n.href as string | null) ?? undefined,
        isNotif:     true,
      });
    }

    // ── Alertas computados ──────────────────────────────────────────────────

    // Perfil incompleto — CRO ausente para dentistas e admins
    if (dentista.role !== 'secretaria' && !dentista.cro) {
      alerts.push({
        id:          'computed_perfil_incompleto',
        type:        'warning',
        title:       'Complete seu perfil',
        description: 'Seu CRO não está cadastrado. Ele aparece em documentos e orçamentos enviados aos pacientes.',
        href:        dentista.role === 'admin' ? '/dashboard/configuracoes?aba=perfil' : '/dashboard/perfil',
      });
    }

    const naoConfirmados = agendamentosNaoConfirmados.count ?? 0;
    if (naoConfirmados > 0) {
      alerts.push({
        id:          'computed_agendamentos',
        type:        'warning',
        title:       `${naoConfirmados} consulta${naoConfirmados > 1 ? 's' : ''} sem confirmação`,
        description: naoConfirmados === 1
          ? 'Um paciente agendado hoje ainda não confirmou presença.'
          : `${naoConfirmados} pacientes agendados hoje ainda não confirmaram.`,
        href:        '/dashboard/agendamentos',
      });
    }

    const rascunhos = orcamentosRascunho.count ?? 0;
    if (rascunhos > 0) {
      alerts.push({
        id:          'computed_rascunhos',
        type:        'info',
        title:       `${rascunhos} orçamento${rascunhos > 1 ? 's' : ''} em rascunho`,
        description: `${rascunhos > 1 ? 'Orçamentos criados' : 'Orçamento criado'} mas ainda não enviado${rascunhos > 1 ? 's' : ''} ao paciente.`,
        href:        '/dashboard/orcamentos',
      });
    }

    // ── Inteligência Comercial (com nomes) ──────────────────────────────────
    const atrasados = orcamentosAtrasados.data ?? [];
    if (atrasados.length > 0) {
      const nomes = atrasados
        .map(o => (o.paciente as unknown as { nome: string } | null)?.nome)
        .filter(Boolean)
        .join(', ');
      const total = atrasados.reduce((s, o) => s + ((o.total as number) ?? 0), 0);
      alerts.push({
        id:          'computed_followup',
        type:        'danger',
        title:       `Follow-up: ${atrasados.length} orçamento${atrasados.length > 1 ? 's' : ''} sem retorno`,
        description: `${nomes} — ${atrasados.length > 1 ? 'Orçamentos enviados' : 'Orçamento enviado'} há +3 dias. Total em aberto: R$ ${total.toFixed(2).replace('.', ',')}.`,
        href:        '/dashboard/orcamentos',
      });
    }

    return NextResponse.json({ alerts });
  } catch (err) {
    console.error('[dex/alerts] Erro:', err);
    return NextResponse.json({ alerts: [] });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const dentista = await getDentistaCached();
    if (!dentista) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = (await req.json()) as { id?: string };
    if (!body.id?.startsWith('notif_')) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const notifId = body.id.replace('notif_', '');
    const supabase = await createClient();

    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', notifId)
      .eq('clinica_id', dentista.clinica_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[dex/alerts PATCH] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
