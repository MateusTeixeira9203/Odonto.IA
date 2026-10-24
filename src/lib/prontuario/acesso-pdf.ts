export type AcessoPdf = 'completo' | 'administrativo' | 'negado';

/** Mesmo acesso clínico da tela; papéis ausentes ou desconhecidos são recusados. */
export function acessoPdfPorPapel(role: string | null | undefined): AcessoPdf {
  if (role === 'admin' || role === 'dentista') return 'completo';
  if (role === 'secretaria') return 'administrativo';
  return 'negado';
}
