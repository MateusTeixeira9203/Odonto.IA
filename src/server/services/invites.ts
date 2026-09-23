import { createServiceClient } from '@/lib/supabase/service';
import { inserirNotificacao } from '@/lib/notificacoes';
import { getResend } from '@/lib/email/resend';
import { conviteEmailHtml, conviteEmailText } from '@/lib/email/templates/convite';
import { clinicaIsentaDeCobranca } from '@/lib/billing/exemptions';

export type CriarConviteInput = { email: string };

export type CriarConviteResult =
  | { ok: true; inviteId: string; token: string; link: string; emailEnviado: boolean }
  | { ok: false; error: string };

export type AceitarConviteResult =
  | { ok: true; clinicId: string; role: string; exigeCheckout: boolean }
  | { ok: false; error: string };

export async function criarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  input: CriarConviteInput,
): Promise<CriarConviteResult> {
  if (ctx.role !== 'admin' && ctx.role !== 'dentista') {
    return { ok: false, error: 'Apenas dentistas da clínica podem convidar dentistas.' };
  }

  // Normaliza o e-mail — evita tratar usuário existente como "sem conta" por
  // diferença de maiúsculas/espaços. O aceite compara case-insensitive.
  const email = input.email.trim().toLowerCase();
  const db = createServiceClient();

  if (process.env.STRIPE_BILLING_ENABLED === 'true' && !clinicaIsentaDeCobranca(ctx.clinicId)) {
    const [{ data: clinicaPlano }, { data: formacao }] = await Promise.all([
      db.from('clinicas').select('plano').eq('id', ctx.clinicId)
        .maybeSingle<{ plano: string }>(),
      db.from('formacoes_clinica').select('id').eq('clinica_id', ctx.clinicId)
        .in('status', ['aguardando_equipe', 'coletando_pagamento', 'ativando'])
        .gt('expires_at', new Date().toISOString()).maybeSingle<{ id: string }>(),
    ]);
    if (clinicaPlano?.plano !== 'CLINICA' && !formacao) {
      return { ok: false, error: 'Inicie a formação da Clínica antes de enviar convites.' };
    }
  }

  // Convite pendente ativo?
  const { data: existing } = await db
    .from('convites')
    .select('id')
    .eq('clinica_id', ctx.clinicId)
    .eq('email', email)
    .eq('status', 'pendente')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return { ok: false, error: 'Já existe um convite pendente para este email.' };
  }

  // Limite de dentistas
  const [{ data: clinica }, { count: linkedDentistas }, { count: pendingInvites }] = await Promise.all([
    db.from('clinicas').select('limite_dentistas').eq('id', ctx.clinicId).single(),
    db
      .from('clinica_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', ctx.clinicId)
      .in('role', ['admin', 'dentista'])
      .in('status', ['ativo', 'pendente', 'suspenso']),
    db.from('convites').select('id', { count: 'exact', head: true })
      .eq('clinica_id', ctx.clinicId).eq('role', 'dentista').eq('status', 'pendente')
      .gt('expires_at', new Date().toISOString()),
  ]);

  const limite = (clinica as { limite_dentistas: number } | null)?.limite_dentistas ?? 5;
  if ((linkedDentistas ?? 0) + (pendingInvites ?? 0) >= limite) {
    return { ok: false, error: `Limite de ${limite} dentistas atingido.` };
  }

  // Verificar se email já pertence a membro ativo desta clínica
  const { data: userRow } = await db
    .from('users')
    .select('id, active_clinica_id')
    .eq('email', email)
    .maybeSingle<{ id: string; active_clinica_id: string | null }>();

  if (userRow) {
    const { data: activeMembership } = await db
      .from('clinica_usuarios')
      .select('id')
      .eq('usuario_id', userRow.id)
      .eq('clinica_id', ctx.clinicId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (activeMembership) {
      return { ok: false, error: 'Este usuário já é membro desta clínica.' };
    }
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: convite, error } = await db
    .from('convites')
    .insert({
      clinica_id: ctx.clinicId,
      email,
      role: 'dentista',
      token,
      status: 'pendente',
      expires_at: expiresAt,
      invited_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !convite) {
    return { ok: false, error: 'Erro ao criar convite.' };
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const inviteLink = `${base}/convite/${token}`;

  // Envio de e-mail — falha não bloqueia a criação do convite, mas o status é
  // propagado para a UI mostrar o link copiável como plano B.
  let emailEnviado = false;
  try {
    const { data: clinicaForEmail } = await db
      .from('clinicas')
      .select('nome')
      .eq('id', ctx.clinicId)
      .maybeSingle<{ nome: string }>();

    // O SDK do Resend NÃO lança em erro de API — retorna { data, error }.
    // Precisamos checar `error` explicitamente, senão marcamos "enviado" à toa.
    const { error: sendError } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'Odonto.IA <equipe@odontoia.app>',
      to: email,
      subject: `Convite para ${clinicaForEmail?.nome ?? 'clínica'} — Odonto.IA`,
      html: conviteEmailHtml({
        clinicaNome: clinicaForEmail?.nome ?? 'sua clínica',
        link: inviteLink,
      }),
      text: conviteEmailText({
        clinicaNome: clinicaForEmail?.nome ?? 'sua clínica',
        link: inviteLink,
      }),
    });
    if (sendError) {
      console.error('[convite] Resend recusou o envio:', JSON.stringify(sendError));
    } else {
      emailEnviado = true;
    }
  } catch (err) {
    console.error('[convite] email falhou (exceção):', err);
  }

  // Notificação in-app — só se o convidado já tem conta com clínica ativa.
  // O alvo precisa casar com o filtro de /api/dex/alerts: para_dentista_id é a
  // PK da tabela `dentistas` (não o id de auth/users) e para_role é o role real
  // do convidado naquela clínica (um solo é 'admin' do próprio consultório).
  if (userRow?.active_clinica_id) {
    const { data: dentistaConvidado } = await db
      .from('dentistas')
      .select('id, role')
      .eq('user_id', userRow.id)
      .eq('clinica_id', userRow.active_clinica_id)
      .maybeSingle<{ id: string; role: string }>();

    if (dentistaConvidado) {
      const { data: clinicaData } = await db
        .from('clinicas')
        .select('nome')
        .eq('id', ctx.clinicId)
        .maybeSingle<{ nome: string }>();

      const nomeDaClinica = clinicaData?.nome ?? 'uma clínica';

      await inserirNotificacao(db, {
        clinicaId:      userRow.active_clinica_id,
        paraRole:       dentistaConvidado.role,
        paraDentistaId: dentistaConvidado.id,
        tipo:           'convite_clinica',
        titulo:         `Convite — ${nomeDaClinica}`,
        mensagem:       `Você foi convidado para fazer parte da equipe. Clique para aceitar.`,
        href:           inviteLink,
      });
    }
  }

  return { ok: true, inviteId: convite.id, token, link: inviteLink, emailEnviado };
}

