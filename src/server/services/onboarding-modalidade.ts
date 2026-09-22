import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());

export const OnboardingModalidadeSchema = z.object({
  nomeClinica: z.string().trim().min(2).max(120),
  modalidade: z.enum(['colaborativa', 'gerida']),
  criadorAtende: z.boolean(),
  nomeUsuario: z.string().trim().min(2).max(120),
  cro: z.string().trim().max(60).nullable(),
  especialidade: z.array(z.string().trim().min(1)).max(12),
  email: z.string().email().nullable(),
  foco: z.enum(['economizar_tempo', 'crescer']).nullable(),
  chaveIdempotencia: UuidSchema,
}).superRefine((input, context) => {
  if (input.modalidade === 'colaborativa' && !input.criadorAtende) {
    context.addIssue({ code: 'custom', path: ['criadorAtende'], message: 'A clínica colaborativa exige um dentista criador.' });
  }
  if (input.criadorAtende && !input.cro) {
    context.addIssue({ code: 'custom', path: ['cro'], message: 'Informe o CRO de quem atende.' });
  }
  if (input.criadorAtende && input.especialidade.length === 0) {
    context.addIssue({ code: 'custom', path: ['especialidade'], message: 'Informe ao menos uma especialidade.' });
  }
});

export type OnboardingModalidadeInput = z.infer<typeof OnboardingModalidadeSchema>;

const RpcResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.object({
      clinicaId: UuidSchema,
      membroId: UuidSchema,
      modalidade: z.enum(['colaborativa', 'gerida']),
      criadorAtende: z.boolean(),
      dentistaId: UuidSchema.nullable(),
    }).strict(),
  }).strict(),
  z.object({ ok: z.literal(false), codigo: z.string(), mensagem: z.string() }).strict(),
]);

export type OnboardingModalidadeResult =
  | { ok: true; data: Extract<z.infer<typeof RpcResultSchema>, { ok: true }>['data'] }
  | { ok: false; codigo: 'INVALIDO' | 'INDISPONIVEL'; mensagem: string };

export type OnboardingModalidadeDependencies = {
  complete(input: {
    p_nome_clinica: string;
    p_modalidade: 'colaborativa' | 'gerida';
    p_criador_atende: boolean;
    p_nome_usuario: string;
    p_cro: string | null;
    p_especialidade: string[];
    p_email: string | null;
    p_foco_principal: 'economizar_tempo' | 'crescer' | null;
    p_chave_idempotencia: string;
  }): Promise<{ data: unknown; error: { message: string } | null }>;
};

function failure(codigo: 'INVALIDO' | 'INDISPONIVEL', mensagem: string): OnboardingModalidadeResult {
  return { ok: false, codigo, mensagem };
}

async function defaultDependencies(): Promise<OnboardingModalidadeDependencies> {
  const client = await createClient();
  return { complete: (input) => client.rpc('complete_onboarding_modalidade', input) };
}

/** Cria o primeiro vínculo de uma clínica com modalidade e autoria explícitas. */
export async function completeOnboardingModalidade(
  input: unknown,
  dependencies?: OnboardingModalidadeDependencies,
): Promise<OnboardingModalidadeResult> {
  const parsed = OnboardingModalidadeSchema.safeParse(input);
  if (!parsed.success) return failure('INVALIDO', 'Revise os dados do cadastro antes de continuar.');

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.complete({
      p_nome_clinica: parsed.data.nomeClinica,
      p_modalidade: parsed.data.modalidade,
      p_criador_atende: parsed.data.criadorAtende,
      p_nome_usuario: parsed.data.nomeUsuario,
      p_cro: parsed.data.cro,
      p_especialidade: parsed.data.especialidade,
      p_email: parsed.data.email,
      p_foco_principal: parsed.data.foco,
      p_chave_idempotencia: parsed.data.chaveIdempotencia,
    });
    if (error) return failure('INDISPONIVEL', 'Não foi possível criar a clínica agora.');

    const result = RpcResultSchema.safeParse(data);
    if (!result.success) return failure('INDISPONIVEL', 'A confirmação do cadastro não pôde ser validada.');
    if (!result.data.ok) return failure('INDISPONIVEL', result.data.mensagem);

    return { ok: true, data: result.data.data };
  } catch {
    return failure('INDISPONIVEL', 'Não foi possível criar a clínica agora.');
  }
}
