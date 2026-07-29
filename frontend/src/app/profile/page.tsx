"use client";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/shared/api/api-error";
import { api } from "@/shared/api/http-client";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { formatDateTime, relativeTime } from "@/shared/utils/format";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface ProfileResponse {
  profile: {
    id: number;
    username: string;
    full_name: string;
    email: string | null;
    mobile: string | null;
    avatar_color: string | null;
    last_login_at: string | null;
    password_changed_at: string | null;
  };
  sessions: Array<{
    id: number;
    ip_address: string | null;
    user_agent: string | null;
    last_used_at: string | null;
    created_at: string;
    is_current: boolean;
  }>;
  roles: string[];
}

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required.").max(120),
  email: z.string().email("Enter a valid email.").max(150).or(z.literal("")),
  mobile: z.string().max(20).or(z.literal("")),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Required."),
    password: z.string().min(8, "At least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });

export default function ProfilePage() {
  const { refreshUser, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileResponse>("profile.php"),
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", email: "", mobile: "" },
  });

  useEffect(() => {
    if (data?.profile) {
      profileForm.reset({
        full_name: data.profile.full_name,
        email: data.profile.email ?? "",
        mobile: data.profile.mobile ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profile]);

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      await api.post("profile.php", {
        action: "update_profile",
        full_name: values.full_name,
        email: values.email || null,
        mobile: values.mobile || null,
      });
      toast.success("Profile updated.");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile.");
    }
  });

  const changePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await api.post("profile.php", {
        action: "change_password",
        current_password: values.current_password,
        password: values.password,
      });
      toast.success("Password changed. Other sessions were signed out.");
      passwordForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        passwordForm.setError("current_password", { message: "Current password is incorrect." });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not change password.");
      }
    }
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: number) =>
      api.post<{ was_current: boolean }>("profile.php", { action: "revoke_session", session_id: sessionId }),
    onSuccess: (res) => {
      if (res.was_current) {
        void logout();
        return;
      }
      toast.success("Session revoked.");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke session."),
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar name={data.profile.full_name} color={data.profile.avatar_color} size={64} />
            <div>
              <h3 className="text-lg font-semibold text-foreground">{data.profile.full_name}</h3>
              <p className="text-sm text-muted-foreground">@{data.profile.username}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.roles.map((role) => (
                  <Badge key={role} tone="purple">
                    {role.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={saveProfile} className="mt-8 space-y-5" noValidate>
            <div>
              <Label htmlFor="full_name" required>Full name</Label>
              <Input id="full_name" {...profileForm.register("full_name")} aria-invalid={!!profileForm.formState.errors.full_name} />
              <FieldError message={profileForm.formState.errors.full_name?.message} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...profileForm.register("email")} aria-invalid={!!profileForm.formState.errors.email} />
                <FieldError message={profileForm.formState.errors.email?.message} />
              </div>
              <div>
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" {...profileForm.register("mobile")} />
              </div>
            </div>
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Save profile
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Change password" />
          <form onSubmit={changePassword} className="space-y-5" noValidate>
            <div>
              <Label htmlFor="current_password" required>Current password</Label>
              <Input id="current_password" type="password" autoComplete="current-password" {...passwordForm.register("current_password")} aria-invalid={!!passwordForm.formState.errors.current_password} />
              <FieldError message={passwordForm.formState.errors.current_password?.message} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="new_password" required>New password</Label>
                <Input id="new_password" type="password" autoComplete="new-password" {...passwordForm.register("password")} aria-invalid={!!passwordForm.formState.errors.password} />
                <FieldError message={passwordForm.formState.errors.password?.message} />
              </div>
              <div>
                <Label htmlFor="confirm" required>Confirm</Label>
                <Input id="confirm" type="password" autoComplete="new-password" {...passwordForm.register("confirm")} aria-invalid={!!passwordForm.formState.errors.confirm} />
                <FieldError message={passwordForm.formState.errors.confirm?.message} />
              </div>
            </div>
            <Button type="submit" variant="secondary" loading={passwordForm.formState.isSubmitting}>
              Update password
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader title="Active sessions" />
        <ul className="space-y-2">
          {data.sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center gap-4 rounded-input border border-border px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                <MonitorSmartphone className="h-5 w-5 text-primary-strong" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.ip_address ?? "Unknown IP"}
                  {session.is_current ? (
                    <Badge tone="green" className="ml-2">
                      This device
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user_agent ?? "Unknown device"} · active {relativeTime(session.last_used_at ?? session.created_at)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-attention-strong hover:bg-attention-soft"
                onClick={() => revokeSession.mutate(session.id)}
                loading={revokeSession.isPending && revokeSession.variables === session.id}
              >
                {session.is_current ? "Sign out" : "Revoke"}
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Last login {formatDateTime(data.profile.last_login_at)} · password changed{" "}
          {formatDateTime(data.profile.password_changed_at)}
        </p>
      </Card>
    </div>
  );
}
