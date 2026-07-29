"use client";

import { PermissionGate, usePermissions } from "@/lib/permissions";
import { PARTNER_CATEGORIES, PARTNER_CATEGORY_OF, vendorsApi, VENDOR_TYPE_LABEL, vendorStatusTone, type Vendor } from "@/features/vendors/api";
import { cn } from "@/shared/utils/cn";
import { VendorFormModal } from "@/features/vendors/vendor-form-modal";
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
import { useQuery } from "@tanstack/react-query";
import { Ban, Hammer, Pencil, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function VendorsPage() {
  const { can } = usePermissions();
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", "list", { type, status, search }],
    queryFn: () =>
      vendorsApi.list({ vendor_type: type || undefined, status: status || undefined, search: search || undefined }),
  });

  const allVendors = data?.vendors ?? [];
  const vendors = category ? allVendors.filter((v) => PARTNER_CATEGORY_OF[v.vendor_type] === category) : allVendors;
  const stats = data?.stats;
  const { page, totalPages, pageItems, setPage } = usePagination(vendors, 10, [category, type, status, search]);

  const resetFilters = () => {
    setCategory("");
    setType("");
    setStatus("");
    setRawSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users} label="Total" value={stats?.total ?? "—"} tone="purple" active={!status && !type && !category} onClick={() => { setStatus(""); setType(""); setCategory(""); }} />
        <KpiCard icon={Users} label="Active" value={stats?.active ?? "—"} tone="green" active={status === "active"} onClick={() => setStatus("active")} />
        <KpiCard icon={Hammer} label="Jewellery Makers" value={stats?.karigars ?? "—"} tone="sky" active={category === "maker"} onClick={() => { setCategory("maker"); setType(""); }} />
        <KpiCard icon={Ban} label="Blacklisted" value={stats?.blacklisted ?? "—"} tone="coral" active={status === "blacklisted"} onClick={() => setStatus("blacklisted")} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-2 border-b border-border p-4 pb-0">
          {[{ key: "", label: "All" }, ...PARTNER_CATEGORIES].map((c) => (
            <button
              key={c.key || "all"}
              onClick={() => { setCategory(c.key); setType(""); }}
              className={cn(
                "rounded-t-lg border-b-2 px-3 pb-3 text-sm font-medium transition-colors",
                category === c.key ? "border-primary text-primary-strong" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input placeholder="Search name, company, specialisation…" value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-auto">
            <option value="">All types</option>
            {PARTNER_CATEGORIES.map((cat) => (
              <optgroup key={cat.key} label={cat.label}>
                {cat.types.map((t) => (
                  <option key={t} value={t}>
                    {VENDOR_TYPE_LABEL[t]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="vendors.manage">
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add supplier / maker
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : vendors.length === 0 ? (
          <EmptyState icon={Users} title="Nothing here yet" hint="Add material suppliers, jewellery makers or service providers." />
        ) : (
          <>
            <ul>
              {pageItems.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/vendors/detail?id=${v.id}`} className="truncate text-sm font-semibold text-foreground hover:text-primary-strong">
                      {v.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {VENDOR_TYPE_LABEL[v.vendor_type]}
                      {v.specialisation ? ` · ${v.specialisation}` : ""}
                      {v.mobile ? ` · ${v.mobile}` : ""}
                    </p>
                  </div>
                  {v.item_count ? <span className="hidden text-xs text-muted-foreground sm:inline">{v.item_count} items</span> : null}
                  <Badge tone={vendorStatusTone(v.vendor_status)}>{v.vendor_status}</Badge>
                  {can("vendors.manage") ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(v);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <VendorFormModal open={formOpen} onClose={() => setFormOpen(false)} vendor={editing} />
    </div>
  );
}
