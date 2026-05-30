import * as React from 'react'
import { cn } from '@/lib/utils'

interface AppLabelProps {
  htmlFor?: string
  required?: boolean
  optional?: boolean
  className?: string
  children: React.ReactNode
}

export function AppLabel({
  htmlFor,
  required,
  optional,
  className,
  children,
}: AppLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-sm font-semibold text-text-primary mb-1.5', className)}
    >
      {children}
      {required && <span className="text-coral ml-0.5">*</span>}
      {optional && (
        <span className="text-xs font-normal text-text-secondary ml-1">(opcional)</span>
      )}
    </label>
  )
}
