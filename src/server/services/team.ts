import { createServiceClient } from '@/lib/supabase/service';

function gerarSenhaTemporaria(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export type CriarSecretariaInput = {
  nome: string;
  email: string;
  /** Senha definida pelo admin — mínimo 8 caracteres */
  senha: string;
  telefone?: string;
};

export type CriarSecretariaResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cria uma secretária com rollback compensatório.
 *
 * Fluxo:
 *  1. Pré-check: email já é membro ativo desta clínica? (UX — evita round-trip desnecessário)
 *  2. auth.admin.createUser() — fora de qualquer transação SQL (Supabase Auth é externo ao Postgres)
 *  3. rpc('provision_secretaria') — 4 inserts em transação única: users, dentistas, clinica_usuarios, secretarias
 *  4. Se a RPC falhar → auth.admin.deleteUser() como rollback compensatório (evita auth user órfão)
 */
export async function criarSecretaria(
  ctx: { userId: string; clinicId: string; role: string },
  input: CriarSecretariaInput,
): Promise<CriarSecretariaResult> {
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem criar secretárias.' };
  }

  const { nome, email, senha, telefone } = input;

  if (!senha || senha.length < 8) {
    return { ok: false, error: 'A senha deve ter no mínimo 8 caracteres.' };
  }

  const db = createServiceClient();

  // Pré-check: email já tem membership ativa nesta clínica?
  // Fonte canônica: clinica_usuarios, não dentistas.
  // Otimização de UX — evita tentar criar auth user para o caso mais comum.
  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    const { data: activeMembership } = await db
      .from('clinica_usuarios')
      .select('id')
      .eq('usuario_id', existingUser.id)
      .eq('clinica_id', ctx.clinicId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (activeMembership) {
      return { ok: false, error: 'Este email já está cadastrado nesta clínica.' };
    }
  }

  // PASSO 1 — criar auth user (externo ao Postgres, sem transação)
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? '';
    if (msg.includes('already') || msg.includes('registered')) {
      return { ok: false, error: 'Este email já possui uma conta no sistema.' };
    }
    console.error('[criarSecretaria] Erro ao criar auth user:', { email, clinicId: ctx.clinicId, message: msg });
    return { ok: false, error: msg || 'Erro ao criar usuário.' };
  }

  const uid = authData.user.id;

  // PASSO 2 — provisionar todos os registros Postgres em transação única
  const { error: rpcError } = await db.rpc('provision_secretaria', {
    p_uid:        uid,
    p_email:      email,
    p_nome:       nome,
    p_clinica_id: ctx.clinicId,
    p_telefone:   telefone ?? null,
    p_invited_by: ctx.userId,
  });

  if (rpcError) {
    // Rollback compensatório — Postgres reverteu automaticamente os 4 inserts,
    // mas o auth user já foi criado e precisa ser removido manualmente.
    const { error: deleteError } = await db.auth.admin.deleteUser(uid);

    if (deleteError) {
      // Estado crítico: auth user órfão não removível. Requer intervenção manual.
      console.error('[criarSecretaria] CRITICAL: rollback compensatório falhou — auth user órfão', {
        uid,
        email,
        clinicId:    ctx.clinicId,
        rpcMessage:  rpcError.message,
        deleteError: deleteError.message,
      });
    } else {
      console.warn('[criarSecretaria] auth user removido após falha no provisioning', {
        uid,
        email,
        clinicId:   ctx.clinicId,
        rpcMessage: rpcError.message,
      });
    }

    if (rpcError.message.includes('DUPLICATE_MEMBERSHIP')) {
      return { ok: false, error: 'Este usuário já é membro desta clínica.' };
    }

    return { ok: false, error: 'Erro ao provisionar secretária. Tente novamente.' };
  }

  return { ok: true };
}

/**
 * Permite que o próprio usuário saia de uma clínica.
 * Protege o último admin — não permite auto-remoção nesse caso.
 * Retorna hasOtherClinic para o caller redirecionar corretamente.
 */
export async function sairDaClinica(
  ctx: { userId: string; clinicId: string; role: string },
): Promise<{ ok: boolean; error?: string; hasOtherClinic?: boolean }> {
  const db = createServiceClient();

  // Admin: verificar se há pelo menos outro admin ativo
  if (ctx.role === 'admin') {
    const { count } = await db
      .from('clinica_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', ctx.clinicId)
      .eq('role', 'admin')
      .eq('status', 'ativo');

    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error: 'Você é o único administrador. Transfira o papel de admin a outro membro antes de sair.',
      };
    }
  }

  const now = new Date().toISOString();

  await Promise.all([
    db.from('clinica_usuarios')
      .update({ status: 'removido', removed_at: now })
      .eq('usuario_id', ctx.userId)
      .eq('clinica_id', ctx.clinicId),
    db.from('dentistas')
      .update({ ativo: false })
      .eq('user_id', ctx.userId)
      .eq('clinica_id', ctx.clinicId),
  ]);

  // Verifica se o usuário tem outra clínica ativa para redirecionar
  const { data: outraClinica } = await db
    .from('clinica_usuarios')
    .select('clinica_id')
    .eq('usuario_id', ctx.userId)
    .eq('status', 'ativo')
    .neq('clinica_id', ctx.clinicId)
    .limit(1)
    .maybeSingle<{ clinica_id: string }>();

  if (outraClinica) {
    // Atualiza active_clinica_id para a outra clínica
    await db
      .from('users')
      .update({ active_clinica_id: outraClinica.clinica_id })
      .eq('id', ctx.userId);
    return { ok: true, hasOtherClinic: true };
  }

  // Sem outra clínica — limpa o contexto ativo
  await db
    .from('users')
    .update({ active_clinica_id: null })
    .eq('id', ctx.userId);

  return { ok: true, hasOtherClinic: false };
}

