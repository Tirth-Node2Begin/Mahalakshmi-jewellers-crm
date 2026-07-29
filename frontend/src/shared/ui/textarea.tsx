"use client";

import { cn } from "@/shared/utils/cn";
import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full rounded-input border border-border bg-card px-4 py-3 text-sm text-body",
        "placeholder:text-muted-foreground",
        "transition-colors focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
