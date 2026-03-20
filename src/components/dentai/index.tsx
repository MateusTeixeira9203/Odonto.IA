import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ── BUTTON ────────────────────────────────────────
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:     "bg-teal text-white hover:bg-teal-dark shadow-sm",
        secondary:   "bg-brand-black text-white hover:bg-zinc-800 shadow-sm",
        outline:     "border-[1.5px] border-teal text-teal bg-transparent hover:bg-teal-pale",
        ghost:       "border-[1.5px] border-brand-border text-brand-muted bg-transparent hover:border-brand-muted hover:text-brand-black",
        destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
        link:        "text-teal underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm:   "text-xs px-3 py-1.5 rounded-[3px]",
        md:   "text-sm px-5 py-2.5 rounded-[3px]",
        lg:   "text-base px-7 py-3 rounded-[4px]",
        icon: "h-9 w-9 rounded-[3px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processando…
        </>
      ) : children}
    </button>
  )
)
Button.displayName = "Button"

// ── BADGE ─────────────────────────────────────────
const badgeVariants = cva(
  "inline-flex items-center font-mono text-[0.6rem] uppercase tracking-[0.1em] px-2.5 py-1 rounded-full font-medium",
  {
    variants: {
      variant: {
        teal:    "bg-teal-pale text-teal-dark",
        dark:    "bg-brand-black text-white",
        gray:    "bg-brand-surface text-zinc-600",
        success: "bg-emerald-50 text-emerald-800",
        warning: "bg-amber-50 text-amber-800",
        error:   "bg-red-50 text-red-800",
        outline: "border border-brand-border text-brand-muted bg-transparent",
      },
    },
    defaultVariants: { variant: "teal" },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

// ── CARD ──────────────────────────────────────────
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-card rounded border border-border shadow-card dark:shadow-none", className)} {...props} />
  )
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 pt-5 pb-3 border-b border-border", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-sans font-semibold text-base text-foreground", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("px-5 py-4", className)} {...props} />
)
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 pb-5 pt-3 border-t border-border flex items-center gap-2", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

// ── INPUT ─────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={inputId} className="text-sm font-medium text-foreground">{label}</label>}
        <input
          id={inputId} ref={ref}
          className={cn(
            "w-full font-sans text-sm px-3 py-2.5 rounded-[3px] border bg-brand-bg text-brand-black transition-colors duration-150 placeholder:text-brand-muted/60 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal disabled:opacity-50",
            error ? "border-red-400 focus:border-red-400" : "border-brand-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-brand-muted">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

// ── PROGRESS BAR ──────────────────────────────────
export function ProgressBar({ value, max = 100, label, labelRight, className }: {
  value: number; max?: number; label?: string; labelRight?: string; className?: string
}): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn("w-full", className)}>
      {(label || labelRight) && (
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          {label && <span>{label}</span>}
          {labelRight && <span>{labelRight}</span>}
        </div>
      )}
      <div className="h-1.5 w-full bg-brand-surface rounded-full overflow-hidden">
        <div className="h-full bg-teal rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── STAT CARD ─────────────────────────────────────
export function StatCard({ label, value, sub, accent, className }: {
  label: string; value: string; sub?: string; accent?: boolean; className?: string
}): React.JSX.Element {
  return (
    <div className={cn("bg-brand-surface rounded p-4", className)}>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-brand-muted mb-1">{label}</p>
      <p className={cn("font-mono font-medium text-xl leading-none", accent ? "text-teal" : "text-brand-black")}>{value}</p>
      {sub && <p className="text-xs text-brand-muted mt-1">{sub}</p>}
    </div>
  )
}

// ── WAVEFORM ──────────────────────────────────────
const WAVE_HEIGHTS = [20, 30, 38, 25, 35, 28, 40, 22, 32, 18, 36, 26]
const WAVE_DELAYS  = [0, 0.1, 0.2, 0.3, 0.15, 0.25, 0.05, 0.35, 0.2, 0.4, 0.1, 0.3]

export function Waveform({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn("flex items-center justify-center gap-[3px] h-10", className)} role="img" aria-label="Gravando…">
      {WAVE_HEIGHTS.map((h, i) => (
        <div key={i} className="w-[3px] bg-teal-lt rounded-full animate-wave" style={{ height: h, animationDelay: `${WAVE_DELAYS[i]}s` }} />
      ))}
    </div>
  )
}

// ── SECTION LABEL ─────────────────────────────────
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return <p className={cn("font-sans text-sm font-semibold text-brand-black", className)}>{children}</p>
}
