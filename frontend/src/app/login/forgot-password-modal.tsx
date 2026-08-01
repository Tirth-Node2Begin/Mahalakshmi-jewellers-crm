"use client";

import { api } from "@/shared/api/http-client";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { isValidEmail } from "@/shared/utils/validation";
import { useState } from "react";
import { toast } from "sonner";

type Step = "email" | "otp" | "reset" | "done";

/** OTP reset flow (style.md §12, planning/08 §7): email → code → new password. */
export function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setResetToken("");
    setPassword("");
    setConfirm("");
    setError(null);
    onClose();
  };

  const sendCode = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      await api.post("v1/auth/forgot-password.php", { email });
      toast.success("If that email exists, a reset code is on its way.");
      setStep("otp");
    } catch {
      // response is intentionally uniform; advance anyway so we don't reveal accounts
      setStep("otp");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ reset_token: string }>("v1/auth/verify-otp.php", { email, otp });
      setResetToken(res.reset_token);
      setStep("reset");
    } catch {
      setError("That code is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("v1/auth/reset-password.php", { email, reset_token: resetToken, password });
      setStep("done");
    } catch {
      setError("Reset link expired — please start again.");
      setStep("email");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Step, string> = {
    email: "Reset your password",
    otp: "Enter the code",
    reset: "Choose a new password",
    done: "Password updated",
  };

  return (
    <Dialog
      open={open}
      onClose={reset}
      title={titles[step]}
      footer={
        step === "done" ? (
          <Button onClick={reset}>Back to login</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            {step === "email" ? (
              <Button onClick={() => void sendCode()} loading={busy}>
                Send code
              </Button>
            ) : null}
            {step === "otp" ? (
              <Button onClick={() => void verifyCode()} loading={busy}>
                Verify
              </Button>
            ) : null}
            {step === "reset" ? (
              <Button onClick={() => void submitReset()} loading={busy}>
                Reset password
              </Button>
            ) : null}
          </>
        )
      }
    >
      {step === "email" ? (
        <div>
          <p className="mb-5 text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send a 6-digit reset code.
          </p>
          <Label htmlFor="fp_email" required>Email</Label>
          <Input
            id="fp_email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      ) : null}

      {step === "otp" ? (
        <div>
          <p className="mb-5 text-sm text-muted-foreground">
            We sent a code to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
          </p>
          <Label htmlFor="fp_otp" required>6-digit code</Label>
          <Input
            id="fp_otp"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="tracking-[0.5em] text-center text-lg"
          />
        </div>
      ) : null}

      {step === "reset" ? (
        <div className="space-y-5">
          <div>
            <Label htmlFor="fp_pw" required>New password</Label>
            <PasswordInput id="fp_pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fp_confirm" required>Confirm password</Label>
            <PasswordInput id="fp_confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="text-sm text-muted-foreground">
          Your password has been updated and all sessions were signed out. Log in with your new password.
        </p>
      ) : null}

      <FieldError message={error ?? undefined} />
    </Dialog>
  );
}
