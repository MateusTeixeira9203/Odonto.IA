import { z } from 'zod';

import { getResend } from '@/lib/email/resend';
import { conviteEmailHtml, conviteEmailText } from '@/lib/email/templates/convite';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

export const TeamInviteSchema = z.object({
  clinicaId: UuidSchema,
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  tipo: z.enum(['dentista', 'gestor', 'responsavel_tecnico']),
  chaveIdempotencia: UuidSchema,
});

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.object({ id: UuidSchema, token: UuidSchema, email: z.string().email(), tipo: TeamInviteSchema.shape.tipo, expiresAt: z.string() }).strict() }).strict(),
  z.object({ ok: z.literal(false), codigo: z.string(), mensagem: z.string() }).strict(),
]);

type Dependencies = {
  create(input: {
    p_clinica_id: string;
    p_nome: string;
    p_email: string;
    p_tipo: 'dentista' | 'gestor' | 'responsavel_tecnico';
    p_chave_idempotencia: string;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function defaultDependencies(): Promise<Dependencies> {
  const client = await createClient();
  return { create: async (input) => client.rpc('criar_convite_equipe', input) };
}

export type TeamInviteResult =
  | { ok: true; emailEnviado: boolean }
  | { ok: false; mensagem: string };

/** Cria o vínculo pendente no banco e tenta entregar o link pessoal por e-mail. */
export async function createTeamInvite(input: unknown, dependencies?: Dependencies): Promise<TeamInviteResult> {
  const parsed = TeamInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: 'Revise nome, e-mail e função antes de enviar.' };

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.create({
      p_clinica_id: parsed.data.clinicaId,
      p_nome: parsed.data.nome,
      p_email: parsed.data.email,
      p_tipo: parsed.data.tipo,
      p_chave_idempotencia: parsed.data.chaveIdempotencia,
    });
    if (error) return { ok: false, mensagem: 'Não foi possível criar o convite agora.' };
    const result = RpcResultSchema.safeParse(data);
    if (!result.success || !result.data.ok) return { ok: false, mensagem: 'Não foi possível criar o convite agora.' };

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
    if (!base) return { ok: true, emailEnviado: false };
    const link = `${base}/convite/${result.data.data.token}`;
    const db = createServiceClient();
    const { data: clinic } = await db.from('clinicas').select('nome')
      .eq('id', parsed.data.clinicaId).maybeSingle<{ nome: string }>();
    const delivery = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? 'Odonto.IA <equipe@odontoia.app>',
      to: parsed.data.email,
      subject: `Convite para ${clinic?.nome ?? 'sua clínica'} — Odonto.IA`,
      html: conviteEmailHtml({ clinicaNome: clinic?.nome ?? 'sua clínica', link }),
      text: conviteEmailText({ clinicaNome: clinic?.nome ?? 'sua clínica', link }),
    });
    const emailEnviado = !delivery.error;
    if (emailEnviado && parsed.data.tipo !== 'dentista') {
      await db.from('convites_governanca').update({ email_enviado_em: new Date().toISOString() })
        .eq('id', result.data.data.id).eq('clinica_id', parsed.data.clinicaId);
    }
    return { ok: true, emailEnviado };
  } catch (error) {
    console.error('[team-invites] envio falhou:', error);
    return { ok: true, emailEnviado: false };
  }
}
