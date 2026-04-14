"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/ui/help-tip";
import { toast } from "sonner";
import { Loader2, Clock, Bell, Save, MessageCircle } from "lucide-react";
import { salvarBotConfig, type BotConfigForm } from "../actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Campos exibidos na UI — subconjunto de BotConfigForm. */
interface BotConfigUI {
  reminder_enabled:    boolean;
  reminder_hours:      number;
  reminder_message:    string;
  welcome_message:     string;
  working_hours_start: string;
  working_hours_end:   string;
}

interface AbaConfiguracoesProps {
  /** Aceita BotConfigForm (inclui campos ocultos que são preservados ao salvar). */
  initialConfig: BotConfigForm | null;
}

// ─── Toggle interno ───────────────────────────────────────────────────────────

function ToggleTeal({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-9 w-[72px] shrink-0 cursor-pointer items-center
        rounded-full border-2 transition-colors duration-300 ease-in-out
        focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[--color-teal]/30
        ${checked
          ? "border-[--color-teal] bg-[--color-teal]"
          : "border-border bg-surface-alt"
        }
      `}
    >
      <span
        className={`
          pointer-events-none block h-7 w-7 rounded-full bg-white shadow-lg
          ring-0 transition-transform duration-300 ease-in-out
          ${checked ? "translate-x-[38px]" : "translate-x-1"}
        `}
      />
    </button>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AbaConfiguracoes({ initialConfig }: AbaConfiguracoesProps) {
  const [saving, setSaving] = useState(false);

  // Apenas os campos visíveis na UI
  const [config, setConfig] = useState<BotConfigUI>({
    reminder_enabled:    initialConfig?.reminder_enabled    ?? true,
    reminder_hours:      initialConfig?.reminder_hours      ?? 24,
    reminder_message:    initialConfig?.reminder_message    ??
      "Olá {nome}! 👋\n\nLembramos que você tem uma consulta agendada para {data} às {hora}.\n\nConfirme sua presença respondendo CONFIRMO.\n\nAté breve! 😊",
    welcome_message:     initialConfig?.welcome_message     ??
      "Olá! Sou a assistente virtual da clínica. Como posso ajudar?",
    working_hours_start: initialConfig?.working_hours_start ?? "08:00",
    working_hours_end:   initialConfig?.working_hours_end   ?? "18:00",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preserva campos ocultos (whatsapp_number, transfer_to_human_enabled)
      const fullConfig: BotConfigForm = {
        whatsapp_number:           initialConfig?.whatsapp_number           ?? "",
        transfer_to_human_enabled: initialConfig?.transfer_to_human_enabled ?? true,
        ...config,
      };
      const result = await salvarBotConfig(fullConfig);
      if (result.ok) {
        toast.success("Configurações salvas com sucesso!");
      } else {
        toast.error(result.erro ?? "Erro ao salvar");
      }
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* ── Card: Lembretes ──────────────────────────────────────────────── */}
      <div className="bg-[--color-surface] rounded-3xl border border-[--color-border] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-teal]/10">
              <Bell className="h-6 w-6 text-[--color-teal]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[--color-text-primary]">
                  Lembretes Automáticos
                </h3>
                <HelpTip text="Pacientes recebem um lembrete automático antes da consulta." />
              </div>
              <p className="text-sm text-[--color-text-secondary] mt-1">
                Enviar lembrete antes das consultas agendadas
              </p>
            </div>
          </div>
          <ToggleTeal
            id="reminder-toggle"
            checked={config.reminder_enabled}
            onChange={v => setConfig(prev => ({ ...prev, reminder_enabled: v }))}
          />
        </div>

        <div
          className={`mt-8 space-y-6 transition-all duration-300 ${
            config.reminder_enabled ? "opacity-100" : "opacity-40 pointer-events-none"
          }`}
        >
              <div>
                <Label
                  htmlFor="reminder-hours"
                  className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary] mb-2"
                >
                  <Clock className="h-4 w-4 text-[--color-teal]" />
                  Horas antes da consulta
                </Label>
                <Input
                  id="reminder-hours"
                  type="number"
                  min={1}
                  max={72}
                  value={config.reminder_hours}
                  onChange={e =>
                    setConfig(prev => ({
                      ...prev,
                      reminder_hours: Math.max(1, Math.min(72, parseInt(e.target.value) || 24)),
                    }))
                  }
                  className="w-28 h-12 text-lg rounded-xl bg-[--color-surface-alt] border-[--color-border]
                    focus:border-[--color-teal] focus:ring-[--color-teal]/20"
                />
                <p className="text-xs text-[--color-text-secondary] mt-2">
                  Recomendado: 24 horas
                </p>
              </div>

              <div>
                <Label
                  htmlFor="reminder-message"
                  className="text-sm font-medium text-[--color-text-primary] mb-2 block"
                >
                  Mensagem do lembrete
                </Label>
                <Textarea
                  id="reminder-message"
                  rows={5}
                  value={config.reminder_message}
                  onChange={e => setConfig(prev => ({ ...prev, reminder_message: e.target.value }))}
                  className="rounded-xl bg-[--color-surface-alt] border-[--color-border]
                    focus:border-[--color-teal] focus:ring-[--color-teal]/20 text-base leading-relaxed resize-none"
                  placeholder="Digite a mensagem de lembrete..."
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[--color-text-secondary]">Variáveis:</span>
                  {["{nome}", "{data}", "{hora}"].map(v => (
                    <code
                      key={v}
                      className="text-xs font-mono bg-[--color-teal]/10 text-[--color-teal] px-2 py-1 rounded-lg"
                    >
                      {v}
                    </code>
                  ))}
                </div>
              </div>
        </div>
      </div>

      {/* ── Card: Mensagem de Boas-vindas ────────────────────────────────── */}
      <div className="bg-[--color-surface] rounded-3xl border border-[--color-border] p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-teal]/10">
            <MessageCircle className="h-6 w-6 text-[--color-teal]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[--color-text-primary]">
                Mensagem de Boas-vindas
              </h3>
              <HelpTip text="Enviada quando um novo paciente entra em contato pela primeira vez." />
            </div>
            <p className="text-sm text-[--color-text-secondary] mt-1">
              Primeira mensagem enviada ao paciente
            </p>
          </div>
        </div>
        <Textarea
          id="welcome-message"
          rows={4}
          value={config.welcome_message}
          onChange={e => setConfig(prev => ({ ...prev, welcome_message: e.target.value }))}
          className="rounded-xl bg-[--color-surface-alt] border-[--color-border]
            focus:border-[--color-teal] focus:ring-[--color-teal]/20 text-base leading-relaxed resize-none"
          placeholder="Digite a mensagem de boas-vindas..."
        />
      </div>

      {/* ── Card: Horário de Funcionamento ───────────────────────────────── */}
      <div className="bg-[--color-surface] rounded-3xl border border-[--color-border] p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--color-teal]/10">
            <Clock className="h-6 w-6 text-[--color-teal]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[--color-text-primary]">
                Horário de Funcionamento
              </h3>
              <HelpTip text="Fora deste horário, o bot informa que a clínica está fechada." />
            </div>
            <p className="text-sm text-[--color-text-secondary] mt-1">
              Define quando o bot atende automaticamente
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label
              htmlFor="start-time"
              className="text-sm font-medium text-[--color-text-secondary] mb-2 block"
            >
              Início
            </Label>
            <Input
              id="start-time"
              type="time"
              value={config.working_hours_start}
              onChange={e => setConfig(prev => ({ ...prev, working_hours_start: e.target.value }))}
              className="h-12 text-lg rounded-xl bg-[--color-surface-alt] border-[--color-border]
                focus:border-[--color-teal] focus:ring-[--color-teal]/20 font-mono"
            />
          </div>
          <div>
            <Label
              htmlFor="end-time"
              className="text-sm font-medium text-[--color-text-secondary] mb-2 block"
            >
              Fim
            </Label>
            <Input
              id="end-time"
              type="time"
              value={config.working_hours_end}
              onChange={e => setConfig(prev => ({ ...prev, working_hours_end: e.target.value }))}
              className="h-12 text-lg rounded-xl bg-[--color-surface-alt] border-[--color-border]
                focus:border-[--color-teal] focus:ring-[--color-teal]/20 font-mono"
            />
          </div>
        </div>
      </div>

      {/* ── Botão salvar ─────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="bg-[--color-teal] hover:bg-[--color-teal-dark] text-white
            text-base font-semibold px-8 py-6 rounded-2xl shadow-lg
            shadow-[--color-teal]/20 transition-all duration-200
            disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </motion.div>
  );
}
