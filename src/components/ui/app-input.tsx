import * as React from 'react'
import { cn } from '@/lib/utils'

interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function AppInput({ className, error, ...props }: AppInputProps) {
  return (
    <input
      className={cn(
        'w-full px-4 py-3 rounded-xl border bg-surface-alt text-sm text-text-primary',
        'placeholder:text-text-muted transition-all',
        'focus:outline-none focus:ring-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-alt',
        'read-only:bg-surface-alt read-only:cursor-default',
        error
          ? 'border-coral/60 ring-2 ring-coral/20 focus:ring-coral/20 focus:border-coral/60'
          : 'border-border focus:ring-teal/20 focus:border-teal/60',
        className,
      )}
      {...props}
    />
  )
}
