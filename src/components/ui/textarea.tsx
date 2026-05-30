import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-border bg-surface-alt px-2.5 py-2 text-sm text-text-primary transition-colors outline-none",
        "placeholder:text-text-muted",
        "focus-visible:border-teal/60 focus-visible:ring-2 focus-visible:ring-teal/20",
        "disabled:cursor-not-allowed disabled:bg-surface-alt/50 disabled:opacity-50",
        "aria-invalid:border-coral/60 aria-invalid:ring-2 aria-invalid:ring-coral/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
