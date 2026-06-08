"use client";

import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, RefreshCw } from "lucide-react";
import { salvarConexaoOficial } from "../actions";

interface AbaConexaoProps {
  initialConfig?: {
    waba_id?: string | null;
    phone_number_id?: string | null;
    access_token?: string | null;
    webhook_verify_token?: string | null;
    bot_ativo?: boolean | null;
  } | null;
}

function gerarToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function AbaConexao({ initialConfig }: AbaConexaoProps) {
  const [wabaId, setWabaId]             = useState(initialConfig?.waba_id ?? '');
  const [phoneNumberId, setPhoneNumberId] = useState(initialConfig?.phone_number_id ?? '');
  const [accessToken, setAccessToken]   = useState(initialConfig?.access_token ?? '');
  const [verifyToken, setVerifyToken]   = useState(initialConfig?.webhook_verify_token ?? '');
  const [botAtivo, setBotAtivo]         = useState(initialConfig?.bot_ativo ?? false);
  const [saving, setSaving]             = useState(false);
  const [copied, setCopied]             = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/whatsapp`;

  const gerarVerifyToken = useCallback(() => {
    setVerifyToken(gerarToken());
  }, []);

  const copiarWebhook = useCallback(async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [webhookUrl]);

  const handleSalvar = async () => {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID é obrigatório');
      return;
    }
    if (!accessToken.trim()) {
      toast.error('Access Token é obrigatório');
      return;
    }
    if (!verifyToken.trim()) {
      toast.error('Gere um Webhook Verify Token antes de salvar');
      return;
    }
    setSaving(true);
    try {
      const result = await salvarConexaoOficial({
        waba_id:              wabaId,
        phone_number_id:      phoneNumberId,
        access_token:         accessToken,
        webhook_verify_token: verifyToken,
        bot_ativo:            botAtivo,
      });
      if (result.ok) {
        toast.success('Configuração salva com sucesso!');
      } else {
        toast.error(result.erro ?? 'Erro ao salvar');
      }
    } catch {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Info card */}
      <div className="bg-surface rounded-3xl border border-border p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-1">WhatsApp Business Cloud API</h2>
          <p className="text-sm text-text-secondary">
            Configure as credenciais do seu app Meta Business para conectar o número oficial.
          </p>
        </div>

        {/* WABA ID */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-text-primary">
            WhatsApp Business Account ID
          </Label>
          <Input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            className="rounded-xl bg-surface-alt border-border"
            placeholder="123456789012345"
          />
        </div>

        {/* Phone Number ID */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-text-primary">
            Phone Number ID <span className="text-coral">*</span>
          </Label>
          <Input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            className="rounded-xl bg-surface-alt border-border"
            placeholder="109876543210987"
          />
        </div>

        {/* Access Token */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-text-primary">
            Access Token <span className="text-coral">*</span>
          </Label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="rounded-xl bg-surface-alt border-border"
            placeholder="EAAxxxxx..."
          />
        </div>

        {/* Verify Token */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-text-primary">
            Webhook Verify Token <span className="text-coral">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              value={verifyToken}
              readOnly
              className="rounded-xl bg-surface-alt border-border flex-1 font-mono text-sm"
              placeholder="Clique em Gerar..."
            />
            <button
              onClick={gerarVerifyToken}
              className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-surface-alt transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Gerar
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Cole este token no painel Meta Developers → Webhooks → Verify Token
          </p>
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-text-primary">URL do Webhook</Label>
          <div className="flex gap-2 items-center">
            <div className="flex-1 px-3 py-2.5 bg-surface-alt border border-border rounded-xl">
              <p className="text-xs font-mono text-text-primary break-all">{webhookUrl}</p>
            </div>
            <button
              onClick={() => void copiarWebhook()}
              className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-surface-alt transition-colors flex items-center gap-1.5 shrink-0"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-teal" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Cole esta URL no painel Meta Developers → Webhooks → Callback URL
          </p>
        </div>

        {/* Bot ativo toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <p className="text-sm font-semibold text-text-primary">Bot Ativo</p>
            <p className="text-xs text-text-secondary">Habilita respostas automáticas aos pacientes</p>
          </div>
          <button
            role="switch"
            aria-checked={botAtivo}
            onClick={() => setBotAtivo((v) => !v)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full border-2 transition-colors duration-200 focus-visible:outline-none ${
              botAtivo ? 'border-teal bg-teal' : 'border-border bg-surface-alt'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                botAtivo ? 'translate-x-[30px]' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <Button
        onClick={() => void handleSalvar()}
        disabled={saving}
        size="lg"
        className="w-full bg-teal hover:bg-teal-lt text-white text-base font-semibold rounded-2xl py-6 shadow-lg shadow-teal/20 transition-all"
      >
        {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Salvar Configuração
      </Button>
    </motion.div>
  );
}
