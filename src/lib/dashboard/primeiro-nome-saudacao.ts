/** Primeiro nome de exibição; o tratamento cadastrado não participa da saudação. */
export function primeiroNomeSaudacao(nome: string): string {
  return nome.trim().replace(/^(?:dra|dr)(?:\.\s*|\s+|$)/i, '').trim().split(/\s+/)[0] ?? '';
}
