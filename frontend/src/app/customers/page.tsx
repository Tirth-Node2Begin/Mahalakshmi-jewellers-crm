"use client";

import { PermissionGate } from "@/lib/permissions";
import { customersApi } from "@/features/customers/api";
import { CustomerFormModal } from "@/features/customers/customer-form-modal";
import { StageBadge } from "@/features/customers/ui";
import { STAGES } from "@/features/customers/types";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleDot, Plus, TrendingDown, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function CustomersPage() {
  const [stage, setStage] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", "list", { stage, search }],
    queryFn: () => customersApi.list({ stage: stage || undefined, search: search || undefined }),
  });

  const customers = data?.customers ?? [];
  const stats = data?.stats;
  const { page, totalPages, pageItems, setPage } = usePagination(customers, 10, [stage, search]);

  const resetFilters = () => {
    setStage("");
    setRawSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={Building2} label="Total" value={stats?.total ?? "—"} tone="purple" active={!stage} onClick={() => setStage("")} />
        <KpiCard icon={UserPlus} label="Onboarding" value={stats?.onboarding ?? "—"} tone="purple" active={stage === "onboarding"} onClick={() => setStage("onboarding")} />
        <KpiCard icon={CircleDot} label="Active" value={stats?.active ?? "—"} tone="green" active={stage === "active"} onClick={() => setStage("active")} />
        <KpiCard icon={TrendingDown} label="Inactive / churned" value={stats?.dormant ?? "—"} tone="gray" onClick={() => setStage("inactive")} />
        <KpiCard icon={Wallet} label="Outstanding" value={stats ? formatCurrency(stats.outstanding) : "—"} tone="coral" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input placeholder="Search name, mobile, company, code…" value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={stage} onChange={(e) => setStage(e.target.value)} className="h-10 w-auto">
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="customers.create">
            <Button size="sm" className="ml-auto" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add customer
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : customers.length === 0 ? (
          <EmptyState icon={Building2} title="No customers yet" hint="Add your first customer to get started." />
        ) : (
          <>
            <ul>
              {pageItems.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/detail?id=${c.id}`} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background">
                    <Avatar name={c.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.name} <span className="ml-1 font-mono text-xs text-muted-foreground">{c.customer_code}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.company ? `${c.company} · ` : ""}
                        {c.mobile ?? c.email ?? "—"}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium text-foreground tabular-nums">
                        {Number(c.outstanding) > 0 ? formatCurrency(c.outstanding) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">outstanding</p>
                    </div>
                    {c.assigned_to_name ? <Avatar name={c.assigned_to_name} size={28} className="hidden md:inline-flex" /> : null}
                    <StageBadge stage={c.stage} />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      {data ? <CustomerFormModal open={formOpen} onClose={() => setFormOpen(false)} users={data.users} /> : null}
    </div>
  );
}
