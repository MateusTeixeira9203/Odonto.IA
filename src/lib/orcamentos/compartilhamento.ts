import { z } from 'zod';

export const PdfMetadataSchema = z.strictObject({
  clinicaId: z.string().uuid(), snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  pacienteNome: z.string().min(1), pacienteTelefone: z.string().nullable(),
});
export type PdfMetadata = z.infer<typeof PdfMetadataSchema>;

export function telefoneWhatsApp(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (!/^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(national)) return null;
  return `55${national}`;
}

export function mensagemOrcamento(pacienteNome: string): string {
  return `Olá, ${pacienteNome}! Aqui está seu orçamento. Qualquer dúvida, estamos à disposição.`;
}

export function linkWhatsApp(telefone: string, mensagem: string): string | null {
  const normalized = telefoneWhatsApp(telefone);
  if (!normalized || !mensagem.trim() || mensagem.length > 2000) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(mensagem.trim())}`;
}
