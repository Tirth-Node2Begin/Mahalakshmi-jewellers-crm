"use client";

import { cn } from "@/shared/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

/** Pill buttons; primary = soft-blue brand gradient, cta = gold accent (both AA vs white). */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-[linear-gradient(135deg,#35609f_0%,#2f5590_100%)] shadow-hero hover:-translate-y-0.5 hover:brightness-110",
        cta: "text-white bg-[linear-gradient(135deg,#b8912f_0%,#8f6d1c_100%)] shadow-raised hover:-translate-y-0.5 hover:brightness-110",
        secondary:
          "bg-card text-primary-strong border border-border hover:bg-primary-soft",
        ghost: "bg-transparent text-foreground hover:bg-background",
        destructive: "text-white bg-attention-strong hover:brightness-110",
        icon: "bg-card text-foreground shadow-card hover:bg-background",
      },
      size: {
        default: "h-10 px-6",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8",
        icon: "h-10 w-10 p-0 rounded-full",
        iconSm: "h-8 w-8 p-0 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), "relative", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* spinner overlays; label stays in flow but hidden → width is locked (style.md §6) */}
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        </span>
      ) : null}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
    </button>
  ),
);
Button.displayName = "Button";
