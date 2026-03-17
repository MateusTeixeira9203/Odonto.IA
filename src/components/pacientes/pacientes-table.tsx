"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Search, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/dentai";
import type { Paciente } from "@/types/database";

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface PacientesTableProps {
  pacientes: Paciente[];
}

export function PacientesTable({ pacientes }: PacientesTableProps): React.JSX.Element {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);

  // Filtro por nome ou CPF em tempo real
  const pacientesFiltrados = pacientes.filter((p) => {
    const termo = busca.toLowerCase();
    return (
      p.nome.toLowerCase().includes(termo) ||
      (p.cpf ?? "").toLowerCase().includes(termo)
    );
  });

  function abrirDialogNovaFicha(paciente: Paciente): void {
    setPacienteSelecionado(paciente);
    setDialogAberto(true);
  }

  function confirmarNovaFicha(): void {
    if (!pacienteSelecionado) return;
    setDialogAberto(false);
    router.push(`/dashboard/fichas/nova?paciente_id=${pacienteSelecionado.id}`);
  }

  return (
    <div>
      {/* Busca */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
        />
        <input
          type="search"
          placeholder="Buscar paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full max-w-sm h-10 pl-9 pr-3 bg-card border border-border rounded-md font-sans text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Nome
              </th>
              <th className="text-left px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                CPF
              </th>
              <th className="text-left px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                Telefone
              </th>
              <th className="text-left px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                WhatsApp
              </th>
              <th className="text-left px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                Cidade
              </th>
              <th className="text-right px-4 py-3 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {pacientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-52 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Users size={40} className="text-muted-foreground/30" />
                    <div className="space-y-1">
                      <p className="font-serif text-base text-foreground">
                        {busca ? "Nenhum paciente encontrado" : "Nenhum paciente ainda"}
                      </p>
                      <p className="font-sans text-sm text-muted-foreground">
                        {busca
                          ? "Tente buscar por outro nome ou CPF"
                          : "Cadastre seu primeiro paciente para começar"}
                      </p>
                    </div>
                    {!busca && (
                      <Link href="/dashboard/pacientes/novo">
                        <Button variant="primary" size="sm">
                          <UserPlus className="size-3.5" />
                          Cadastrar paciente
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              pacientesFiltrados.map((paciente) => (
                <tr
                  key={paciente.id}
                  className="border-b border-border last:border-b-0 hover:bg-background/50 transition-colors cursor-pointer group"
                >
                  {/* Nome com avatar */}
                  <td className="px-4 py-3 font-sans text-sm font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-mono text-xs text-primary">
                          {getIniciais(paciente.nome)}
                        </span>
                      </div>
                      {paciente.nome}
                    </div>
                  </td>

                  {/* CPF */}
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {paciente.cpf ?? "—"}
                  </td>

                  {/* Telefone */}
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground hidden md:table-cell">
                    {paciente.telefone ?? "—"}
                  </td>

                  {/* WhatsApp */}
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground hidden lg:table-cell">
                    {paciente.whatsapp ?? "—"}
                  </td>

                  {/* Cidade */}
                  <td className="px-4 py-3 font-sans text-sm text-muted-foreground hidden lg:table-cell">
                    {paciente.cidade && paciente.estado
                      ? `${paciente.cidade} / ${paciente.estado}`
                      : (paciente.cidade ?? "—")}
                  </td>

                  {/* Ações — aparecem no hover */}
                  <td className="px-4 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        type="button"
                        onClick={() => abrirDialogNovaFicha(paciente)}
                        className="font-sans text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background"
                      >
                        Nova Ficha
                      </button>
                      <Link
                        href={`/dashboard/pacientes/${paciente.id}`}
                        className="font-sans text-xs font-medium text-primary transition-colors px-2 py-1 rounded hover:bg-primary/10"
                      >
                        Ver →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog de confirmação Nova Ficha */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Nova Ficha</DialogTitle>
            <DialogDescription>
              Criar uma nova ficha para{" "}
              <strong>{pacienteSelecionado?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarNovaFicha}>
              Criar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
