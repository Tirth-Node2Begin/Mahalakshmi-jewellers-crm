"use client";

import { cn } from "@/shared/utils/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

/** style.md §6 — 48px, 18px radius, hairline border, purple focus glow. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-12 w-full rounded-input border border-border bg-card px-4 text-sm text-body",
        "placeholder:text-muted-foreground",
        "transition-colors focus:border-primary focus:outline-none focus-visible:outline-none",
        "aria-[invalid=true]:border-attention-strong",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Label({
  htmlFor,
  children,
  className,
  required = false,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  /** Renders a red asterisk after the label to mark a required field. */
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-2 block text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground",
        className,
      )}
    >
      {children}
      {required ? <span className="ml-0.5 text-attention-strong" title="Required">*</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-xs text-attention-strong">
      {message}
    </p>
  );
}
