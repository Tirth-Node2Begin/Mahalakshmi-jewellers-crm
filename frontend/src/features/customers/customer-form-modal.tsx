"use client";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Collapsible } from "@/shared/ui/collapsible";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { customersApi } from "./api";
import type { Customer, FamilyMember, UserOption } from "./types";

const baseSchema = z.object({
  name: z.string().min(1, "Name is required.").max(150),
  company: z.string().max(150).or(z.literal("")),
  gstin: z.string().max(20).or(z.literal("")),
  pan_no: z.string().max(15).or(z.literal("")),
  mobile: z.string().max(20).or(z.literal("")),
  alt_mobile: z.string().max(20).or(z.literal("")),
  email: z.string().email("Enter a valid email.").max(150).or(z.literal("")),
  city: z.string().max(100).or(z.literal("")),
  state: z.string().max(100).or(z.literal("")),
  gender: z.string().optional(),
  dob: z.string().optional(),
  anniversary: z.string().optional(),
  occupation: z.string().max(100).or(z.literal("")),
  vip: z.boolean().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().max(5000).or(z.literal("")),
});

/**
 * Name is always required (`CustomerService::validate`). Billing additionally
 * insists on a phone: a bill customer you cannot ring back is not worth the row.
 * Everything else is optional in both places.
 */
const schemaFor = (requireMobile: boolean) =>
  baseSchema.superRefine((values, ctx) => {
    if (requireMobile && !values.mobile.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mobile"], message: "Phone number is required." });
    }
  });

type FormValues = z.infer<typeof baseSchema>;

const emptyMember = (): FamilyMember => ({ relation: "", name: "", dob: "", anniversary: "" });

