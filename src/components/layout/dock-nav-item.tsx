'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DockNavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  locked?: boolean;
}

export function DockNavItem({ href, icon: Icon, label, isActive, locked }: DockNavItemProps) {
  if (locked) {
    return (
      <div className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px] cursor-not-allowed">
        <div className="relative">
          <Icon style={{ width: 20, height: 20 }} className="text-white/20" />
          <Lock className="absolute -bottom-1 -right-1 w-3 h-3 text-teal/40" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20">
          {label}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px] transition-all duration-150 group ${
        isActive ? '' : 'hover:bg-white/[0.05]'
      }`}
    >
      {isActive && (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-0 rounded-xl bg-teal/[0.12]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <Icon
        style={{ width: 20, height: 20 }}
        className={`relative transition-all duration-150 ${
          isActive
            ? 'text-teal'
            : 'text-white/50 group-hover:text-white/80 group-hover:-translate-y-0.5'
        }`}
      />
      <span
        className={`relative text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
          isActive ? 'text-teal/80' : 'text-white/35 group-hover:text-white/60'
        }`}
      >
        {label}
      </span>
      {isActive && (
        <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal" />
      )}
    </Link>
  );
}
