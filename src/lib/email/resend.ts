import { Resend } from 'resend';

// Lazy — instancia apenas quando chamado, evita erro de módulo se RESEND_API_KEY estiver vazia
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(key);
  }
  return _resend;
}
