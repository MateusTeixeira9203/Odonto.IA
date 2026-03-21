"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
}

export function DashboardShell({ children, nome, clinicaNome }: DashboardShellProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen bg-bg overflow-hidden">
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
