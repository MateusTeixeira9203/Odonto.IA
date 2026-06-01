'use client';

import { Menu } from 'lucide-react';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

interface MobileHeaderProps {
  onOpenDrawer: () => void;
}

export function MobileHeader({ onOpenDrawer }: MobileHeaderProps) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center justify-between px-4 h-14"
      style={{
        background: 'rgba(12, 17, 14, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <OdontoIALogo className="w-5 h-5 text-teal" />
      <span className="font-bold text-[15px] text-white">
        Odonto<span className="text-teal">.IA</span>
      </span>
      <button
        onClick={onOpenDrawer}
        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.07] transition-colors"
      >
        <Menu className="w-5 h-5 text-white/70" />
      </button>
    </header>
  );
}
