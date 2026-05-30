'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BackHeaderProps {
  title: string;
  subtitle?: string;
  href: string;
}

export function BackHeader({ title, subtitle, href }: BackHeaderProps) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-4 mb-8">
      <button
        onClick={() => router.push(href)}
        className="p-2 rounded-xl border border-transparent
                   hover:border-border hover:bg-surface-alt
                   text-text-secondary hover:text-text-primary
                   transition-all shrink-0"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div>
        <h1 className="font-heading text-4xl text-text-primary">{title}</h1>
        {subtitle && (
          <p className="text-sm font-medium text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
