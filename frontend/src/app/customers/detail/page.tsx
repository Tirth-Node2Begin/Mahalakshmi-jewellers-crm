"use client";

import { usePermissions } from "@/lib/permissions";
import { customersApi } from "@/features/customers/api";
import { CustomerFormModal } from "@/features/customers/customer-form-modal";
import { StageBadge } from "@/features/customers/ui";
import { STAGES } from "@/features/customers/types";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, relativeTime } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, FileText, Pencil, Plus, ShoppingBag, StickyNote } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

type Tab = "invoices" | "timeline";

function DetailInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("invoices");
  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => customersApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["customers", "detail", id] });

  const changeStage = async (stage: string) => {
    try {
      await customersApi.updateStage(id, stage);
      toast.success("Stage updated.");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  };

  const saveNote = async () => {
    if (note.trim().length === 0) return;
    try {
      await customersApi.addNote(id, note);
      toast.success("Note added.");
      setNote("");
      setNoteOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    }
  };

  if (isLoading) return <SkeletonCard lines={8} />;
  if (isError || !data)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Customer not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
      </Card>
    );

  const { customer, family, invoices, events, totals } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/customers" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <Avatar name={customer.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-3 text-xl font-bold text-foreground">
            {customer.name}
            {customer.vip === 1 ? <Badge tone="amber">VIP</Badge> : null}
            <span className="font-mono text-sm font-normal text-muted-foreground">{customer.customer_code}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{customer.mobile ?? customer.email ?? "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can("invoices.create") ? (
            <Link
              href={`/invoices/create?customer_id=${customer.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-border bg-card px-3 text-sm font-medium text-foreground shadow-card transition-colors hover:border-primary hover:text-primary-strong"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden /> New bill
            </Link>
          ) : null}
          {can("customers.update") ? (
            <>
              <select
                value={customer.stage}
                onChange={(e) => void changeStage(e.target.value)}
                aria-label="Stage"
                className="h-9 rounded-pill border border-border bg-card px-3 text-sm capitalize"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={() => setNoteOpen(true)}>
                <StickyNote className="h-4 w-4" aria-hidden /> Note
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
            </>
          ) : (
            <StageBadge stage={customer.stage} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 text-sm">
              <Row label="Email" value={customer.email ?? "—"} />
              <Row label="Alt. mobile" value={customer.alt_mobile ?? "—"} />
              <Row label="Birthday" value={customer.dob ? formatDate(customer.dob) : "—"} />
              <Row label="Anniversary" value={customer.anniversary ? formatDate(customer.anniversary) : "—"} />
              <Row label="Occupation" value={customer.occupation ?? "—"} />
              <Row label="GSTIN" value={customer.gstin ?? "—"} />
              <Row label="PAN" value={customer.pan_no ?? "—"} />
              <Row label="City" value={[customer.city, customer.state].filter(Boolean).join(", ") || "—"} />
              <Row label="Salesperson" value={customer.assigned_to_name ?? "Unassigned"} />
              <Row label="Since" value={formatDate(customer.created_at)} />
            </dl>
          </Card>

          {family.length > 0 ? (
            <Card>
              <CardHeader title="Family" />
              <ul className="space-y-2 text-sm">
                {family.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span className="text-foreground">
                      {m.name}
                      {m.relation ? <span className="ml-1 text-xs text-muted-foreground">({m.relation})</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.dob ? `🎂 ${formatDate(m.dob)}` : ""}
                      {m.anniversary ? ` 💍 ${formatDate(m.anniversary)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Billing" />
            <div className="space-y-3">
              <Row label="Billed" value={formatCurrency(totals.billed)} />
              <Row label="Paid" value={formatCurrency(totals.paid)} />
              <div className="flex justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold text-foreground">Outstanding</span>
                <span className={cn("text-sm font-bold tabular-nums", totals.outstanding > 0 ? "text-attention-strong" : "text-success-strong")}>
                  {formatCurrency(totals.outstanding)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-0">
            {/* tabs */}
            <div className="flex gap-1 border-b border-border px-4 pt-4">
              {(
                [
                  ["invoices", `Invoices (${invoices.length})`, FileText],
                  ["timeline", "Timeline", Activity],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    tab === key ? "border-primary text-primary-strong" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === "invoices" ? (
                invoices.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {invoices.map((inv) => (
                      <li key={inv.id}>
                        <Link
                          href={`/invoices/detail?id=${inv.id}`}
                          className="flex items-center gap-3 rounded-input border border-border px-4 py-3 transition-colors hover:border-primary/50 hover:bg-background"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{inv.invoice_no}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(inv.invoice_date)}</p>
                          </div>
                          <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(inv.grand_total)}</span>
                          <Badge tone={inv.status === "paid" ? "green" : inv.status === "cancelled" ? "gray" : "amber"}>{inv.status.replace(/_/g, " ")}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {tab === "timeline" ? (
                <ol>
                  {events.map((ev, i) => (
                    <li key={ev.id} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < events.length - 1 ? <span className="absolute left-[15px] top-8 h-full w-px bg-border" /> : null}
                      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                        <Activity className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="text-sm font-medium capitalize text-foreground">{ev.event_type.replace(/_/g, " ")}</p>
                        {ev.description ? <p className="text-xs text-muted-foreground">{ev.description}</p> : null}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {relativeTime(ev.created_at)}
                          {ev.created_by_name ? ` · ${ev.created_by_name}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} family={family} users={data.users} />

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add a note"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveNote()} disabled={note.trim().length === 0}>
              <Plus className="h-4 w-4" aria-hidden /> Add note
            </Button>
          </>
        }
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, a decision, anything worth remembering…" rows={4} />
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <DetailInner />
    </Suspense>
  );
}