export async function cancelarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (ctx.role !== 'admin' && ctx.role !== 'dentista') {
    return { ok: false, error: 'Sem permissão.' };
  }

  const db = createServiceClient();
  const { error } = await db
    .from('convites')
    .update({ status: 'cancelado' })
    .eq('id', inviteId)
    .eq('clinica_id', ctx.clinicId)
    .eq('status', 'pendente');

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Reenvia o convite que já está pendente sem trocar token nem prazo. Isso é importante na
 * migração de domínio: o link antigo continua válido pelo redirect 308, e o novo e-mail nasce
 * canônico sem derrubar o acesso que já estava em circulação.
 */
export async function reenviarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  inviteId: string,
): Promise<{ ok: boolean; error?: string; link?: string; emailEnviado?: boolean }> {
  if (ctx.role !== 'admin' && ctx.role !== 'dentista') {
    return { ok: false, error: 'Sem permissão.' };
  }

  const db = createServiceClient();
  const { data: convite } = await db
    .from('convites')
    .select('id, email, token, status, expires_at')
    .eq('id', inviteId)
    .eq('clinica_id', ctx.clinicId)
    .maybeSingle<{ id: string; email: string; token: string; status: string; expires_at: string }>();

  if (!convite) return { ok: false, error: 'Convite não encontrado.' };
  if (convite.status !== 'pendente' || new Date(convite.expires_at) <= new Date()) {
    return { ok: false, error: 'Este convite não está mais ativo. Renove-o para gerar um novo link.' };
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'Endereço público do sistema não configurado.' };
  const link = `${base}/convite/${convite.token}`;

  try {
    const { data: clinica } = await db
      .from('clinicas')
      .select('nome')
      .eq('id', ctx.clinicId)
      .maybeSingle<{ nome: string }>();
    const { error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'Odonto.IA <equipe@odontoia.app>',
      to: convite.email,
      subject: `Convite para ${clinica?.nome ?? 'clínica'} — Odonto.IA`,
      html: conviteEmailHtml({ clinicaNome: clinica?.nome ?? 'sua clínica', link }),
      text: conviteEmailText({ clinicaNome: clinica?.nome ?? 'sua clínica', link }),
    });
    return { ok: true, link, emailEnviado: !error };
  } catch (error) {
    console.error('[convite] reenvio falhou:', error);
    return { ok: true, link, emailEnviado: false };
  }
}

