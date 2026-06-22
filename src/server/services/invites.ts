import { createServiceClient } from '@/lib/supabase/service';
import { inserirNotificacao } from '@/lib/notificacoes';
import { getResend } from '@/lib/email/resend';
import { conviteEmailHtml, conviteEmailText } from '@/lib/email/templates/convite';

export type CriarConviteInput = { email: string };

export type CriarConviteResult =
  | { ok: true; inviteId: string; token: string; link: string; emailEnviado: boolean }
  | { ok: false; error: string };

export async function criarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  input: CriarConviteInput,
): Promise<CriarConviteResult> {
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem convidar dentistas.' };
  }

  // Normaliza o e-mail — evita tratar usuário existente como "sem conta" por
  // diferença de maiúsculas/espaços. O aceite compara case-insensitive.
  const email = input.email.trim().toLowerCase();
  const db = createServiceClient();

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
  const [{ data: clinica }, { count: activeDentistas }] = await Promise.all([
    db.from('clinicas').select('limite_dentistas').eq('id', ctx.clinicId).single(),
    db
      .from('clinica_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', ctx.clinicId)
      .in('role', ['admin', 'dentista'])
      .eq('status', 'ativo'),
  ]);

  const limite = (clinica as { limite_dentistas: number } | null)?.limite_dentistas ?? 5;
  if ((activeDentistas ?? 0) >= limite) {
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

    await getResend().emails.send({
      from: 'Odonto.IA <equipe@dentia.app.br>',
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
    emailEnviado = true;
  } catch (err) {
    console.error('[convite] email falhou:', err);
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
  if (ctx.role !== 'admin') {
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

export async function renovarConvite(
  ctx: { userId: string; clinicId: string; role: string },
  inviteId: string,
): Promise<{ ok: boolean; error?: string; link?: string }> {
  if (ctx.role !== 'admin') {
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
      from: 'Odonto.IA <equipe@dentia.app.br>',
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
): Promise<{ ok: boolean; clinicId?: string; role?: string; error?: string }> {
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

  // 3. Verificar membership nesta clínica específica
  // Multi-clínica é suportado: pertencer a outras clínicas não bloqueia este convite.
  const { data: jaEMembro } = await db
    .from('clinica_usuarios')
    .select('id')
    .eq('usuario_id', userId)
    .eq('clinica_id', clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (jaEMembro) {
    return { ok: false, error: 'Você já faz parte desta clínica.' };
  }

  // 4. Resolver nome do usuário a partir dos metadados auth
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const nome =
    (authUser?.user?.user_metadata?.nome as string | undefined) ??
    authUser?.user?.email ??
    userEmail;

  // 5. Garantir registro em public.users e definir nova clínica como ativa.
  //    Upsert: cria se não existir, atualiza active_clinica_id se já existir.
  //    Paralelo com dentistas — ambos independentes entre si.
  await Promise.all([
    db.from('users').upsert(
      { id: userId, email: userEmail, active_clinica_id: clinicId },
      { onConflict: 'id' },
    ),
    // Perfil clínico legado — cria ou reativa linha para esta clínica+usuário
    db.from('dentistas').upsert(
      { clinica_id: clinicId, user_id: userId, nome, email: userEmail, role, ativo: true },
      { onConflict: 'clinica_id,user_id' },
    ),
  ]);

  // 6. Membership canônica — depende de public.users existir (FK)
  const { error: memberError } = await db.from('clinica_usuarios').insert({
    usuario_id: userId,
    clinica_id: clinicId,
    role,
    status: 'ativo',
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    // Não revertemos users (pode já existir em outra clínica), mas impedimos
    // o aceite do convite para evitar estado inconsistente.
    console.error('[aceitarConvite] falha ao criar membership:', memberError.message);
    return { ok: false, error: 'Erro ao processar o convite. Tente novamente.' };
  }

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

  return { ok: true, clinicId, role };
}
