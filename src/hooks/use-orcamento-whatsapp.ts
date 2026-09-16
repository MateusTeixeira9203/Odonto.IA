'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { confirmarEnvioPdf } from '@/app/dashboard/orcamentos/compartilhar-actions';
import { linkWhatsApp, mensagemOrcamento, PdfMetadataSchema, type PdfMetadata } from '@/lib/orcamentos/compartilhamento';

type Prepared = { file: File; metadata: PdfMetadata };
export function useOrcamentoWhatsApp(orcamentoId: string) {
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function changeOpen(next: boolean) {
    if (saving || sharing) return;
    setOpen(next);
    if (!next) {
      request.current?.abort();
      setPrepared(null);
      setAttempted(false);
      setError(null);
      setMessage('');
    }
  }

  async function prepare() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setPrepared(null);
    setAttempted(false);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orcamentos/${orcamentoId}/pdf?download=1`, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('application/pdf')) throw new Error('pdf');
      const metadata = PdfMetadataSchema.parse(JSON.parse(decodeURIComponent(response.headers.get('x-documento-metadados') ?? '')));
      const blob = await response.blob();
      if (await blob.slice(0, 5).text() !== '%PDF-') throw new Error('pdf');
      if (controller.signal.aborted) return;
      setPrepared({ file: new File([blob], `orcamento-${orcamentoId.slice(0, 8)}.pdf`, { type: 'application/pdf' }), metadata });
      setMessage(mensagemOrcamento(metadata.pacienteNome));
    } catch {
      if (!controller.signal.aborted) setError('Não foi possível preparar o PDF. Confira seu acesso e tente novamente.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const url = prepared ? linkWhatsApp(prepared.metadata.pacienteTelefone ?? '', message) : null;
  let canShare = false;
  try { canShare = !!prepared && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [prepared.file] }); } catch { /* Fallback desktop continua disponível. */ }

  async function share() {
    if (!prepared || !url || sharing) return;
    setSharing(true);
    try {
      await navigator.share({ files: [prepared.file], text: message.trim(), title: 'Orçamento' });
      setAttempted(true);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        toast.error('Não foi possível compartilhar. Use baixar PDF e abrir WhatsApp.');
      }
    } finally { setSharing(false); }
  }

  function downloadAndOpen() {
    if (!prepared || !url) return;
    const objectUrl = URL.createObjectURL(prepared.file);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = prepared.file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    window.open(url, '_blank', 'noopener,noreferrer');
    setAttempted(true);
  }

  async function confirm() {
    if (!prepared || !attempted || saving) return;
    setSaving(true);
    try {
      const result = await confirmarEnvioPdf({ orcamentoId, clinicaId: prepared.metadata.clinicaId, snapshot: prepared.metadata.snapshot });
      if (result.ok) {
        toast.success('Envio manual registrado.');
        setOpen(false);
        setPrepared(null);
        setAttempted(false);
      } else toast.error(result.mensagem);
    } catch { toast.error('Não foi possível registrar. Tente novamente.'); }
    finally { setSaving(false); }
  }

  return { open, changeOpen, prepared, message, setMessage, loading, error, attempted, saving, sharing, prepare, canShare, share, downloadAndOpen, confirm, url };
}
