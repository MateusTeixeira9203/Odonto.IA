import type { Access, AccessPermission, AccessScope } from './access-catalog';

export const ESTOQUE_ACCESS_PERMISSIONS = [
  'estoque.ler',
  'estoque.gerir',
  'estoque.receber',
  'estoque.consumir',
  'estoque.descartar',
  'estoque.ajustar',
  'kits.gerir',
  'materiais.confirmar',
] as const satisfies readonly AccessPermission[];

export type EstoqueAccessPermission = (typeof ESTOQUE_ACCESS_PERMISSIONS)[number];

export type EstoqueTitular =
  | { tipo: 'clinica' }
  | { tipo: 'dentista'; dentistaId: string };

/**
 * Resolve escopos contra o titular do estoque, não contra a abrangência clínica comum.
 * `clinica` dá acesso apenas ao estoque compartilhado; nunca aos itens pessoais.
 */
export function estoqueScopeAllowsTitular(
  scope: AccessScope,
  titular: EstoqueTitular,
  actorDentistId: string | null,
): boolean {
  if (scope.tipo === 'nenhum') return false;

  if (titular.tipo === 'clinica') return scope.tipo === 'clinica';

  const titularDentistId = titular.dentistaId.toLowerCase();
  if (scope.tipo === 'selecionados') return scope.dentistaIds.includes(titularDentistId);
  if (scope.tipo !== 'proprio') return false;

  const actorId = actorDentistId?.toLowerCase() ?? null;
  return actorId !== null && actorId === titularDentistId;
}

function hasPermissionForTitular(
  accesses: readonly Access[],
  permission: EstoqueAccessPermission,
  titular: EstoqueTitular,
  actorDentistId: string | null,
): boolean {
  return accesses.some((access) =>
    access.permissao === permission
    && estoqueScopeAllowsTitular(access.escopo, titular, actorDentistId),
  );
}

/**
 * Toda mutação exige leitura no mesmo titular. A identidade de dentista deve vir de um
 * contexto de membro já autenticado; esta função não concede nem persiste acessos.
 */
export function estoquePermissionAllows(
  accesses: readonly Access[],
  permission: EstoqueAccessPermission,
  titular: EstoqueTitular,
  actorDentistId: string | null,
): boolean {
  if (!hasPermissionForTitular(accesses, 'estoque.ler', titular, actorDentistId)) return false;
  return permission === 'estoque.ler'
    || hasPermissionForTitular(accesses, permission, titular, actorDentistId);
}
