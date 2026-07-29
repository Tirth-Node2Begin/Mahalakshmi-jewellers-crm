"use client";

import { api } from "@/shared/api/http-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  data_scope: "all" | "own";
  is_system: 0 | 1;
  is_active: 0 | 1;
  user_count: number;
  grant_count: number;
}

interface Permission {
  id: number;
  resource: string;
  action: string;
}

const roleSchema = z.object({
  name: z.string().min(2, "At least 2 characters.").max(60),
  display_name: z.string().min(1, "Required.").max(100),
  description: z.string().max(255).or(z.literal("")),
  data_scope: z.enum(["all", "own"]),
});

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [grantsFor, setGrantsFor] = useState<Role | null>(null);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["rbac", "roles"],
    queryFn: () => api.get<{ roles: Role[] }>("rbac.php", { module: "roles" }),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["rbac"] });
  const roles = (rolesData?.roles ?? []).filter((r) => r.is_active === 1);

  const deleteRole = useMutation({
    mutationFn: (id: number) => api.post("rbac.php", { action: "delete_role", id }),
    onSuccess: () => {
      toast.success("Role deactivated.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed."),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Roles bundle permissions; the grant matrix is seeded from planning/03 §8 and editable here.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> New role
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="flex flex-col">
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
                {role.is_system === 1 ? (
                  <Lock className="h-5 w-5 text-primary-strong" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Shield className="h-5 w-5 text-primary-strong" strokeWidth={1.75} aria-hidden />
                )}
              </span>
              <Badge tone={role.data_scope === "all" ? "purple" : "amber"}>
                scope: {role.data_scope}
              </Badge>
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{role.display_name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {role.is_system === 1
                ? "System role — full access, not editable."
                : (role.description ?? "") || `${role.grant_count} permissions granted.`}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {role.user_count} user{role.user_count === 1 ? "" : "s"} ·{" "}
              {role.is_system === 1 ? "all permissions" : `${role.grant_count} grants`}
            </p>
            {role.is_system === 0 ? (
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setGrantsFor(role)}>
                  Permissions
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(role)}>
                  Edit
                </Button>
                {role.user_count === 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-attention-strong hover:bg-attention-soft"
                    onClick={() => deleteRole.mutate(role.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <RoleFormDialog editing={editing} onClose={() => setEditing(null)} onDone={invalidate} />
      <GrantsDialog role={grantsFor} onClose={() => setGrantsFor(null)} onDone={invalidate} />
    </>
  );
}

function RoleFormDialog({
  editing,
  onClose,
  onDone,
}: {
  editing: Role | "new" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: { data_scope: "all", name: "", display_name: "", description: "" },
  });

  useEffect(() => {
    if (editing && editing !== "new") {
      form.reset({
        name: editing.name,
        display_name: editing.display_name,
        description: editing.description ?? "",
        data_scope: editing.data_scope,
      });
    } else if (editing === "new") {
      form.reset({ data_scope: "all", name: "", display_name: "", description: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.post("rbac.php", {
        action: "save_role",
        id: editing !== "new" && editing ? editing.id : null,
        ...values,
        description: values.description || null,
      });
      toast.success(editing === "new" ? "Role created." : "Role updated.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save role.");
    }
  });

  const scope = form.watch("data_scope");

  return (
    <Dialog
      open={editing !== null}
      onClose={onClose}
      title={editing === "new" ? "New role" : "Edit role"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={form.formState.isSubmitting}>
            Save role
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="role_name" required>Slug</Label>
            <Input
              id="role_name"
              disabled={editing !== "new"}
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="role_display" required>Display name</Label>
            <Input id="role_display" {...form.register("display_name")} aria-invalid={!!form.formState.errors.display_name} />
            <FieldError message={form.formState.errors.display_name?.message} />
          </div>
        </div>
        <div>
          <Label htmlFor="role_desc">Description (optional)</Label>
          <Input id="role_desc" {...form.register("description")} />
        </div>
        <div>
          <Label>Data scope</Label>
          <div className="flex rounded-pill bg-background p-1">
            {(["all", "own"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => form.setValue("data_scope", value)}
                aria-pressed={scope === value}
                className={cn(
                  "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors",
                  scope === value ? "bg-primary-deep text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "all" ? "See everything" : "Own records only"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            “Own records only” limits customers and their records to rows assigned to or created by the user.
          </p>
        </div>
      </form>
    </Dialog>
  );
}

function GrantsDialog({
  role,
  onClose,
  onDone,
}: {
  role: Role | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: permsData } = useQuery({
    queryKey: ["rbac", "permissions"],
    queryFn: () => api.get<{ permissions: Permission[] }>("rbac.php", { module: "permissions" }),
    staleTime: 10 * 60_000,
  });

  const { data: grantsData } = useQuery({
    queryKey: ["rbac", "grants", role?.id],
    queryFn: () => api.get<{ permission_ids: number[] }>("rbac.php", { module: "role_grants", role_id: role!.id }),
    enabled: role !== null,
  });

  useEffect(() => {
    if (grantsData) setSelected(new Set(grantsData.permission_ids));
  }, [grantsData]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const perm of permsData?.permissions ?? []) {
      const list = groups.get(perm.resource) ?? [];
      list.push(perm);
      groups.set(perm.resource, list);
    }
    return [...groups.entries()];
  }, [permsData]);

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (perms: Permission[]) => {
    const allOn = perms.every((p) => selected.has(p.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const p of perms) {
        if (allOn) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await api.post("rbac.php", {
        action: "save_role_grants",
        role_id: role.id,
        permission_ids: [...selected],
      });
      toast.success("Grants saved.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save grants.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={role !== null}
      onClose={onClose}
      title={role ? `Permissions — ${role.display_name}` : "Permissions"}
      maxWidth={720}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {selected.size} permission{selected.size === 1 ? "" : "s"} selected
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save grants
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {grouped.map(([resource, perms]) => (
          <div key={resource}>
            <button
              type="button"
              onClick={() => toggleGroup(perms)}
              className="mb-2 text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground hover:text-primary-strong"
            >
              {resource} · toggle all
            </button>
            <div className="flex flex-wrap gap-2">
              {perms.map((perm) => (
                <button
                  key={perm.id}
                  type="button"
                  onClick={() => toggle(perm.id)}
                  aria-pressed={selected.has(perm.id)}
                  className={cn(
                    "rounded-pill px-4 py-2 text-xs font-medium transition-colors",
                    selected.has(perm.id)
                      ? "bg-primary-soft font-semibold text-primary-strong ring-1 ring-primary"
                      : "border border-border text-muted-foreground hover:bg-background",
                  )}
                >
                  {perm.action}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
