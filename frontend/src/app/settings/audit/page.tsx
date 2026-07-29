"use client";

import { actionLabel, auditApi, AUDIT_ACTIONS, entityLabel } from "@/features/audit/api";
import { diffSummary, LogDiff } from "@/features/audit/log-diff";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Collapsible } from "@/shared/ui/collapsible";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { formatDateTime } from "@/shared/utils/format";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useEffect, useState } from "react";

const PER_PAGE = 25;

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // any filter change starts again from the first page
  useEffect(() => {
    setPage(1);
  }, [search, action, from, to]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "list", { page, search, action, from, to }],
    queryFn: () =>
      auditApi.list({
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.logs ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.meta.per_page ?? PER_PAGE)));

  const resetFilters = () => {
    setRawSearch("");
    setAction("");
    setFrom("");
    setTo("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Everything staff changed, and when.</p>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input
            placeholder="Search…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-10 w-full max-w-xs"
            aria-label="Search the audit log"
          />
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" aria-label="From date" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" aria-label="To date" />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="h-10 w-auto" aria-label="Action">
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <EmptyState
            icon={History}
            title="We could not load the log"
            hint="Check your internet connection and try again in a moment."
          />
        ) : logs.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded here" hint="Change the dates or clear the filters to see more." />
        ) : (
          <>
            <ul>
              {logs.map((log) => {
                const hasDetails = Boolean(log.old_values || log.new_values);
                return (
                  <li key={log.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="w-44 shrink-0 text-sm text-muted-foreground tabular-nums">
                        {formatDateTime(log.created_at)}
                      </span>
                      <span className="w-40 shrink-0 truncate text-sm font-medium text-foreground">
                        {log.user_name ?? "System"}
                      </span>
                      <Badge tone={toneFor(log.action)}>{actionLabel(log.action)}</Badge>
                      <span className="text-sm text-muted-foreground">{entityLabel(log.entity_type, log.entity_id)}</span>
                      {log.ip_address ? (
                        <span className="ml-auto hidden text-xs text-muted-foreground lg:inline">{log.ip_address}</span>
                      ) : null}
                    </div>
                    {hasDetails ? (
                      <Collapsible
                        label="Details"
                        hint={diffSummary(log.old_values, log.new_values)}
                        className="mt-2 bg-card"
                      >
                        <LogDiff oldValues={log.old_values} newValues={log.new_values} />
                      </Collapsible>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

/** Green for things created/received, coral for cancels/deletes, else neutral. */
function toneFor(action: string): "green" | "coral" | "amber" | "gray" {
  if (/cancel|delete|discard|reset/.test(action)) return "coral";
  if (/create|receive|finalize|convert|assign/.test(action)) return "green";
  if (/update|save|adjust|set|toggle/.test(action)) return "amber";
  return "gray";
}
