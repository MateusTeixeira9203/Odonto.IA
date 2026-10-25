export function dentistaDoEscopoDaAgenda(
  role: string | null | undefined,
  dentistaId: string,
): string | null {
  return role === 'secretaria' ? null : dentistaId;
}
