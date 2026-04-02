"use client";

import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface BotaoEnviarWhatsAppProps {
  orcamentoId: string;
  pacienteTelefone: string | null | undefined;
  pacienteNome: string;
  valorTotal: number | null;
}

function formatarTelefone(telefone: string): string {
  const numeros = telefone.replace(/\D/g, "");
  if (numeros.startsWith("55") && numeros.length >= 12) return numeros;
  return `55${numeros}`;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BotaoEnviarWhatsApp({
  orcamentoId,
  pacienteTelefone,
  pacienteNome,
  valorTotal,
}: BotaoEnviarWhatsAppProps) {
  function handleEnviar() {
    if (!pacienteTelefone) {
      toast.error("Paciente não possui telefone cadastrado");
      return;
    }

    const telefoneFormatado = formatarTelefone(pacienteTelefone);
    const valorFormatado = formatarMoeda(valorTotal ?? 0);
    const codigoOrc = orcamentoId.slice(0, 8).toUpperCase();

    const mensagem = encodeURIComponent(
      `Olá ${pacienteNome}! 👋\n\n` +
        `Segue o orçamento #${codigoOrc} no valor de ${valorFormatado}.\n\n` +
        `Você pode visualizar e baixar o PDF do orçamento acessando sua área do paciente.\n\n` +
        `Qualquer dúvida, estamos à disposição! 😊\n\n` +
        `_Enviado via Dent IA_`
    );

    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");
    toast.success("WhatsApp aberto! Envie a mensagem para o paciente.");
  }

  const semTelefone = !pacienteTelefone;

  return (
    <button
      onClick={handleEnviar}
      disabled={semTelefone}
      className="p-2 rounded-xl hover:bg-green-500/10 transition-colors text-muted-foreground hover:text-green-600 disabled:opacity-40"
      title={semTelefone ? "Paciente sem telefone cadastrado" : "Enviar por WhatsApp"}
    >
      <MessageCircle className="w-4 h-4" />
    </button>
  );
}
