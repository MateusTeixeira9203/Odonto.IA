"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Activity {
  id: string;
  patientName: string;
  patientInitials: string;
  date: string;
  status: "aberta" | "concluída";
  type: string;
  href?: string;
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariant = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0 },
};

export function ActivityList({ title, activities }: { title: string; activities: Activity[] }): React.JSX.Element {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="font-sans font-semibold text-base mb-5 text-foreground">{title}</h3>
      <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-2">
        {activities.map((a) => (
          <motion.li
            key={a.id}
            variants={itemVariant}
            className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-muted/50 transition-all duration-200 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/5">
              <span className="font-mono text-sm font-semibold text-primary">{a.patientInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="font-sans font-medium text-sm text-foreground truncate">
                  {a.patientName}
                </span>
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium",
                  a.status === "aberta"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-primary/10 text-primary"
                )}>
                  {a.status}
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground mt-0.5 block">{a.date}</span>
            </div>
            {a.href && (
              <Link
                href={a.href}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-primary font-sans text-sm font-medium transition-all duration-200 hover:gap-2"
              >
                Ver <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
