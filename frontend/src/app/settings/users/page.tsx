"use client";

import { PermissionGate, usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { api } from "@/shared/api/http-client";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { PasswordInput } from "@/shared/ui/password-input";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { relativeTime } from "@/shared/utils/format";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, ShieldCheck, UserX, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  avatar_color: string | null;
  is_active: 0 | 1;
  last_login_at: string | null;
  roles: string[];
  role_display: string[];
}

interface Role {
  id: number;
  name: string;
  display_name: string;
  data_scope: "all" | "own";
}

const createSchema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters.")
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots and dashes only."),
  full_name: z.string().min(1, "Name is required.").max(120),
  email: z.string().email("Enter a valid email.").max(150).or(z.literal("")),
  password: z.string().min(8, "At least 8 characters."),
  role_ids: z.array(z.number()).min(1, "Pick at least one role."),
});

type CreateValues = z.infer<typeof createSchema>;

export default function UsersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [rolesFor, setRolesFor] = useState<UserRow | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => api.get<{ users: UserRow[]; roles: Role[] }>("users.php"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const toggleActive = useMutation({
    mutationFn: (id: number) => api.post("users.php", { action: "toggle_active", id }),
    onSuccess: () => {
      toast.success("Updated.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed."),
  });

  const users = data?.users ?? [];
  const roles = data?.roles ?? [];

  return (
    <>
      <Card className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {users.length} user{users.length === 1 ? "" : "s"} · logins & role assignments
          </p>
          <PermissionGate permission="users.manage">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add user
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={5} />
        ) : users.length === 0 ? (
          <EmptyState icon={UsersRound} title="No users yet" />
        ) : (
          <ul>
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-background"
              >
                <Avatar name={u.full_name} color={u.avatar_color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {u.full_name}
                    {u.is_active === 0 ? (
                      <Badge tone="gray" className="ml-2">
                        inactive
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username}
                    {u.email ? ` · ${u.email}` : ""} · last login{" "}
                    {u.last_login_at ? relativeTime(u.last_login_at) : "never"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.role_display.map((r) => (
                    <Badge key={r} tone="purple">
                      {r}
                    </Badge>
                  ))}
                </div>
                {can("users.manage") ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRolesFor(u)} title="Edit roles">
                      <ShieldCheck className="h-4 w-4" aria-hidden /> Edit roles
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResetFor(u)} title="Username & password" aria-label="Username & password">
                      <KeyRound className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={u.is_active === 1 ? "text-attention-strong hover:bg-attention-soft" : "text-success-strong hover:bg-success-soft"}
                      onClick={() => toggleActive.mutate(u.id)}
                    >
                      <UserX className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} roles={roles} onDone={invalidate} />
      <AssignRolesDialog user={rolesFor} onClose={() => setRolesFor(null)} roles={roles} onDone={invalidate} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} onSaved={invalidate} />
    </>
  );
}

function CreateUserDialog({
  open,
  onClose,
  roles,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  onDone: () => void;
}) {
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role_ids: [] },
  });
  const selected = form.watch("role_ids");

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.post("users.php", {
        action: "create",
        username: values.username,
        full_name: values.full_name,
        email: values.email || null,
        password: values.password,
        role_ids: values.role_ids,
      });
      toast.success("User created — they must change the password at first login.");
      form.reset({ role_ids: [] });
      onDone();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        form.setError("username", { message: e.message });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not create user.");
      }
    }
  });

  const toggleRole = (id: number) => {
    const next = selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id];
    form.setValue("role_ids", next, { shouldValidate: true });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add user"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={form.formState.isSubmitting}>
            Create user
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="new_username" required>Username</Label>
            <Input id="new_username" {...form.register("username")} aria-invalid={!!form.formState.errors.username} />
            <FieldError message={form.formState.errors.username?.message} />
          </div>
          <div>
            <Label htmlFor="new_fullname" required>Full name</Label>
            <Input id="new_fullname" {...form.register("full_name")} aria-invalid={!!form.formState.errors.full_name} />
            <FieldError message={form.formState.errors.full_name?.message} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="new_email">Email (optional)</Label>
            <Input id="new_email" type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="new_password" required>Temporary password</Label>
            <PasswordInput id="new_password"  autoComplete="new-password" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
        </div>
        <div>
          <Label required>Roles</Label>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => toggleRole(role.id)}
                aria-pressed={selected.includes(role.id)}
                className={
                  selected.includes(role.id)
                    ? "rounded-pill bg-primary-soft px-4 py-2 text-xs font-semibold text-primary-strong ring-1 ring-primary"
                    : "rounded-pill border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-background"
                }
              >
                {role.display_name}
                <span className="ml-1 opacity-60">({role.data_scope})</span>
              </button>
            ))}
          </div>
          <FieldError message={form.formState.errors.role_ids?.message} />
        </div>
      </form>
    </Dialog>
  );
}

function AssignRolesDialog({
  user,
  onClose,
  roles,
  onDone,
}: {
  user: UserRow | null;
  onClose: () => void;
  roles: Role[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // sync when a user is picked
  const [lastUserId, setLastUserId] = useState<number | null>(null);
  if (user && user.id !== lastUserId) {
    setLastUserId(user.id);
    setSelected(roles.filter((r) => user.roles.includes(r.name)).map((r) => r.id));
  }

  const save = async () => {
    if (!user) return;
    if (selected.length === 0) {
      toast.error("Pick at least one role.");
      return;
    }
    setSaving(true);
    try {
      await api.post("users.php", { action: "assign_roles", id: user.id, role_ids: selected });
      toast.success("Roles updated.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update roles.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Roles — ${user.full_name}` : "Roles"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save roles
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() =>
              setSelected((current) =>
                current.includes(role.id) ? current.filter((r) => r !== role.id) : [...current, role.id],
              )
            }
            aria-pressed={selected.includes(role.id)}
            className={
              selected.includes(role.id)
                ? "rounded-pill bg-primary-soft px-4 py-2 text-xs font-semibold text-primary-strong ring-1 ring-primary"
                : "rounded-pill border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-background"
            }
          >
            {role.display_name}
            <span className="ml-1 opacity-60">({role.data_scope})</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // prefill the current username whenever the dialog opens for a user
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setPassword("");
    }
  }, [user]);

  const save = async () => {
    if (!user) return;
    const trimmed = username.trim();
    const renaming = trimmed !== user.username;
    if (renaming && trimmed.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }
    if (!renaming && password.length === 0) {
      toast.error("Change the username or set a temporary password.");
      return;
    }
    if (password.length > 0 && password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await api.post("users.php", {
        action: "reset_password",
        id: user.id,
        username: renaming ? trimmed : undefined,
        password: password.length > 0 ? password : undefined,
      });
      toast.success(
        password.length > 0
          ? "Credentials updated — the user must change the password at next login."
          : "Username updated.",
      );
      setPassword("");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update credentials.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? `Credentials — ${user.full_name}` : "Credentials"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void save()} loading={saving}>
            Save credentials
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="cred_username" required>Username</Label>
          <Input
            id="cred_username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">Letters, numbers, dots and dashes only.</p>
        </div>
        <div>
          <Label htmlFor="temp_password">Temporary password (optional)</Label>
          <PasswordInput
            id="temp_password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep the current password"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Setting one signs out all of their sessions and forces a new password at next login.
            Changing only the username keeps them signed in.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
