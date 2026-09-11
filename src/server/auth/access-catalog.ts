import { z } from 'zod';

export const ACCESS_PERMISSIONS = [
  'pacientes.ler',
  'pacientes.editar',
  'agenda.ler',
  'agenda.editar',
  'agenda.confirmar',
  'contatos.whatsapp',
  'acompanhamentos.ler',
  'acompanhamentos.gerir',
  'clinico.ler',
  'clinico.registrar',
  'orcamentos.ler',
  'orcamentos.criar',
  'orcamentos.aceite',
  'orcamentos.cancelar',
  'precos.ler',
  'precos.editar',
  'precos.excecao',
  'descontos.solicitar',
  'descontos.aprovar',
  'cobrancas.ler',
  'cobrancas.gerir',
  'recebimentos.registrar',
  'recebimentos.corrigir',
  'recebimentos.estornar',
  'financeiro.ler',
  'financeiro.exportar',
  'despesas.ler',
  'despesas.gerir',
  'repasses.ler',
  'repasses.gerir',
  'equipe.ler',
  'equipe.convidar',
  'equipe.remover',
  'permissoes.gerir',
  'configuracoes.gerir',
  'auditoria.ler',
  'estoque.ler',
  'estoque.gerir',
  'estoque.ajustar',
  'kits.gerir',
  'materiais.confirmar',
  'unidades.consolidar',
] as const;

export type AccessPermission = (typeof ACCESS_PERMISSIONS)[number];
export type AccessScopeKind = 'nenhum' | 'proprio' | 'selecionados' | 'clinica';

const ALL_SCOPES = ['nenhum', 'proprio', 'selecionados', 'clinica'] as const;
const NO_OWN_SCOPES = ['nenhum', 'selecionados', 'clinica'] as const;
const CLINIC_ONLY_SCOPES = ['nenhum', 'clinica'] as const;
const OWN_ONLY_SCOPES = ['nenhum', 'proprio'] as const;

/** Fonte literal das chaves e escopos definidos no R-159. */
export const ACCESS_CATALOG = {
  'pacientes.ler': NO_OWN_SCOPES,
  'pacientes.editar': NO_OWN_SCOPES,
  'agenda.ler': ALL_SCOPES,
  'agenda.editar': ALL_SCOPES,
  'agenda.confirmar': ALL_SCOPES,
  'contatos.whatsapp': ALL_SCOPES,
  'acompanhamentos.ler': ALL_SCOPES,
  'acompanhamentos.gerir': ALL_SCOPES,
  'clinico.ler': ALL_SCOPES,
  'clinico.registrar': OWN_ONLY_SCOPES,
  'orcamentos.ler': ALL_SCOPES,
  'orcamentos.criar': ALL_SCOPES,
  'orcamentos.aceite': ALL_SCOPES,
  'orcamentos.cancelar': ALL_SCOPES,
  'precos.ler': CLINIC_ONLY_SCOPES,
  'precos.editar': CLINIC_ONLY_SCOPES,
  'precos.excecao': ALL_SCOPES,
  'descontos.solicitar': ALL_SCOPES,
  'descontos.aprovar': ALL_SCOPES,
  'cobrancas.ler': ALL_SCOPES,
  'cobrancas.gerir': ALL_SCOPES,
  'recebimentos.registrar': ALL_SCOPES,
  'recebimentos.corrigir': ALL_SCOPES,
  'recebimentos.estornar': ALL_SCOPES,
  'financeiro.ler': ALL_SCOPES,
  'financeiro.exportar': ALL_SCOPES,
  'despesas.ler': ALL_SCOPES,
  'despesas.gerir': ALL_SCOPES,
  'repasses.ler': ALL_SCOPES,
  'repasses.gerir': ALL_SCOPES,
  'equipe.ler': CLINIC_ONLY_SCOPES,
  'equipe.convidar': CLINIC_ONLY_SCOPES,
  'equipe.remover': CLINIC_ONLY_SCOPES,
  'permissoes.gerir': CLINIC_ONLY_SCOPES,
  'configuracoes.gerir': CLINIC_ONLY_SCOPES,
  'auditoria.ler': CLINIC_ONLY_SCOPES,
  'estoque.ler': ALL_SCOPES,
  'estoque.gerir': ALL_SCOPES,
  'estoque.ajustar': ALL_SCOPES,
  'kits.gerir': ALL_SCOPES,
  'materiais.confirmar': ALL_SCOPES,
  'unidades.consolidar': CLINIC_ONLY_SCOPES,
} as const satisfies Record<AccessPermission, readonly AccessScopeKind[]>;

