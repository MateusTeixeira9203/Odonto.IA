/** Somente o proprietário da clínica ativa pode alterar sua configuração de cobrança. */
export function papelPodeAlterarPlano(role: string | null | undefined): boolean {
  return role === 'admin';
}

export const MSG_SEM_PERMISSAO_PLANO =
  'Só o administrador da clínica pode escolher ou mudar o plano.';
