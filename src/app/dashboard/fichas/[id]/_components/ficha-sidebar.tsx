"use client";

import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FichaSectionLabel } from "./ficha-shared";

interface FichaSidebarProps {
  paciente: {
    id: string;
    nome: string;
    telefone: string | null;
    whatsapp: string | null;
  };
  dentista: {
    nome: string;
    especialidade: string | null;
  };
  dataFormatada: string;
  iniciaisPaciente: string;
}

export function FichaSidebar({
  paciente,
  dentista,
  dataFormatada,
  iniciaisPaciente,
}: FichaSidebarProps): React.JSX.Element {
  return (
    <div className="sticky top-6 self-start space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 select-none items-center justify-center rounded-full bg-teal/10 font-mono text-sm font-medium text-teal">
              {iniciaisPaciente}
            </div>
            <p className="truncate font-serif text-[1.05rem] leading-tight text-brand-black">
              {paciente.nome}
            </p>
          </div>

          {paciente.telefone && (
            <div className="flex items-center gap-2">
              <Phone size={13} className="shrink-0 text-brand-muted" />
              <span className="font-mono text-sm text-brand-muted">{paciente.telefone}</span>
            </div>
          )}

          {paciente.whatsapp && (
            <div className="flex items-center gap-2">
              <MessageCircle size={13} className="shrink-0 text-teal" />
              <a
                href={`https://wa.me/55${paciente.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-teal hover:underline"
              >
                {paciente.whatsapp}
              </a>
            </div>
          )}

          <Link href={`/dashboard/pacientes/${paciente.id}`}>
            <Button variant="ghost" size="sm" className="w-full text-xs">
              Ver perfil completo
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <FichaSectionLabel>Ficha</FichaSectionLabel>

          <div>
            <p className="font-sans text-sm text-brand-black">{dentista.nome}</p>
            {dentista.especialidade && (
              <p className="font-mono text-xs text-brand-muted">{dentista.especialidade}</p>
            )}
          </div>

          <p className="font-mono text-xs text-brand-muted">{dataFormatada}</p>
        </CardContent>
      </Card>
    </div>
  );
}