export async function renovarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  inviteId: string,
): Promise<{ ok: boolean; error?: string; link?: string }> {
  if (ctx.role !== 'admin' && ctx.role !== 'dentista') {
    return { ok: false, error: 'Sem permissão.' };
  }

  const db = createServiceClient();

  // Verificar estado atual antes de renovar.
  // Convites aceitos são terminais — reverter geraria token ativo para usuário já membro.
  const { data: convite } = await db
    .from('convites')
    .select('id, email, status, expires_at')
    .eq('id', inviteId)
    .eq('clinica_id', ctx.clinicId)
    .maybeSingle();

  if (!convite) {
    return { ok: false, error: 'Convite não encontrado.' };
  }

  const status = convite.status as string;
  const isExpired = new Date(convite.expires_at as string) < new Date();

  if (status === 'aceito') {
    return { ok: false, error: 'Convites já aceitos não podem ser renovados.' };
  }

  // Só renovar se cancelado OU expirado (pendente com expires_at no passado).
  // Convite ainda ativo não precisa de renovação.
  if (status !== 'cancelado' && !isExpired) {
    return { ok: false, error: 'Este convite ainda está ativo.' };
  }

  const newToken = crypto.randomUUID();
  const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await db
    .from('convites')
    .update({ token: newToken, status: 'pendente', expires_at: newExpires })
    .eq('id', inviteId)
    .eq('clinica_id', ctx.clinicId);

  if (error) return { ok: false, error: error.message };

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const renewedLink = `${base}/convite/${newToken}`;

  // Envio de e-mail — falha silenciosa para não bloquear a renovação
  try {
    const { data: clinicaForEmail } = await db
      .from('clinicas')
      .select('nome')
      .eq('id', ctx.clinicId)
      .maybeSingle<{ nome: string }>();

    await getResend().emails.send({
      from: 'Odonto.IA <equipe@odontoia.app>',
      to: convite.email as string,
      subject: `Convite renovado para ${clinicaForEmail?.nome ?? 'clínica'} — Odonto.IA`,
      html: conviteEmailHtml({
        clinicaNome: clinicaForEmail?.nome ?? 'sua clínica',
        link: renewedLink,
      }),
      text: conviteEmailText({
        clinicaNome: clinicaForEmail?.nome ?? 'sua clínica',
        link: renewedLink,
      }),
    });
  } catch (err) {
    console.error('[convite] email falhou:', err);
  }

  return { ok: true, link: renewedLink };
}