export async function removerMembro(
  ctx: { userId: string; clinicId: string; role: string },
  membroUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Apenas administradores podem remover membros.' };
  }

  if (membroUserId === ctx.userId) {
    return { ok: false, error: 'Você não pode se remover da clínica.' };
  }

  const db = createServiceClient();

  const { data: membership } = await db
    .from('clinica_usuarios')
    .select('id, role')
    .eq('usuario_id', membroUserId)
    .eq('clinica_id', ctx.clinicId)
    .eq('status', 'ativo')
    .maybeSingle();

  // Fallback: busca via dentistas (usuários pré-migração podem não estar em clinica_usuarios)
  if (!membership) {
    const { data: dentista } = await db
      .from('dentistas')
      .select('id, role, ativo')
      .eq('user_id', membroUserId)
      .eq('clinica_id', ctx.clinicId)
      .eq('ativo', true)
      .maybeSingle();

    if (!dentista) return { ok: false, error: 'Membro não encontrado nesta clínica.' };

    if (dentista.role === 'admin') {
      const { count } = await db
        .from('dentistas')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', ctx.clinicId)
        .eq('role', 'admin')
        .eq('ativo', true);

      if ((count ?? 0) <= 1) {
        return { ok: false, error: 'Não é possível remover o último administrador da clínica.' };
      }
    }

    await db
      .from('dentistas')
      .update({ ativo: false })
      .eq('id', dentista.id as string);

    // Auto-downgrade: busca outra clínica ativa antes de limpar o contexto
    const { data: outraClinicaLegacy } = await db
      .from('clinica_usuarios')
      .select('clinica_id')
      .eq('usuario_id', membroUserId)
      .eq('status', 'ativo')
      .neq('clinica_id', ctx.clinicId)
      .limit(1)
      .maybeSingle<{ clinica_id: string }>();

    await db
      .from('users')
      .update({ active_clinica_id: outraClinicaLegacy?.clinica_id ?? null })
      .eq('id', membroUserId)
      .eq('active_clinica_id', ctx.clinicId);

    return { ok: true };
  }

  // Proteção: último admin
  if (membership.role === 'admin') {
    const { count } = await db
      .from('clinica_usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('clinica_id', ctx.clinicId)
      .eq('role', 'admin')
      .eq('status', 'ativo');

    if ((count ?? 0) <= 1) {
      return { ok: false, error: 'Não é possível remover o último administrador da clínica.' };
    }
  }

  const now = new Date().toISOString();

  await Promise.all([
    db.from('clinica_usuarios')
      .update({ status: 'removido', removed_at: now })
      .eq('id', membership.id as string),
    db.from('dentistas')
      .update({ ativo: false })
      .eq('user_id', membroUserId)
      .eq('clinica_id', ctx.clinicId),
  ]);

  // Auto-downgrade: redireciona o dentista para a sua própria clínica (SOLO),
  // caso ele tenha outra membership ativa. Se não, limpa o contexto ativo.
  const { data: outraClinica } = await db
    .from('clinica_usuarios')
    .select('clinica_id')
    .eq('usuario_id', membroUserId)
    .eq('status', 'ativo')
    .neq('clinica_id', ctx.clinicId)
    .limit(1)
    .maybeSingle<{ clinica_id: string }>();

  if (outraClinica) {
    await db
      .from('users')
      .update({ active_clinica_id: outraClinica.clinica_id })
      .eq('id', membroUserId)
      .eq('active_clinica_id', ctx.clinicId);
  } else {
    await db
      .from('users')
      .update({ active_clinica_id: null })
      .eq('id', membroUserId)
      .eq('active_clinica_id', ctx.clinicId);
  }

  return { ok: true };
}

export async function resetarSenhaSecretaria(
  ctx: { userId: string; clinicId: string; role: string },
  secretariaUserId: string,
): Promise<{ ok: boolean; error?: string; senhaTemporaria?: string }> {
  if (ctx.role !== 'admin') {
    return { ok: false, error: 'Sem permissão.' };
  }

  const db = createServiceClient();

  // Verificar que é secretária desta clínica
  const { data: dentista } = await db
    .from('dentistas')
    .select('id')
    .eq('user_id', secretariaUserId)
    .eq('clinica_id', ctx.clinicId)
    .eq('role', 'secretaria')
    .eq('ativo', true)
    .maybeSingle();

  if (!dentista) {
    return { ok: false, error: 'Secretária não encontrada nesta clínica.' };
  }

  const senhaTemporaria = gerarSenhaTemporaria();

  const { error } = await db.auth.admin.updateUserById(secretariaUserId, {
    password: senhaTemporaria,
  });

  if (error) return { ok: false, error: 'Erro ao redefinir senha.' };

  // Força troca no próximo login
  await db
    .from('secretarias')
    .update({ must_change_password: true })
    .eq('usuario_id', secretariaUserId)
    .eq('clinica_id', ctx.clinicId);

  return { ok: true, senhaTemporaria };
}
