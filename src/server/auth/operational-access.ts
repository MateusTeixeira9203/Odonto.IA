import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const OperationalPermissionSchema = z.enum([
  'agenda.ler', 'agenda.editar', 'agenda.confirmar',
  'pacientes.ler', 'pacientes.editar',
  'financeiro.ler', 'financeiro.exportar', 'cobrancas.ler',
  'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar',
  'despesas.ler', 'despesas.gerir',
  'orcamentos.ler', 'contatos.whatsapp',
]);

export type OperationalPermission = z.infer<typeof OperationalPermissionSchema>;

const OperationalAccessInputSchema = z.strictObject({
  clinicaIdEsperada: z.string().uuid().transform((value) => value.toLowerCase()),
  permissao: OperationalPermissionSchema,
  dentistaId: z.string().uuid().transform((value) => value.toLowerCase()).nullable(),
});

export type OperationalAccessInput = z.infer<typeof OperationalAccessInputSchema>;

export type OperationalAccessDependencies = {
  check(input: {
    p_clinica_id: string;
    p_permissao: OperationalPermission;
    p_dentista_id: string | null;
  }): Promise<{ data: boolean | null; error: { message: string } | null }>;
};

async function defaultDependencies(): Promise<OperationalAccessDependencies> {
  const client = await createClient();
  return {
    check: (input) => client.rpc('tem_permissao_operacional', input),
  };
}

/** Consulta a autorização efetiva do piloto; nunca usa cargo como fallback. */
export async function hasOperationalPermission(
  input: unknown,
  dependencies?: OperationalAccessDependencies,
): Promise<boolean> {
  const parsed = OperationalAccessInputSchema.safeParse(input);
  if (!parsed.success) return false;

  try {
    const source = dependencies ?? await defaultDependencies();
    const { data, error } = await source.check({
      p_clinica_id: parsed.data.clinicaIdEsperada,
      p_permissao: parsed.data.permissao,
      p_dentista_id: parsed.data.dentistaId,
    });
    return error === null && data === true;
  } catch {
    return false;
  }
}

/** Recebimentos é uma leitura de cobrança; financeiro.ler não abre esta superfície. */
export async function hasRecebimentosOperationalAccess(
  clinicaIdEsperada: string,
  dependencies?: OperationalAccessDependencies,
): Promise<boolean> {
  return hasOperationalPermission({ clinicaIdEsperada, permissao: 'cobrancas.ler', dentistaId: null }, dependencies);
}
