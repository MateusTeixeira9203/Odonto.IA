'use client';

import dynamic from 'next/dynamic';
import type { SidebarProps } from './sidebar-content';

// Renderiza apenas no cliente para evitar hydration mismatch
// causado pelos IDs gerados pelo Radix UI DropdownMenu.
const SidebarContent = dynamic<SidebarProps>(
  () => import('./sidebar-content').then((mod) => ({ default: mod.SidebarContent })),
  {
    ssr: false,
    loading: () => (
      <aside className="w-20 bg-zinc-950 h-screen shrink-0 border-r border-white/5" />
    ),
  }
);

export function Sidebar(props: SidebarProps) {
  return <SidebarContent {...props} />;
}
