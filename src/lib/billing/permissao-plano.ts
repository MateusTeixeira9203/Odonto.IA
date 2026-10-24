export type PlanoClinica = 'SOLO' | 'CLINICA';

export function ehPlanoClinica(valor: unknown): valor is PlanoClinica {
  return valor === 'SOLO' || valor === 'CLINICA';
}

/** Somente o proprietário da clínica ativa pode alterar sua configuração de cobrança. */
export function papelPodeAlterarPlano(role: string | null | undefined): boolean {
  return role === 'admin';
}

export const MSG_SEM_PERMISSAO_PLANO =
  'Só o administrador da clínica pode escolher ou mudar o plano.';