export type InviteData = {
  id: string;
  clinicaId: string;
  clinicaNome: string;
  email: string;
  role: string;
  convidadoPorNome: string | null;
  expiresAt: string;
  status: string;
};

export async function getConviteByToken(token: string): Promise<InviteData | null> {
  const db = createServiceClient();

  const { data } = await db
    .from('convites')
    .select(`
      id,
      clinica_id,
      email,
      role,
      expires_at,
      status,
      clinicas(nome),
      dentistas!convites_convidado_por_fkey(nome)
    `)
    .eq('token', token)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    clinicaId: data.clinica_id as string,
    clinicaNome: (data.clinicas as unknown as { nome: string } | null)?.nome ?? '',
    email: data.email as string,
    role: data.role as string,
    convidadoPorNome: (data.dentistas as unknown as { nome: string } | null)?.nome ?? null,
    expiresAt: data.expires_at as string,
    status: data.status as string,
  };
}

export async function aceitarConvite(
  token: string,
  userId: string,
  userEmail: string,
): Promise<AceitarConviteResult> {
  const db = createServiceClient();

  // 1. Validar token — pendente e dentro da validade
  const { data: convite } = await db
    .from('convites')
    .select('id, clinica_id, email, role')
    .eq('token', token)
    .eq('status', 'pendente')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!convite) {
    return { ok: false, error: 'Convite inválido ou expirado.' };
  }

  // 2. Validar destinatário — email do convite deve coincidir com o usuário autenticado
  if ((convite.email as string).toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: 'Este convite foi enviado para outro email.' };
  }

  const clinicId = convite.clinica_id as string;
  const role = convite.role as string;
  const isDentistaConvidado = role === 'dentista';
  const { data: governanca } = await db
    .from('clinica_governanca')
    .select('modalidade')
    .eq('clinica_id', clinicId)
    .maybeSingle<{ modalidade: string | null }>();
  const billingEnabled = process.env.STRIPE_BILLING_ENABLED === 'true';
  // R-92: apenas dentista convidado de clínica não-isenta espera o Checkout. Esta única
  // variável governa perfil, membership e redirecionamento; deixar um deles fora criava
  // o estado contraditório de isento com cartão obrigatório.
  const exigeCheckout = billingEnabled
    && isDentistaConvidado
    && governanca?.modalidade !== 'gerida'
    && !clinicaIsentaDeCobranca(clinicId);

  if (exigeCheckout) {
    const [{ data: clinicaPlano }, { data: formacao }] = await Promise.all([
      db.from('clinicas').select('plano').eq('id', clinicId)
        .maybeSingle<{ plano: string }>(),
      db.from('formacoes_clinica').select('id').eq('clinica_id', clinicId)
        .in('status', ['aguardando_equipe', 'coletando_pagamento', 'ativando'])
        .gt('expires_at', new Date().toISOString()).maybeSingle<{ id: string }>(),
    ]);
    if (clinicaPlano?.plano !== 'CLINICA' && !formacao) {
      return { ok: false, error: 'A formação desta clínica expirou. Peça um novo convite.' };
    }
  }

  // 3. Verificar membership nesta clínica específica
  // Multi-clínica é suportado: pertencer a outras clínicas não bloqueia este convite.
  const { data: membershipExistente } = await db
    .from('clinica_usuarios')
    .select('id, status')
    .eq('usuario_id', userId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (membershipExistente?.status === 'ativo') {
    return { ok: false, error: 'Você já faz parte desta clínica.' };
  }

  // 4. Resolver nome do usuário a partir dos metadados auth
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const nome =
    (authUser?.user?.user_metadata?.nome as string | undefined) ??
    authUser?.user?.email ??
    userEmail;

  const { data: userAntes } = await db.from('users')
    .select('active_clinica_id').eq('id', userId)
    .maybeSingle<{ active_clinica_id: string | null }>();

  // 5. A clínica convidante vira o contexto ativo, mas o vínculo pendente não
  // concede acesso: requireClinicContext redireciona ao Checkout até o webhook.
  const [userUpsert, dentistaUpsert] = await Promise.all([
    db.from('users').upsert(
      {
        id: userId,
        email: userEmail,
        // O convite pago só vira contexto ativo depois do webhook. Assim, cancelar
        // o Checkout não prende um dentista que já trabalhava em outra clínica.
        active_clinica_id: exigeCheckout
          ? userAntes?.active_clinica_id ?? null
          : clinicId,
      },
      { onConflict: 'id' },
    ),
    // Perfil clínico legado — cria ou reativa linha para esta clínica+usuário
    db.from('dentistas').upsert(
      { clinica_id: clinicId, user_id: userId, nome, email: userEmail, role, ativo: !exigeCheckout },
      { onConflict: 'clinica_id,user_id' },
    ).select('id').single(),
  ]);

  if (userUpsert.error || dentistaUpsert.error || !dentistaUpsert.data?.id) {
    console.error('[aceitarConvite] falha ao preparar perfil:', userUpsert.error?.message ?? dentistaUpsert.error?.message);
    return { ok: false, error: 'Erro ao preparar seu acesso. Tente novamente.' };
  }

  // 5b. Dentista novo ganha a própria cópia do catálogo padrão — catálogo é
  // privado por dentista (não herda de ninguém da clínica). Best-effort:
  // falha aqui não deve impedir o aceite do convite.
  const dentistaId = dentistaUpsert.data?.id as string | undefined;
  if (role === 'dentista' && dentistaId) {
    try {
      const { data: padroes } = await db
        .from('procedimentos_padrao')
        .select('nome, descricao, categoria, preco_sugerido, duracao_minutos')
        .eq('ativo', true);

      if (padroes && padroes.length > 0) {
        await db.from('procedimentos').insert(
          padroes.map((p) => ({
            clinica_id: clinicId,
            dentista_id: dentistaId,
            nome: p.nome,
            descricao: p.descricao,
            categoria: p.categoria,
            preco_padrao: p.preco_sugerido,
            duracao_minutos: p.duracao_minutos,
            ativo: true,
          })),
        );
      }
    } catch (err) {
      console.error('[aceitarConvite] falha ao copiar procedimentos_padrao:', err);
    }
  }

  // 6. Membership canônica — apenas o Checkout real deixa dentista pendente até o webhook.
  const memberData = {
    usuario_id: userId,
    clinica_id: clinicId,
    role,
    status: exigeCheckout ? 'pendente' : 'ativo',
    joined_at: new Date().toISOString(),
  };
  const { error: memberError } = membershipExistente
    ? await db.from('clinica_usuarios').update(memberData).eq('id', membershipExistente.id as string)
    : await db.from('clinica_usuarios').insert(memberData);

  if (memberError) {
    // Não revertemos users (pode já existir em outra clínica), mas impedimos
    // o aceite do convite para evitar estado inconsistente.
    console.error('[aceitarConvite] falha ao criar membership:', memberError.message);
    return { ok: false, error: 'Erro ao processar o convite. Tente novamente.' };
  }

  // A assinatura só nasce depois que o próprio dentista escolhe mensal/anual.
  // Isso evita gravar um Price implícito e, na formação Clínica, evita qualquer
  // subscription antes de dois cartões confirmados.

  // 7. Marcar convite como aceito — só após membership criada com sucesso
  const { error: updateError } = await db
    .from('convites')
    .update({ status: 'aceito', accepted_by: userId })
    .eq('id', convite.id as string);

  if (updateError) {
    // Membership foi criada mas convite não marcado — não é crítico para o usuário,
    // mas logamos para acompanhamento.
    console.error('[aceitarConvite] falha ao marcar convite:', updateError.message);
    // Continua: usuário entrou na clínica, só o status do convite ficou pendente
  }

  return { ok: true, clinicId, role, exigeCheckout };
}
