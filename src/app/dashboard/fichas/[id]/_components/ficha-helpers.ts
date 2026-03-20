export const ARCADA_SUPERIOR = [
  "18",
  "17",
  "16",
  "15",
  "14",
  "13",
  "12",
  "11",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
] as const;

export const ARCADA_INFERIOR = [
  "48",
  "47",
  "46",
  "45",
  "44",
  "43",
  "42",
  "41",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
] as const;

export type EtapaStatus = "aberto" | "pendente" | "concluido";
export type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado";

export interface EtapaForm {
  titulo: string;
  dentes: string[];
  observacao: string;
  procedimento_id: string | null;
}

export const ETAPA_STATUS_LABEL: Record<EtapaStatus, string> = {
  aberto: "Aberto",
  pendente: "Pendente",
  concluido: "Concluído",
};

export function etapaStatusClassName(status: EtapaStatus): string {
  if (status === "concluido") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (status === "pendente") return "bg-primary/15 text-primary";
  return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
}

export function iniciais(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}
