/**
 * Super-usuários têm plano CLINICA, status ATIVO e role admin garantidos,
 * ignorando qualquer verificação de banco ou Stripe.
 */
const SUPER_USERS = new Set<string>([]);

export function isSuperUser(email: string | null | undefined): boolean {
  return !!email && SUPER_USERS.has(email.toLowerCase());
}

export interface PlanoInfo {
  plano: 'CLINICA';
  status: 'ATIVO';
  role: 'admin';
}

export function getSuperUserPlano(): PlanoInfo {
  return { plano: 'CLINICA', status: 'ATIVO', role: 'admin' };
}
