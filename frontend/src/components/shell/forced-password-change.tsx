"use client";

import { useAuth } from "@/lib/auth";
import { api } from "@/shared/api/http-client";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "At least 8 characters."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

type FormValues = z.infer<typeof schema>;

export function ForcedPasswordChange() {
  const { clearMustChangePassword, logout } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await api.post("profile.php", {
        action: "change_password",
        current_password: values.current_password,
        password: values.password,
      });
      toast.success("Password updated. Welcome aboard!");
      clearMustChangePassword();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("current_password", { message: "Current password is incorrect." });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not change password.");
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-hero bg-card p-8 shadow-modal">
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
          <KeyRound className="h-6 w-6 text-primary-strong" strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your password was set by an administrator — choose your own before continuing.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <div>
            <Label htmlFor="current_password" required>Current password</Label>
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.current_password}
              {...register("current_password")}
            />
            <FieldError message={errors.current_password?.message} />
          </div>
          <div>
            <Label htmlFor="password" required>New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <div>
            <Label htmlFor="confirm" required>Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              {...register("confirm")}
            />
            <FieldError message={errors.confirm?.message} />
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Save & continue
          </Button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Log out instead
          </button>
        </form>
      </div>
    </div>
  );
}
