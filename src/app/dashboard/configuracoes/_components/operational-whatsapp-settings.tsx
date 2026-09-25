'use client';

import { useActionState } from 'react';
import { MessageCircle, Save } from 'lucide-react';

import { saveOperationalWhatsAppTemplates, type WhatsAppTemplateState } from '@/app/consultorio/whatsapp-actions';
import type { WhatsAppTemplates } from '@/lib/whatsapp/operational-templates';

const initialState: WhatsAppTemplateState = { ok: false, message: '' };

const fields: Array<{ key: keyof WhatsAppTemplates; label: string; description: string }> = [
  { key: 'confirmacao', label: 'Confirmação', description: 'Quando o atendimento é confirmado.' },
  { key: 'lembrete_24h', label: 'Lembrete de 24 horas', description: 'Para o dia anterior ao atendimento.' },
  { key: 'reativacao', label: 'Reativação', description: 'Para pacientes que precisam retomar o cuidado.' },
  { key: 'orcamento', label: 'Orçamento', description: 'Para dúvidas ou retomada de um planejamento.' },
  { key: 'cobranca', label: 'Cobrança', description: 'Para uma pendência em aberto.' },
];

export function OperationalWhatsAppSettings({ templates }: { templates: WhatsAppTemplates }): React.JSX.Element {
  const [state, action, pending] = useActionState(saveOperationalWhatsAppTemplates, initialState);

  return (
    <form action={action} className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
          <MessageCircle className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Mensagens manuais do WhatsApp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estes textos preenchem a conversa. O envio continua manual no WhatsApp e não é marcado como enviado pelo sistema.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Use <code className="font-mono text-foreground">{'{{nome_paciente}}'}</code> e <code className="font-mono text-foreground">{'{{nome_clinica}}'}</code> para personalizar a mensagem.
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label, description }) => (
          <label key={key} className="block space-y-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">{description}</span>
            </span>
            <textarea
              name={key}
              defaultValue={templates[key]}
              required
              minLength={10}
              maxLength={1000}
              rows={3}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>
        ))}
      </div>

      {state.message && (
        <p role="status" className={state.ok ? 'text-sm font-medium text-teal' : 'text-sm font-medium text-destructive'}>
          {state.message}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-5">
        <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60">
          <Save className="size-4" aria-hidden="true" />
          {pending ? 'Salvando...' : 'Salvar modelos'}
        </button>
      </div>
    </form>
  );
}
