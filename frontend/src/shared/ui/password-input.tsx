"use client";

import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

/**
 * A password field with a show/hide eye. Drop-in replacement for `Input` —
 * takes the same props (and forwards the ref, so react-hook-form's
 * `{...register("password")}` works unchanged).
 *
 * The toggle is skipped in the tab order so Tab still runs
 * password → submit, which is how people actually type a login.
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [shown, setShown] = useState(false);

    return (
      <div className="relative">
        <Input ref={ref} type={shown ? "text" : "password"} className={cn("pr-12", className)} {...props} />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          tabIndex={-1}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-pill p-2.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {shown ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
