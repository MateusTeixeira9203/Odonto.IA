import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppLabel } from './app-label'

interface AppFormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  optional?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}

export function AppFormField({
  label,
  htmlFor,
  required,
  optional,
  error,
  hint,
  className,
  children,
}: AppFormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <AppLabel htmlFor={htmlFor} required={required} optional={optional}>
        {label}
      </AppLabel>
      {children}
      {error ? (
        <p className="text-xs text-coral flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-secondary">{hint}</p>
      ) : null}
    </div>
  )
}