export function CustomerFormModal({
  open,
  onClose,
  onCreated,
  customer,
  family,
  users,
  title,
  requireMobile = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires with the new row after a create — lets billing select what it just added. */
  onCreated?: (created: { id: number; name: string; mobile: string | null }) => void;
  customer?: Customer | null;
  family?: FamilyMember[];
  users: UserOption[];
  title?: string;
  /** Billing needs a contact number; the Customers page does not. */
  requireMobile?: boolean;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!customer;
  const form = useForm<FormValues>({ resolver: zodResolver(schemaFor(requireMobile)) });
  const { register, handleSubmit, reset, setError, formState } = form;
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? "",
        company: customer?.company ?? "",
        gstin: customer?.gstin ?? "",
        pan_no: customer?.pan_no ?? "",
        mobile: customer?.mobile ?? "",
        alt_mobile: customer?.alt_mobile ?? "",
        email: customer?.email ?? "",
        city: customer?.city ?? "",
        state: customer?.state ?? "",
        gender: customer?.gender ?? "",
        dob: customer?.dob ?? "",
        anniversary: customer?.anniversary ?? "",
        occupation: customer?.occupation ?? "",
        vip: customer?.vip === 1,
        assigned_to: customer?.assigned_to ? String(customer.assigned_to) : "",
        notes: customer?.notes ?? "",
      });
      setMembers(family && family.length > 0 ? family.map((m) => ({ ...m, relation: m.relation ?? "", dob: m.dob ?? "", anniversary: m.anniversary ?? "" })) : []);
    }
  }, [open, customer, family, reset]);

  const setMember = (i: number, k: keyof FamilyMember, v: string) =>
    setMembers((arr) => arr.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));

  const submit = handleSubmit(async (values) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      company: values.company || null,
      gstin: values.gstin || null,
      pan_no: values.pan_no || null,
      mobile: values.mobile || null,
      alt_mobile: values.alt_mobile || null,
      email: values.email || null,
      city: values.city || null,
      state: values.state || null,
      gender: values.gender || null,
      dob: values.dob || null,
      anniversary: values.anniversary || null,
      occupation: values.occupation || null,
      vip: values.vip ? 1 : 0,
      assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
      notes: values.notes || null,
      family: members
        .filter((m) => m.name.trim().length > 0)
        .map((m) => ({ relation: m.relation || null, name: m.name, dob: m.dob || null, anniversary: m.anniversary || null })),
    };
    try {
      if (isEdit) {
        await customersApi.update({ id: customer!.id, ...payload });
        toast.success("Customer updated.");
        void queryClient.invalidateQueries({ queryKey: ["customers"] });
      } else {
        const created = await customersApi.create(payload);
        toast.success("Customer created.");
        void queryClient.invalidateQueries({ queryKey: ["customers"] });
        onCreated?.({ id: created.id, name: values.name, mobile: values.mobile || null });
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        for (const [field, message] of Object.entries(e.details)) setError(field as keyof FormValues, { message });
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save customer.");
      }
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? (isEdit ? "Edit customer" : "Add customer")}
      maxWidth={720}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            {isEdit ? "Save changes" : "Create customer"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="c_name" required>Name</Label>
            <Input id="c_name" {...register("name")} aria-invalid={!!formState.errors.name} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="c_occupation">Occupation</Label>
            <Input id="c_occupation" {...register("occupation")} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="c_mobile" required={requireMobile}>
              Mobile
            </Label>
            <Input id="c_mobile" inputMode="tel" {...register("mobile")} aria-invalid={!!formState.errors.mobile} />
            <FieldError message={formState.errors.mobile?.message} />
          </div>
          <div>
            <Label htmlFor="c_altmobile">Alternate mobile</Label>
            <Input id="c_altmobile" {...register("alt_mobile")} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="c_email">Email</Label>
            <Input id="c_email" type="email" {...register("email")} aria-invalid={!!formState.errors.email} />
            <FieldError message={formState.errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="c_gender">Gender</Label>
            <Select id="c_gender" {...register("gender")}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="c_dob">Date of birth</Label>
            <Input id="c_dob" type="date" {...register("dob")} />
          </div>
          <div>
            <Label htmlFor="c_anniversary">Anniversary</Label>
            <Input id="c_anniversary" type="date" {...register("anniversary")} />
          </div>
          <div className="flex items-end">
            <label className="flex h-12 items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" {...register("vip")} className="h-4 w-4 rounded border-border" /> VIP customer
            </label>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="c_city">City</Label>
            <Input id="c_city" {...register("city")} />
          </div>
          <div>
            <Label htmlFor="c_state">State</Label>
            <Input id="c_state" {...register("state")} />
          </div>
          <div>
            <Label htmlFor="c_assigned">Salesperson</Label>
            <Select id="c_assigned" {...register("assigned_to")}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Collapsible
          label="Business & tax details"
          hint="Company, GSTIN, PAN — only for business customers"
          defaultOpen={isEdit && !!(customer?.gstin || customer?.pan_no || customer?.company)}
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="c_company">Company</Label>
              <Input id="c_company" {...register("company")} />
            </div>
            <div>
              <Label htmlFor="c_gstin">GSTIN</Label>
              <Input id="c_gstin" {...register("gstin")} />
            </div>
            <div>
              <Label htmlFor="c_pan">PAN</Label>
              <Input id="c_pan" {...register("pan_no")} />
            </div>
          </div>
        </Collapsible>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Family members</Label>
            <Button variant="ghost" size="sm" onClick={() => setMembers((a) => [...a, emptyMember()])} type="button">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Add spouse, children or parents with their birthdays/anniversaries for cross-selling.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-input border border-border p-2">
                  <div className="col-span-3">
                    <Input placeholder="Relation" value={m.relation ?? ""} onChange={(e) => setMember(i, "relation", e.target.value)} />
                  </div>
                  <div className="col-span-4">
                    <Input placeholder="Name" value={m.name} onChange={(e) => setMember(i, "name", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="date" title="Birthday" value={m.dob ?? ""} onChange={(e) => setMember(i, "dob", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="date" title="Anniversary" value={m.anniversary ?? ""} onChange={(e) => setMember(i, "anniversary", e.target.value)} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMembers((a) => a.filter((_, idx) => idx !== i))}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-attention-soft hover:text-attention-strong"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="c_notes">Notes</Label>
          <Textarea id="c_notes" {...register("notes")} />
        </div>
      </form>
    </Dialog>
  );
}
