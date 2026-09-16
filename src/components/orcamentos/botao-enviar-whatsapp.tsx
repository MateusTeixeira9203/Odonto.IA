'use client';
import { FileDown, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useOrcamentoWhatsApp } from '@/hooks/use-orcamento-whatsapp';

interface BotaoEnviarWhatsAppProps {
  orcamentoId: string;
  pacienteTelefone: string | null | undefined;
  pacienteNome: string;
  valorTotal: number | null;
  variant?: 'icon' | 'full';
}

export function BotaoEnviarWhatsApp({ orcamentoId, variant = 'icon' }: BotaoEnviarWhatsAppProps) {
  const flow = useOrcamentoWhatsApp(orcamentoId);
  const labelId = useId();
  return <>
    <Button variant="ghost" size={variant === 'full' ? 'lg' : 'icon'}
      className={variant === 'full' ? 'w-full justify-start text-primary' : 'text-muted-foreground hover:text-primary'}
      aria-label="Enviar orçamento pelo WhatsApp" title="Enviar orçamento pelo WhatsApp"
      onClick={() => void flow.prepare()}>
      <MessageCircle className="size-4" />{variant === 'full' && 'Enviar por WhatsApp'}
    </Button>
    <Dialog open={flow.open} onOpenChange={flow.changeOpen}>
      <DialogContent className="bg-card text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar orçamento</DialogTitle>
          <DialogDescription>Confira a mensagem e envie o arquivo ao paciente pelo WhatsApp.</DialogDescription>
        </DialogHeader>
        {flow.loading && <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparando PDF…</p>}
        {flow.error && <div role="alert" className="space-y-3"><p>{flow.error}</p><Button variant="outline" onClick={() => void flow.prepare()}>Tentar novamente</Button></div>}
        {flow.prepared && <>
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium">{flow.prepared.metadata.pacienteNome}</p>
            <p className="text-muted-foreground">{flow.prepared.metadata.pacienteTelefone ?? 'Telefone não cadastrado'}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor={labelId} className="font-medium">Mensagem</label>
            <Textarea id={labelId} value={flow.message} onChange={(event) => flow.setMessage(event.target.value)} maxLength={2000} rows={4} disabled={flow.saving || flow.sharing} />
          </div>
          {!flow.url && <p role="alert" className="text-muted-foreground">Confira o telefone no cadastro do paciente e preencha a mensagem para continuar.</p>}
          <div className="grid gap-2">
            {flow.canShare && <Button size="lg" disabled={!flow.url || flow.sharing || flow.saving} onClick={() => void flow.share()}><Share2 />Compartilhar PDF e mensagem</Button>}
            <Button variant={flow.canShare ? 'outline' : 'default'} size="lg" disabled={!flow.url || flow.sharing || flow.saving} onClick={flow.downloadAndOpen}><FileDown />Baixar PDF e abrir WhatsApp</Button>
          </div>
          <p className="text-sm text-muted-foreground">No computador, anexe o PDF baixado à conversa. No compartilhamento do celular, escolha o WhatsApp e confira o destinatário.</p>
          {flow.attempted && <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
            <p>Você enviou a mensagem com o PDF?</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void flow.confirm()} disabled={flow.saving || flow.sharing}>{flow.saving ? 'Registrando…' : 'Enviei'}</Button>
              <Button variant="outline" onClick={() => flow.changeOpen(false)} disabled={flow.saving || flow.sharing}>Não enviei</Button>
              {flow.url && <a href={flow.url} target="_blank" rel="noopener noreferrer" className="self-center text-primary underline">Abrir WhatsApp</a>}
            </div>
          </div>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
