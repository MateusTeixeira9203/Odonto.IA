'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
  nome: string;
  clinicaNome: string;
}

export function DashboardShell({ children, nome, clinicaNome }: DashboardShellProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="flex min-h-screen bg-bg overflow-hidden">
      <Sidebar
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        nome={nome}
        clinicaNome={clinicaNome}
      />
      <main className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
