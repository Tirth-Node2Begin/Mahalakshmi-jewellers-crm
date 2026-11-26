"use client";

import { PermissionGate, usePermissions } from "@/lib/permissions";
import { leadsApi } from "@/features/leads/api";
import { LeadFormModal } from "@/features/leads/lead-form-modal";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/features/leads/types";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDot, Pencil, Plus, Search, Trash2, UserRoundPlus, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_TONE: Record<LeadStatus, "purple" | "green" | "amber" | "coral" | "gray" | "blue"> = {
  New: "purple",
  Contacted: "blue",
  Qualified: "amber",
  "Meeting Scheduled": "amber",
  "Meeting Done": "blue",
  "Proposal Sent": "blue",
  Negotiation: "amber",
  Converted: "green",
  Dropped: "gray",
  Lost: "coral",
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const search = useDebouncedValue(rawSearch, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "list", { status, tab, sourceId, search }],
    queryFn: () =>
      leadsApi.list({
        status: status || undefined,
        tab: tab || undefined,
        source_id: sourceId || undefined,
        search: search || undefined,
      }),
  });

  const leads = data?.leads ?? [];
  const stats = data?.stats;
  const { page, totalPages, pageItems, setPage } = usePagination(leads, 10, [status, tab, sourceId, search]);

  const removeLead = useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => {
      toast.success("Lead removed.");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove lead."),
  });

  const resetFilters = () => {
    setStatus("");
    setTab("");
    setSourceId("");
    setRawSearch("");
  };

  const pickStatus = (next: string) => {
    setTab("");
    setStatus(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={UserRoundPlus} label="Total leads" value={stats?.total ?? "-"} tone="purple" active={!status && !tab} onClick={resetFilters} />
        <KpiCard icon={CircleDot} label="Open" value={stats?.open_pipeline ?? "-"} tone="amber" active={tab === "active"} onClick={() => { setStatus(""); setTab("active"); }} />
        <KpiCard icon={CheckCircle2} label="Converted" value={stats?.converted ?? "-"} tone="green" active={status === "Converted"} onClick={() => pickStatus("Converted")} />
        <KpiCard icon={XCircle} label="Dropped / lost" value={stats?.dropped_lost ?? "-"} tone="coral" active={tab === "closed"} onClick={() => { setStatus(""); setTab("closed"); }} />
        <KpiCard icon={Search} label="Open value" value={stats ? formatCurrency(stats.open_value) : "-"} tone="sky" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input placeholder="Search name, phone, company..." value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={status} onChange={(e) => { setTab(""); setStatus(e.target.value); }} className="h-10 w-auto">
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="h-10 w-auto">
            <option value="">All sources</option>
            {(data?.sources ?? []).map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="leads.create">
            <Button size="sm" className="ml-auto" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" aria-hidden /> Add lead
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : leads.length === 0 ? (
          <EmptyState icon={UserRoundPlus} title="No leads found" hint="Add a lead or change the filters." />
        ) : (
          <>
            <ul>
              {pageItems.map((lead) => (
                <li key={lead.id} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background">
                  <Avatar name={lead.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {lead.name}
                      {lead.company ? <span className="ml-1 font-normal text-muted-foreground">- {lead.company}</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.mobile ?? lead.email ?? "No contact"}
                      {lead.city ? ` - ${lead.city}` : ""}
                      {lead.source_name ? ` - ${lead.source_name}` : ""}
                    </p>
                  </div>
                  <div className="hidden min-w-[150px] text-right sm:block">
                    <p className="text-sm font-medium text-foreground">{lead.service_interest ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(lead.lead_date ?? lead.created_at)}</p>
                  </div>
                  <div className="hidden min-w-[110px] text-right md:block">
                    <p className="text-sm font-semibold text-foreground tabular-nums">{lead.expected_value ? formatCurrency(lead.expected_value) : "-"}</p>
                    <p className="text-xs text-muted-foreground">{lead.assigned_to_name ?? "Unassigned"}</p>
                  </div>
                  <Badge tone={STATUS_TONE[lead.status]}>{lead.status}</Badge>
                  {can("leads.update") || can("leads.delete") ? (
                    <div className="flex gap-1">
                      {can("leads.update") ? (
                        <Button variant="ghost" size="iconSm" onClick={() => setEditing(lead)} aria-label="Edit lead">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                      {can("leads.delete") ? (
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="text-attention-strong hover:bg-attention-soft"
                          onClick={() => removeLead.mutate(lead.id)}
                          aria-label="Remove lead"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <LeadFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        lead={editing && editing !== "new" ? editing : null}
        sources={data?.sources ?? []}
        users={data?.users ?? []}
      />
    </div>
  );
}
