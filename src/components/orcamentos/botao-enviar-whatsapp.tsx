"use client";

import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { atualizarStatusOrcamento } from "@/app/dashboard/orcamentos/actions";

interface BotaoEnviarWhatsAppProps {
  orcamentoId: string;
  pacienteTelefone: string | null | undefined;
  pacienteNome: string;
  valorTotal: number | null;
  statusAtual?: string;
  /** "full" exibe botão largo com texto (usado nas ações rápidas da secretária) */
  variant?: 'icon' | 'full';
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
  statusAtual,
  variant = 'icon',
}: BotaoEnviarWhatsAppProps) {
  const router = useRouter();

  async function handleEnviar() {
    if (!pacienteTelefone) {
      toast.error("Paciente não possui telefone cadastrado");
      return;
    }

    const telefoneFormatado = formatarTelefone(pacienteTelefone);
    const valorFormatado = formatarMoeda(valorTotal ?? 0);
    const codigoOrc = orcamentoId.slice(0, 8).toUpperCase();

    const pdfUrl = `${window.location.origin}/api/orcamentos/${orcamentoId}/pdf`;

    const mensagem = encodeURIComponent(
      `Olá ${pacienteNome}! 👋\n\n` +
        `Segue o orçamento #${codigoOrc} no valor de ${valorFormatado}.\n\n` +
        `📄 Acesse o PDF aqui: ${pdfUrl}\n\n` +
        `Qualquer dúvida, estamos à disposição! 😊\n\n` +
        `_Enviado via Odonto.IA_`
    );

    window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, "_blank");

    // Muda status para "enviado" se ainda estiver em rascunho
    if (!statusAtual || statusAtual === 'rascunho') {
      const result = await atualizarStatusOrcamento(orcamentoId, 'enviado');
      if (!result.error) {
        toast.success("WhatsApp aberto e orçamento marcado como enviado!");
        router.refresh();
      } else {
        toast.success("WhatsApp aberto! Envie a mensagem para o paciente.");
      }
    } else {
      toast.success("WhatsApp aberto! Envie a mensagem para o paciente.");
    }
  }

  const semTelefone = !pacienteTelefone;

  if (variant === 'full') {
    return (
      <button
        onClick={() => void handleEnviar()}
        disabled={semTelefone}
        className="flex items-center gap-3 px-4 py-3 bg-teal/10 hover:bg-teal/20 border border-teal/20 text-teal rounded-xl text-sm font-semibold transition-all disabled:opacity-50 w-full"
        title={semTelefone ? "Paciente sem telefone cadastrado" : "Enviar por WhatsApp"}
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        Enviar por WhatsApp
        {semTelefone && <span className="ml-auto text-[10px] font-normal text-text-secondary">sem telefone</span>}
      </button>
    );
  }

  return (
    <button
      onClick={() => void handleEnviar()}
      disabled={semTelefone}
      className="p-2 rounded-xl hover:bg-teal/10 transition-colors text-text-secondary hover:text-teal disabled:opacity-40"
      title={semTelefone ? "Paciente sem telefone cadastrado" : "Enviar por WhatsApp"}
    >
      <MessageCircle className="w-4 h-4" />
    </button>
  );
}
