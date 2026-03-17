"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// isExpanded é controlado pelo DashboardShell (estado elevado)
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Settings,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import { LogoIcon } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",               label: "Início",        icon: LayoutDashboard },
  { href: "/dashboard/pacientes",     label: "Pacientes",     icon: Users           },
  { href: "/dashboard/orcamentos",    label: "Orçamentos",    icon: Receipt         },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings        },
] as const;

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface SidebarProps {
  nome: string;
  clinicaNome: string;
  collapsed: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  onExpandedChange: (value: boolean) => void;
}

export function Sidebar({ nome, isExpanded, onExpandedChange }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 256 : 72 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => { if (!isExpanded) onExpandedChange(true); }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col py-5 bg-sidebar border-r border-sidebar-border overflow-hidden shadow-sm",
        !isExpanded && "cursor-pointer hover:bg-sidebar/90"
      )}
    >
      {/* Cabeçalho com logo e botão de recolher */}
      <div className={cn(
        "flex items-center mb-8 px-4",
        isExpanded ? "justify-between" : "justify-center"
      )}>
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <LogoIcon size={28} />
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-sans text-lg font-semibold text-foreground whitespace-nowrap overflow-hidden"
              >
                Dent<em>IA</em>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Botão de recolher */}
        <AnimatePresence>
          {isExpanded && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => { e.stopPropagation(); onExpandedChange(false); }}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Recolher menu"
            >
              <PanelLeftClose className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Navegação */}
      <nav className="flex flex-col gap-1.5 flex-1 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => e.stopPropagation()}
              title={!isExpanded ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                "relative flex items-center gap-3 rounded-xl transition-all duration-200",
                isExpanded ? "px-4 py-3" : "w-12 h-12 justify-center mx-auto",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="font-sans text-base font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Rodapé — avatar + logout */}
      <div className={cn(
        "mt-auto pt-5 border-t border-sidebar-border mx-3",
        isExpanded ? "px-1" : "flex flex-col items-center gap-3"
      )}>
        <div className={cn(
          "flex items-center gap-3",
          !isExpanded && "justify-center"
        )}>
          <div
            className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/5"
            title={nome}
          >
            <span className="font-mono text-xs text-primary font-semibold">
              {getIniciais(nome)}
            </span>
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-foreground whitespace-nowrap truncate">
                  {nome}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isExpanded && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="flex items-center justify-center w-7 h-7 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Logout quando recolhido */}
        {!isExpanded && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleLogout(); }}
            title="Sair"
            aria-label="Sair"
            className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-card"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.aside>
  );
}
