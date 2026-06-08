"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wifi, MessageCircle } from "lucide-react";
import { AbaConexao } from "./aba-conexao";
import { AbaConfiguracoes } from "./aba-configuracoes";
import type { BotConfigForm } from "../actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WhatsAppConfigClientProps {
  initialConfig: BotConfigForm | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WhatsAppConfigClient({
  initialConfig,
}: WhatsAppConfigClientProps) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">Bot WhatsApp</h1>
        <p className="text-text-secondary text-sm font-medium mt-1">
          Configure o atendimento automático da sua clínica via WhatsApp
        </p>
      </div>

      {/* Abas */}
      <Tabs defaultValue="conexao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-surface-alt rounded-2xl border border-border">
          <TabsTrigger
            value="conexao"
            className="flex items-center justify-center gap-2 rounded-xl text-sm font-semibold h-11 text-text-secondary data-[state=active]:bg-surface data-[state=active]:text-teal data-[state=active]:shadow-md transition-all"
          >
            <Wifi className="w-4 h-4" />
            Conexão
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="flex items-center justify-center gap-2 rounded-xl text-sm font-semibold h-11 text-text-secondary data-[state=active]:bg-surface data-[state=active]:text-teal data-[state=active]:shadow-md transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <AbaConexao initialConfig={initialConfig} />
        </TabsContent>

        <TabsContent value="config">
          <AbaConfiguracoes initialConfig={initialConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
