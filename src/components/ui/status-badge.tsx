"use client";

import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface StatusBadgeProps {
  status: "connected" | "connecting" | "disconnected" | string;
}

const STATUS_CONFIG = {
  connected: {
    color: "bg-green-500",
    text: "Conectado",
    icon: Wifi,
    pulse: false,
  },
  connecting: {
    color: "bg-yellow-500",
    text: "Conectando...",
    icon: RefreshCw,
    pulse: true,
  },
  disconnected: {
    color: "bg-zinc-400 dark:bg-zinc-600",
    text: "Desconectado",
    icon: WifiOff,
    pulse: false,
  },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const config =
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-4 w-4 items-center justify-center">
        <span
          className={`absolute h-4 w-4 rounded-full ${config.color} ${config.pulse ? "animate-ping opacity-75" : ""}`}
        />
        <span className={`relative h-3 w-3 rounded-full ${config.color}`} />
      </div>
      <Icon
        className={`h-5 w-5 text-[--color-text-primary] ${config.pulse ? "animate-spin" : ""}`}
      />
      <span className="text-lg font-semibold text-[--color-text-primary]">{config.text}</span>
    </div>
  );
}
