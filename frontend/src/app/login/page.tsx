"use client";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { STORAGE_KEYS } from "@/configs/app.config";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LoginArtwork } from "./artwork";
import { ForgotPasswordModal } from "./forgot-password-modal";

const TAGLINES = [
  "One flow — customers → bills → payments.",
  "Follow-ups that never slip: the auto-chain has your back.",
  "Raw material to revenue — inventory, works and billing aligned.",
];

const schema = z.object({
  username: z.string().min(1, "Enter your username or email."),
  password: z.string().min(1, "Enter your password."),
  remember_me: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [tagline, setTagline] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { remember_me: true },
  });

  useEffect(() => {
    const remembered = localStorage.getItem(STORAGE_KEYS.rememberUsername);
    if (remembered) setValue("username", remembered);
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (values.remember_me) {
        localStorage.setItem(STORAGE_KEYS.rememberUsername, values.username);
      } else {
        localStorage.removeItem(STORAGE_KEYS.rememberUsername);
      }
      await login(values);
      router.replace("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("password", { message: "Invalid username or password." });
      } else if (e instanceof ApiError && e.status === 429) {
        toast.error("Too many attempts — wait a few minutes and try again.");
      } else {
        toast.error(e instanceof Error ? e.message : "Login failed.");
      }
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 md:p-8">
      {/* Page backdrop (md+), matching the reference: the SAME artwork runs full-bleed behind
          the card on the left and hands off to a light panel along a SLANTED edge — the dark
          side is ~70% wide at the top and ~65% at the bottom. The card's inner image/form
          divider is a different slanted line at a different X, so no straight vertical line
          ever runs through the composition — the card "crosses" the background split. */}
      <div className="absolute inset-0 -z-10 hidden md:block" aria-hidden>
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 [clip-path:polygon(0_0,70%_0,65%_100%,0_100%)]">
          <LoginArtwork />
        </div>
      </div>
      <div className="absolute inset-0 -z-10 bg-background md:hidden" aria-hidden />

      {/* Floating card — horizontal, generous internal padding frames both panels. */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="grid w-full max-w-[1140px] gap-5 overflow-hidden rounded-[32px] bg-card p-5 shadow-modal md:min-h-[600px] md:grid-cols-[55fr_45fr] md:gap-6 md:p-6"
      >
        {/* Left — artwork framed by the card padding; its right edge is a slanted line
            (wider at the top, narrower at the bottom), same tilt direction as the page
            backdrop split — so neither section is a perfect rectangle. */}
        <div className="relative h-44 overflow-hidden rounded-[26px] bg-art-navy md:h-auto md:[clip-path:polygon(0_0,100%_0,calc(100%-56px)_100%,0_100%)]">
          <LoginArtwork />

          <span className="absolute left-6 top-6 text-xs font-bold uppercase tracking-[1.5px] text-white/90">
            Mahalakshmi Jewellers CRM
          </span>

          <div className="absolute bottom-6 left-6 right-32 hidden md:block">
            <AnimatePresence mode="wait">
              <motion.p
                key={tagline}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-sm leading-6 text-white/70"
              >
                {TAGLINES[tagline]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="absolute bottom-6 right-20 hidden gap-2 md:flex">
            <button
              type="button"
              aria-label="Previous tagline"
              onClick={() => setTagline((t) => (t + TAGLINES.length - 1) % TAGLINES.length)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white/80 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next tagline"
              onClick={() => setTagline((t) => (t + 1) % TAGLINES.length)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white/80 transition-colors hover:bg-white/10"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Right — login content, vertically centered with its own inner padding. */}
        <div className="flex flex-col px-2 py-4 md:px-8 md:py-8">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground">Mahalakshmi Jewellers</span>
          </div>

          <div className="flex flex-1 flex-col justify-center py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mx-auto w-full max-w-[360px]"
            >
              <h1 className="text-center text-[36px] font-bold leading-[44px] text-foreground">
                Hi there
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Welcome back to Mahalakshmi Jewellers
              </p>

              <form onSubmit={onSubmit} className="mt-9 space-y-5" noValidate>
                <div>
                  <Label htmlFor="username" required>Username or email</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    className="bg-background"
                    aria-invalid={!!errors.username}
                    {...register("username")}
                  />
                  <FieldError message={errors.username?.message} />
                </div>

                <div>
                  <Label htmlFor="password" required>Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    className="bg-background"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                  <FieldError message={errors.password?.message} />
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs font-medium text-primary-strong hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    {...register("remember_me")}
                  />
                  Keep me signed in
                </label>

                <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
                  Login
                </Button>
              </form>
            </motion.div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Mahalakshmi Jewellers CRM · Contact your admin for access
          </p>
        </div>
      </motion.div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}
