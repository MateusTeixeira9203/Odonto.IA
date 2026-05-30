export type CommunicationAction = 'confirm' | 'reminder' | 'reschedule' | 'followup';

export interface CommPayload {
  pacienteNome: string;
  pacienteTelefone?: string | null;
  dataHoraFormatada?: string;
}

export interface CommResult {
  ok: boolean;
  message: string;
}

const MOCK_LABELS: Record<CommunicationAction, (nome: string) => string> = {
  confirm:    (nome) => `Confirmação de consulta enviada para ${nome}.`,
  reminder:   (nome) => `Lembrete enviado para ${nome}.`,
  reschedule: (nome) => `Solicitação de reagendamento enviada para ${nome}.`,
  followup:   (nome) => `Follow-up pós-consulta enviado para ${nome}.`,
};

// Provider oficial será conectado — mock por enquanto.
export async function sendCommunication(
  action: CommunicationAction,
  payload: CommPayload,
): Promise<CommResult> {
  await new Promise<void>(r => setTimeout(r, 500));
  return { ok: true, message: MOCK_LABELS[action](payload.pacienteNome) };
}
