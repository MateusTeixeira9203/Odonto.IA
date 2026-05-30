import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-text-primary transition-colors outline-none",
        "placeholder:text-text-muted",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary",
        "focus-visible:border-teal/60 focus-visible:ring-2 focus-visible:ring-teal/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-alt/50 disabled:opacity-50",
        "aria-invalid:border-coral/60 aria-invalid:ring-2 aria-invalid:ring-coral/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