export const AccessPermissionSchema = z.enum(ACCESS_PERMISSIONS);
const UuidSchema = z.string().uuid().transform((id) => id.toLowerCase());

const SelectedScopeSchema = z.strictObject({
  tipo: z.literal('selecionados'),
  dentistaIds: z.array(UuidSchema).min(1).max(200).superRefine((dentistaIds, context) => {
    if (new Set(dentistaIds).size !== dentistaIds.length) {
      context.addIssue({ code: 'custom', message: 'Profissionais selecionados não podem se repetir.' });
    }
  }),
});

export const AccessScopeSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('nenhum') }),
  z.strictObject({ tipo: z.literal('proprio') }),
  SelectedScopeSchema,
  z.strictObject({ tipo: z.literal('clinica') }),
]);

export type AccessScope = z.infer<typeof AccessScopeSchema>;

export const AccessSchema = z.strictObject({
  permissao: AccessPermissionSchema,
  escopo: AccessScopeSchema,
}).superRefine((acesso, context) => {
  const allowedScopes: readonly AccessScopeKind[] = ACCESS_CATALOG[acesso.permissao];
  if (!allowedScopes.includes(acesso.escopo.tipo)) {
    context.addIssue({
      code: 'custom',
      path: ['escopo', 'tipo'],
      message: `O escopo ${acesso.escopo.tipo} não é permitido para ${acesso.permissao}.`,
    });
  }
});

export type Access = z.infer<typeof AccessSchema>;

/** Uma configuração vazia é válida e não concede nenhuma operação. */
export const AccessCollectionSchema = z.array(AccessSchema).superRefine((acessos, context) => {
  const permissions = new Set<AccessPermission>();

  acessos.forEach((acesso, index) => {
    if (permissions.has(acesso.permissao)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'permissao'],
        message: `A permissão ${acesso.permissao} não pode se repetir.`,
      });
    }
    permissions.add(acesso.permissao);
  });
});

/**
 * Compara a abrangência de escopos exclusivamente para recursos cujo alvo é um profissional.
 * O identificador profissional do ator é necessário para resolver `proprio`.
 * Não use para acompanhamentos/tarefas (cujo próprio é `responsavel_usuario_id`),
 * nem como enforcement ou delegação de acesso entre atores.
 */
export function professionalScopeContains(
  granted: AccessScope,
  requested: AccessScope,
  actorDentistId: string | null,
): boolean {
  const actorId = actorDentistId?.toLowerCase() ?? null;
  if (granted.tipo === 'nenhum' || requested.tipo === 'nenhum') return false;
  if (requested.tipo === 'proprio' && !actorId) return false;

  if (granted.tipo === 'clinica') return true;
  if (requested.tipo === 'clinica') return false;

  if (granted.tipo === 'selecionados') {
    if (requested.tipo === 'proprio') {
      return actorId !== null && granted.dentistaIds.includes(actorId);
    }
    return requested.dentistaIds.every((dentistaId) => granted.dentistaIds.includes(dentistaId));
  }

  if (!actorId) return false;
  if (requested.tipo === 'proprio') return true;

  return requested.dentistaIds.length === 1 && requested.dentistaIds[0] === actorId;
}
