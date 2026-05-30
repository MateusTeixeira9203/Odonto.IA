import * as React from 'react'
import { cn } from '@/lib/utils'

interface AppTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function AppTextarea({ className, error, rows = 4, ...props }: AppTextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full px-4 py-3 rounded-xl border bg-surface text-sm text-text-primary',
        'placeholder:text-text-muted transition-all resize-none',
        'focus:outline-none focus:ring-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-alt',
        error
          ? 'border-coral/60 ring-2 ring-coral/20 focus:ring-coral/20 focus:border-coral/60'
          : 'border-border focus:ring-teal/20 focus:border-teal/60',
        className,
      )}
      {...props}
    />
  )
}
