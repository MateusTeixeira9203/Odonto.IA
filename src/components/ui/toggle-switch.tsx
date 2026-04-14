"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  className,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-teal]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-[--color-teal] bg-[--color-teal]"
          : "border-border bg-surface-alt",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-300",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
