import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getMemberContext } from '@/server/auth/member-context';
import { composicaoGrupoSchema } from '@/lib/orcamentos/grupos';

const LeituraSchema = z.object({
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  documento: z.object({
    id: z.string().uuid(), created_at: z.string(), status: z.string(), total: z.number().nullable(),
    valor_acordado: z.number().nullable(), desconto: z.number(), validade_dias: z.number().int(),
    condicoes_pagamento: z.string().nullable(), mostrar_valor_por_item: z.boolean(),
    paciente: z.object({ nome: z.string(), telefone: z.string().nullable() }),
    dentista: z.object({ nome: z.string() }), clinica: z.object({ nome: z.string() }),
    itens: z.array(z.object({ descricao: z.string().nullable(), quantidade: z.number(),
      preco_unitario: z.number().nullable(), preco_total: z.number().nullable(), aprovado: z.boolean(),
      composicao: composicaoGrupoSchema.nullable(),
    })),
    cobrancas: z.array(z.object({ desconto: z.number(), situacao: z.string() })),
    pagamentos: z.array(z.object({ valor: z.number(), status: z.string(), forma_pagamento: z.string().nullable(), data_pagamento: z.string().nullable() })),
  }),
});

export async function lerOrcamentoParaCompartilhar(orcamentoId: string) {
  if (!z.string().uuid().safeParse(orcamentoId).success) return null;
  const context = await getMemberContext();
  if (!context.ok) return null;
  const client = await createClient();
  const { data, error } = await client.rpc('ler_orcamento_compartilhavel', {
    p_clinica: context.data.clinicaId, p_orcamento: orcamentoId,
  });
  if (error) return null;
  const result = LeituraSchema.safeParse(data);
  return result.success ? { ...result.data, clinicaId: context.data.clinicaId } : null;
}

const ConfirmarSchema = z.strictObject({
  clinicaId: z.string().uuid(), orcamentoId: z.string().uuid(), snapshot: z.string().regex(/^[a-f0-9]{64}$/),
});
export async function confirmarEnvioManual(input: unknown): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const parsed = ConfirmarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, mensagem: 'Revise o orçamento antes de continuar.' };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc('confirmar_envio_orcamento_manual', {
      p_clinica: parsed.data.clinicaId, p_orcamento: parsed.data.orcamentoId, p_snapshot: parsed.data.snapshot,
    });
    const response = z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), codigo: z.enum(['SEM_ACESSO','CONFLITO','INDISPONIVEL']) }),
    ]).safeParse(data);
    if (error || !response.success) return { ok: false, mensagem: 'Não foi possível registrar o envio. Tente novamente.' };
    if (response.data.ok) return { ok: true };
    return { ok: false, mensagem: response.data.codigo === 'CONFLITO'
      ? 'O orçamento mudou. Prepare o PDF atualizado antes de registrar o envio.'
      : 'Não foi possível registrar. Confira seu acesso e tente novamente.' };
  } catch {
    return { ok: false, mensagem: 'Não foi possível registrar o envio. Tente novamente.' };
  }
}
