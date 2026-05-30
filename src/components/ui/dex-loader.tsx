import { cn } from '@/lib/utils';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

interface DexLoaderProps {
  /** Subtitle text shown below the spinner */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { wrap: 'w-8 h-8', logo: 'w-4 h-4', ring: 'w-8 h-8 border-2' },
  md: { wrap: 'w-12 h-12', logo: 'w-6 h-6', ring: 'w-12 h-12 border-2' },
  lg: { wrap: 'w-16 h-16', logo: 'w-8 h-8', ring: 'w-16 h-16 border-[3px]' },
};

/**
 * DexLoader — canonical premium loading indicator for Odonto.IA.
 * Replaces raw Loader2 animate-spin in full-area loading states.
 */
export function DexLoader({ label, size = 'md', className }: DexLoaderProps) {
  const s = sizeMap[size];
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className="relative flex items-center justify-center">
        {/* Spinning ring */}
        <span
          className={cn(
            s.ring,
            'absolute rounded-full border-teal/20 border-t-teal animate-spin',
          )}
          style={{ animationDuration: '0.9s', animationTimingFunction: 'linear' }}
        />
        {/* Static logo center */}
        <div className={cn(s.wrap, 'rounded-xl bg-teal/10 flex items-center justify-center')}>
          <OdontoIALogo className={cn(s.logo, 'text-teal')} />
        </div>
      </div>
      {label && (
        <p className="text-xs text-text-secondary font-medium animate-pulse">{label}</p>
      )}
    </div>
  );
}
