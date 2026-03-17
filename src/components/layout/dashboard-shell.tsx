"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardShellProps {
  nome: string;
  clinicaNome: string;
  children: React.ReactNode;
}

export function DashboardShell({
  nome,
  clinicaNome,
  children,
}: DashboardShellProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        nome={nome}
        clinicaNome={clinicaNome}
        collapsed={false}
        onToggle={() => {}}
        isExpanded={isExpanded}
        onExpandedChange={setIsExpanded}
      />
      <motion.div
        animate={{ paddingLeft: isExpanded ? 256 : 72 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen"
      >
        <Header />
        <main className="px-8 py-6 max-w-7xl mx-auto">{children}</main>
      </motion.div>
    </div>
  );
}
