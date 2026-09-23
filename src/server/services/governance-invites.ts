import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const RoleSchema = z.enum(['gestor', 'responsavel_tecnico']);

export type GovernanceInvite = {
  id: string;
  clinicaId: string;
  clinicaNome: string;
  email: string;
  role: z.infer<typeof RoleSchema>;
  expiresAt: string;
  status: string;
};

export async function getGovernanceInviteByToken(token: string): Promise<GovernanceInvite | null> {
  if (!UuidSchema.safeParse(token).success) return null;
  const db = createServiceClient();
  const { data } = await db.from('convites_governanca')
    .select('id, clinica_id, email, papel, expires_at, status')
    .eq('token', token).maybeSingle();
  if (!data) return null;
  const { data: clinic } = await db.from('clinicas').select('nome')
    .eq('id', data.clinica_id as string).maybeSingle<{ nome: string }>();
  const role = RoleSchema.safeParse(data.papel);
  if (!role.success) return null;
  return {
    id: data.id as string,
    clinicaId: data.clinica_id as string,
    clinicaNome: clinic?.nome ?? '',
    email: data.email as string,
    role: role.data,
    expiresAt: data.expires_at as string,
    status: data.status as string,
  };
}

const AcceptanceSchema = z.object({
  token: UuidSchema,
  cro: z.string().trim().max(60).nullable(),
  especialidade: z.array(z.string().trim().min(1)).max(12),
});

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ clinicaId: UuidSchema, papel: RoleSchema }).strict() }).strict(),
  z.object({ ok: z.literal(false), codigo: z.string(), mensagem: z.string() }).strict(),
]);

export async function acceptGovernanceInvite(input: unknown): Promise<
  { ok: true; role: z.infer<typeof RoleSchema> } | { ok: false; error: string }
> {
  const parsed = AcceptanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Revise seus dados antes de aceitar o convite.' };
  if (!parsed.data.cro && parsed.data.especialidade.length > 0) {
    return { ok: false, error: 'Informe o CRO do responsável técnico.' };
  }
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('aceitar_convite_governanca', {
      p_token: parsed.data.token,
      p_cro: parsed.data.cro,
      p_especialidade: parsed.data.especialidade,
    });
    if (error) return { ok: false, error: 'Não foi possível aceitar o convite agora.' };
    const result = RpcResultSchema.safeParse(data);
    if (!result.success || !result.data.ok) return { ok: false, error: 'Não foi possível aceitar o convite agora.' };
    return { ok: true, role: result.data.data.papel };
  } catch {
    return { ok: false, error: 'Não foi possível aceitar o convite agora.' };
  }
}
