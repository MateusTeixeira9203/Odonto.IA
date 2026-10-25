/** Os dois caminhos de conclusão de encaminhados exigem o próprio destinatário. */
export function concluidoPor(
  eventos: readonly { status: string; encaminhadoParaNome: string | null }[],
  autorVisita: string,
): string | null {
  return eventos.find(e => e.status === 'realizado' && e.encaminhadoParaNome && e.encaminhadoParaNome !== autorVisita)
    ?.encaminhadoParaNome ?? null;
}
