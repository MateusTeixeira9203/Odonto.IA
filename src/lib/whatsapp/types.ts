// Tipos para a WhatsApp Business Cloud API (Meta)

export type WabaMessage = {
  object: 'whatsapp_business_account';
  entry: WabaEntry[];
};

export type WabaEntry = {
  id: string;
  changes: WabaChange[];
};

export type WabaChange = {
  value: WabaValue;
  field: 'messages';
};

export type WabaValue = {
  messaging_product: 'whatsapp';
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WabaContact[];
  messages?: WabaIncomingMessage[];
  statuses?: WabaStatus[];
};

export type WabaContact = {
  profile: { name: string };
  wa_id: string;
};

export type WabaIncomingMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'interactive' | 'button';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; filename: string; mime_type: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { payload: string; text: string };
};

export type WabaStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
};

export type OutboundTextMessage = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
};

export type InteractiveButton = {
  type: 'reply';
  reply: { id: string; title: string };
};

export type OutboundInteractiveMessage = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: { buttons: InteractiveButton[] };
  };
};

export type OutboundMessage = OutboundTextMessage | OutboundInteractiveMessage;

export type BotEstado =
  | 'inicio'
  | 'cadastro'
  | 'agendamento'
  | 'orcamento'
  | 'pagamento'
  | 'humano'
  | 'encerrado';

export type DadosColeta = {
  nome?: string;
  telefone?: string;
  data_nascimento?: string;
  dentista_id?: string;
  dentista_nome?: string;
  etapa_cadastro?: 'nome' | 'telefone' | 'nascimento' | 'concluido';
  data_agendamento?: string;
  hora_agendamento?: string;
  etapa_agendamento?: 'data' | 'hora' | 'confirmacao';
};
