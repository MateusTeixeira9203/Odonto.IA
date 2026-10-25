/** Sem o instante de criação, não é seguro liberar um item de uma ficha assinada. */
export function travadoPelaAssinaturaDaFicha(fichaAssinadoEm: string | null, criadoEm: string | null): boolean {
  if (!fichaAssinadoEm) return false;
  const assinatura = Date.parse(fichaAssinadoEm);
  const criacao = criadoEm ? Date.parse(criadoEm) : NaN;
  return !Number.isFinite(assinatura) || !Number.isFinite(criacao) || criacao <= assinatura;
}
