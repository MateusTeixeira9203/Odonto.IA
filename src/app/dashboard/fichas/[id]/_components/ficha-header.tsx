"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/dentai";
import { Button } from "@/components/ui/button";

interface FichaHeaderProps {
  pacienteId: string;
  pacienteNome: string;
  dataFormatada: string;
  status: "aberta" | "concluida";
  concluindoFicha: boolean;
  onStatusChange: (status: "aberta" | "concluida") => void;
}

export function FichaHeader({
  pacienteId,
  pacienteNome,
  dataFormatada,
  status,
  concluindoFicha,
  onStatusChange,
}: FichaHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <Link href={`/dashboard/pacientes/${pacienteId}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={15} />
          Paciente
        </Button>
      </Link>

      <div className="flex-1">
        <h1 className="font-serif text-2xl text-brand-black">Ficha de {pacienteNome}</h1>
        <p className="mt-0.5 font-mono text-xs text-brand-muted">{dataFormatada}</p>
      </div>

      <div className="relative inline-flex" title="Clique para alterar o status">
        <Badge variant={status === "aberta" ? "warning" : "success"}>
          {status === "aberta" ? "Aberta" : "Concluída"}
        </Badge>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as "aberta" | "concluida")}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          disabled={concluindoFicha}
        >
          <option value="aberta">Aberta</option>
          <option value="concluida">Concluída</option>
        </select>
      </div>
    </div>
  );
}
