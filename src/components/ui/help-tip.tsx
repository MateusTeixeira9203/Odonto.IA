"use client";

import { Info } from "lucide-react";

interface HelpTipProps {
  text: string;
}

export function HelpTip({ text }: HelpTipProps) {
  return (
    <div className="group relative inline-block ml-2">
      <Info className="h-4 w-4 text-[--color-text-secondary] cursor-help" />
      <div
        className="
          invisible group-hover:visible opacity-0 group-hover:opacity-100
          absolute z-50 w-64 p-3 text-sm
          bg-[--color-surface] border border-[--color-border] rounded-xl shadow-lg
          -top-2 left-6 transition-all duration-200
          text-[--color-text-primary]
        "
      >
        {text}
      </div>
    </div>
  );
}
