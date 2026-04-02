"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { OnboardingTour } from "@/components/onboarding/tour";
import type { DentistaRole } from "@/types/database";

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
  role: DentistaRole;
}

export function DashboardShell({ children, nome, clinicaNome, role }: DashboardShellProps) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen bg-bg overflow-hidden">
      <Sidebar
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
        role={role}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
      <OnboardingTour />
    </div>
  );
}
