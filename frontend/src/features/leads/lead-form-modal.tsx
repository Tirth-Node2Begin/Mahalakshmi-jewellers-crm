"use client";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { localDateString } from "@/shared/utils/format";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { leadsApi } from "./api";
import { LEAD_CHANNELS, LEAD_STATUSES, type Lead, type LeadSource, type LeadUser } from "./types";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  mobile: z.string().max(20).or(z.literal("")),
  email: z.string().email("Enter a valid email.").max(150).or(z.literal("")),
  company: z.string().max(150).or(z.literal("")),
  city: z.string().max(100).or(z.literal("")),
  source_id: z.string().optional(),
  source_detail: z.string().max(255).or(z.literal("")),
  channel_type: z.enum(LEAD_CHANNELS),
  service_interest: z.string().max(255).or(z.literal("")),
  expected_value: z.string().or(z.literal("")),
  status: z.enum(LEAD_STATUSES),
  assigned_to: z.string().optional(),
  lead_date: z.string().optional(),
  notes: z.string().max(5000).or(z.literal("")),
});

type LeadFormValues = z.infer<typeof leadSchema>;

function defaults(lead?: Lead | null): LeadFormValues {
  return {
    name: lead?.name ?? "",
    mobile: lead?.mobile ?? "",
    email: lead?.email ?? "",
    company: lead?.company ?? "",
    city: lead?.city ?? "",
    source_id: lead?.source_id ? String(lead.source_id) : "",
    source_detail: lead?.source_detail ?? "",
    channel_type: lead?.channel_type ?? "walk_in",
    service_interest: lead?.service_interest ?? "",
    expected_value: lead?.expected_value ? String(lead.expected_value) : "",
    status: lead?.status ?? "New",
    assigned_to: lead?.assigned_to ? String(lead.assigned_to) : "",
    lead_date: lead?.lead_date ?? localDateString(),
    notes: lead?.notes ?? "",
  };
}

const labelForChannel = (channel: string) => channel.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function LeadFormModal({
  open,
  onClose,
  lead,
  sources,
  users,
}: {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
  sources: LeadSource[];
  users: LeadUser[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!lead;
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: defaults(lead),
  });
  const { register, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (open) reset(defaults(lead));
  }, [lead, open, reset]);

  const submit = handleSubmit(async (values) => {
    const expectedValue = values.expected_value.trim();
    const payload: Record<string, unknown> = {
      name: values.name,
      mobile: values.mobile || null,
      email: values.email || null,
      company: values.company || null,
      city: values.city || null,
      source_id: values.source_id ? Number(values.source_id) : null,
      source_detail: values.source_detail || null,
      channel_type: values.channel_type,
      service_interest: values.service_interest || null,
      expected_value: expectedValue ? Number(expectedValue) : null,
      status: values.status,
      assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
      lead_date: values.lead_date || null,
      notes: values.notes || null,
    };

    try {
      if (isEdit) {
        await leadsApi.update({ id: lead!.id, ...payload });
        toast.success("Lead updated.");
      } else {
        await leadsApi.create(payload);
        toast.success("Lead created.");
      }
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        for (const [field, message] of Object.entries(e.details)) {
          setError(field as keyof LeadFormValues, { message });
        }
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save lead.");
      }
    }
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit lead" : "Add lead"}
      maxWidth={760}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            {isEdit ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead_name" required>Name</Label>
            <Input id="lead_name" {...register("name")} aria-invalid={!!formState.errors.name} />
            <FieldError message={formState.errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="lead_mobile">Mobile</Label>
            <Input id="lead_mobile" inputMode="tel" {...register("mobile")} />
            <FieldError message={formState.errors.mobile?.message} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead_email">Email</Label>
            <Input id="lead_email" type="email" {...register("email")} aria-invalid={!!formState.errors.email} />
            <FieldError message={formState.errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="lead_company">Company</Label>
            <Input id="lead_company" {...register("company")} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="lead_status">Status</Label>
            <Select id="lead_status" {...register("status")}>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="lead_source">Source</Label>
            <Select id="lead_source" {...register("source_id")}>
              <option value="">Not set</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </Select>
            <FieldError message={formState.errors.source_id?.message} />
          </div>
          <div>
            <Label htmlFor="lead_channel">Channel</Label>
            <Select id="lead_channel" {...register("channel_type")}>
              {LEAD_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {labelForChannel(channel)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="lead_date">Lead date</Label>
            <Input id="lead_date" type="date" {...register("lead_date")} />
          </div>
          <div>
            <Label htmlFor="lead_city">City</Label>
            <Input id="lead_city" {...register("city")} />
          </div>
          <div>
            <Label htmlFor="lead_assigned">Salesperson</Label>
            <Select id="lead_assigned" {...register("assigned_to")}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </Select>
            <FieldError message={formState.errors.assigned_to?.message} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead_interest">Interest</Label>
            <Input id="lead_interest" {...register("service_interest")} placeholder="Gold bangles, bridal set, repair" />
          </div>
          <div>
            <Label htmlFor="lead_value">Expected value</Label>
            <Input id="lead_value" inputMode="decimal" {...register("expected_value")} placeholder="0" />
          </div>
        </div>

        <div>
          <Label htmlFor="lead_source_detail">Source detail</Label>
          <Input id="lead_source_detail" {...register("source_detail")} />
        </div>

        <div>
          <Label htmlFor="lead_notes">Notes</Label>
          <Textarea id="lead_notes" rows={4} {...register("notes")} />
        </div>
      </form>
    </Dialog>
  );
}
