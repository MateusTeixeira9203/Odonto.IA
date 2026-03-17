"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  className?: string;
}

const spring = { type: "spring", duration: 0.3, bounce: 0 } as const;

export function MetricCard({ label, value, subtitle, icon, className }: MetricCardProps): React.JSX.Element {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={spring}
      className={cn(
        "group bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300",
        className
      )}
    >
      <div className="flex items-start justify-between mb-5">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground font-medium">
          {label}
        </span>
        <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
          {icon}
        </div>
      </div>
      <div className="font-mono text-4xl font-semibold text-foreground leading-none tracking-tight">
        {value}
      </div>
      {subtitle && (
        <p className="font-sans text-sm text-muted-foreground mt-3">{subtitle}</p>
      )}
    </motion.div>
  );
}
