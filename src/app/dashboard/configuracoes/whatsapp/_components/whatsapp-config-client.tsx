"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, MessageCircle } from "lucide-react";
import { AbaConexao } from "./aba-conexao";
import { AbaConfiguracoes } from "./aba-configuracoes";
import type { BotConfigForm } from "../actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface InstanciaWhatsAppProps {
  instance_name: string;
  status: "disconnected" | "connecting" | "connected";
  qrcode?: string;
  phone_number?: string;
}

interface WhatsAppConfigClientProps {
  initialConfig: BotConfigForm | null;
  initialInstance: InstanciaWhatsAppProps | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WhatsAppConfigClient({
  initialConfig,
  initialInstance,
}: WhatsAppConfigClientProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-[--color-text-primary]">Bot WhatsApp</h1>
        <p className="text-[--color-text-secondary] mt-2">
          Configure o atendimento automático da sua clínica via WhatsApp
        </p>
      </div>

      {/* Abas */}
      <Tabs defaultValue="conexao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-surface-alt rounded-2xl border border-[--color-border]">
          <TabsTrigger
            value="conexao"
            className="flex items-center justify-center gap-2 rounded-xl text-base font-medium h-11 text-[--color-text-secondary] data-[state=active]:bg-[--color-surface] data-[state=active]:text-[--color-teal] data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-[--color-teal] transition-all"
          >
            <Wifi className="w-5 h-5" />
            Conexão
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="flex items-center justify-center gap-2 rounded-xl text-base font-medium h-11 text-[--color-text-secondary] data-[state=active]:bg-[--color-surface] data-[state=active]:text-[--color-teal] data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-b-[--color-teal] transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <AbaConexao initialInstance={initialInstance} />
        </TabsContent>

        <TabsContent value="config">
          <AbaConfiguracoes initialConfig={initialConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
