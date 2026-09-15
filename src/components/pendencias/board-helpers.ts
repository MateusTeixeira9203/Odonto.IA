import type { PendenciaCard, PendenciaTipo } from '@/server/pendencias/contracts';
import { hojeBRT } from '@/lib/hora-brt';
export type ContactFilter = 'todos' | PendenciaTipo;
export const CONTACT_LABELS: Record<PendenciaTipo, string> = { confirmar_presenca: 'Confirmar presença', reativar_paciente: 'Reativar contatos' };
export function filterContacts(items: PendenciaCard[], filter: ContactFilter, search: string): PendenciaCard[] {
  const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  return items.filter(item => (filter === 'todos' || item.tipo === filter) && normalized(item.pacienteNome).includes(normalized(search.trim())));
}
export function contactDate(item: PendenciaCard, now = new Date()): string {
  if (item.dataHora) {
    const date = new Date(item.dataHora);
    const tomorrow = hojeBRT(new Date(now.getTime() + 86400000));
    const day = hojeBRT(date) === tomorrow ? 'Amanhã' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(date);
    return `${day}, ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(date)}`;
  }
  if (!item.ultimaVisitaEm) return 'Sem retorno marcado';
  const days = Math.max(0, Math.round((Date.parse(`${hojeBRT(now)}T12:00:00Z`) - Date.parse(`${item.ultimaVisitaEm}T12:00:00Z`)) / 86400000));
  return `Há ${days} dias sem atendimento`;
}
export function safeWhatsappUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'wa.me' && !url.port && !url.username && !url.password && /^\/\d{10,15}$/.test(url.pathname); } catch { return false; }
}
export function clinicInputDatetime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  if (Number.isNaN(date.getTime()) || hojeBRT(date) !== value.slice(0, 10)) return null;
  return date.toISOString();
}
