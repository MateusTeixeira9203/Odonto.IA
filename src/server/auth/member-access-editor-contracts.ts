import { z } from 'zod';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionSchema = z.number().int().positive().max(2_147_483_647);

export const EDITOR_ACCESS_PERMISSIONS = [
  'agenda.ler', 'agenda.editar', 'agenda.confirmar',
  'pacientes.ler', 'pacientes.editar',
  'acompanhamentos.ler', 'acompanhamentos.gerir',
  'orcamentos.ler', 'contatos.whatsapp',
  'cobrancas.ler',
  'recebimentos.registrar', 'recebimentos.corrigir', 'recebimentos.estornar',
  'financeiro.ler', 'financeiro.exportar',
  'despesas.ler', 'despesas.gerir',
  'equipe.ler',
] as const;

const EditorAccessSchema = z.strictObject({
  permissao: z.enum(EDITOR_ACCESS_PERMISSIONS),
  escopo: z.strictObject({ tipo: z.literal('clinica') }),
});

function hasPermission(acessos: readonly EditorAccess[], permissao: EditorAccess['permissao']): boolean {
  return acessos.some((acesso) => acesso.permissao === permissao);
}

export type EditorAccess = z.infer<typeof EditorAccessSchema>;

export const EditorAccessCollectionSchema = z.array(EditorAccessSchema).superRefine((acessos, context) => {
  const found = new Set<string>();
  acessos.forEach((acesso, index) => {
    if (found.has(acesso.permissao)) {
      context.addIssue({ code: 'custom', path: [index, 'permissao'], message: 'A permissão não pode se repetir.' });
    }
    found.add(acesso.permissao);
  });

  const needs = (permission: EditorAccess['permissao'], dependency: EditorAccess['permissao']) => {
    if (hasPermission(acessos, permission) && !hasPermission(acessos, dependency)) {
      context.addIssue({ code: 'custom', message: `${permission} exige ${dependency}.` });
    }
  };
  needs('agenda.editar', 'agenda.ler');
  needs('agenda.confirmar', 'agenda.ler');
  needs('pacientes.editar', 'pacientes.ler');
  needs('acompanhamentos.gerir', 'acompanhamentos.ler');
  needs('recebimentos.registrar', 'cobrancas.ler');
  needs('recebimentos.corrigir', 'cobrancas.ler');
  needs('recebimentos.estornar', 'cobrancas.ler');
  needs('financeiro.exportar', 'financeiro.ler');
  needs('despesas.gerir', 'despesas.ler');
});

const EditorDetailSchema = z.strictObject({
  clinicaId: UuidSchema,
  membroId: UuidSchema,
  versao: VersionSchema,
  acessos: EditorAccessCollectionSchema,
});

export const DetailFailureCodeSchema = z.enum([
  'SEM_ACESSO', 'NAO_ENCONTRADO', 'NAO_SUPORTADO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL',
]);

export const DetailResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: EditorDetailSchema }),
  z.strictObject({ ok: z.literal(false), codigo: DetailFailureCodeSchema, mensagem: z.string() }),
]);

export type MemberAccessEditorDetail = z.infer<typeof EditorDetailSchema>;
export type MemberAccessEditorResult = z.infer<typeof DetailResultSchema>;

export const GetMemberAccessEditorSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  membroId: UuidSchema,
});

export const SaveMemberAccessEditorSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  membroId: UuidSchema,
  versaoEsperada: VersionSchema,
  acessos: EditorAccessCollectionSchema,
  motivo: z.string().trim().min(1).max(500),
  chaveIdempotencia: UuidSchema,
});
