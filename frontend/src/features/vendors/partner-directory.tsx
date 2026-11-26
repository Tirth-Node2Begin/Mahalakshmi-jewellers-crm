"use client";

import { PermissionGate, usePermissions } from "@/lib/permissions";
import {
  PARTNER_CATEGORIES,
  PARTNER_PAGES,
  VENDOR_TYPE_LABEL,
  vendorsApi,
  vendorStatusTone,
  type PartnerCategory,
  type Vendor,
} from "@/features/vendors/api";
import { VendorFormModal } from "@/features/vendors/vendor-form-modal";
import { useVendorTypes } from "@/features/vendors/vendor-type-select";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { Ban, Hammer, Pencil, Plus, Truck, UserRoundCheck, UserRoundMinus, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const CATEGORY_ICON: Record<PartnerCategory, LucideIcon> = {
  supplier: Truck,
  maker: Hammer,
  service: Wrench,
};

/**
 * One partner page (Suppliers / Makers / Services) — the three routes share this.
 * Everything is filtered in the browser from a single unfiltered fetch, so the
 * switcher counts and KPI numbers never jump around while the user types.
 */
export function PartnerDirectory({ category }: { category: PartnerCategory }) {
  const { can } = usePermissions();
  const { labelOf, categoryOf, typesIn } = useVendorTypes();
  const meta = PARTNER_PAGES[category];
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", "list", "all"],
    queryFn: () => vendorsApi.list({}),
  });

  const all = data?.vendors ?? [];
  // a shop-added type carries its own category, so its vendors land on the page
  // the type was created from rather than all piling into Services
  const mine = useMemo(
    () => all.filter((v) => categoryOf(v.vendor_type) === category),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, category, categoryOf],
  );

  const q = search.trim().toLowerCase();
  const vendors = useMemo(
    () =>
      mine.filter((v) => {
        if (type && v.vendor_type !== type) return false;
        if (status && v.vendor_status !== status) return false;
        if (q) {
          const hay = [v.name, v.company, v.contact_person, v.specialisation, v.mobile, v.vendor_code, v.city, labelOf(v.vendor_type)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [mine, type, status, q, labelOf],
  );

  const { page, totalPages, pageItems, setPage } = usePagination(vendors, 10, [category, type, status, search]);

  const statusCount = (s: string) => mine.filter((v) => v.vendor_status === s).length;

  // this page's own types drive the chip strip — built-ins plus whatever the
  // shop has added under this page
  const builtInTypes = PARTNER_CATEGORIES.find((c) => c.key === category)?.types ?? [];
  const typeChips: { value: string; label: string }[] = [
    ...builtInTypes.map((t) => ({ value: t, label: VENDOR_TYPE_LABEL[t] })),
    ...typesIn(category).map((t) => ({ value: t.slug, label: t.label })),
  ];

  const hasFilters = !!(type || status || rawSearch);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={CATEGORY_ICON[category]} label={`Total ${meta.label.toLowerCase()}`} value={data ? mine.length : "—"} tone="purple" active={!status} onClick={() => setStatus("")} />
        <KpiCard icon={UserRoundCheck} label="Active" value={data ? statusCount("active") : "—"} tone="green" active={status === "active"} onClick={() => setStatus("active")} />
        <KpiCard icon={UserRoundMinus} label="Inactive" value={data ? statusCount("inactive") : "—"} tone="gray" active={status === "inactive"} onClick={() => setStatus("inactive")} />
        <KpiCard icon={Ban} label="Blacklisted" value={data ? statusCount("blacklisted") : "—"} tone="coral" active={status === "blacklisted"} onClick={() => setStatus("blacklisted")} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input
            placeholder={`Search ${meta.label.toLowerCase()} by name, phone…`}
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-10 w-full max-w-xs"
          />
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setType(""); setStatus(""); setRawSearch(""); }}>
              Reset
            </Button>
          ) : null}
          <PermissionGate permission="vendors.manage">
            <Button
              className="ml-auto"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> {meta.addLabel}
            </Button>
          </PermissionGate>
        </div>

        {typeChips.length > 1 ? (
          <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
            <TypeChip label="All" active={!type} onClick={() => setType("")} />
            {typeChips.map((t) => (
              <TypeChip key={t.value} label={t.label} active={type === t.value} onClick={() => setType(type === t.value ? "" : t.value)} />
            ))}
          </div>
        ) : null}

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : vendors.length === 0 ? (
          mine.length === 0 && !hasFilters ? (
            <div className="py-4">
              <EmptyState icon={CATEGORY_ICON[category]} title={meta.emptyTitle} hint={meta.emptyHint} />
              {can("vendors.manage") ? (
                <div className="flex justify-center pb-8">
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> {meta.addLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState icon={CATEGORY_ICON[category]} title="Nothing matches" hint="Try clearing the search or filters above." />
          )
        ) : (
          <>
            <ul>
              {pageItems.map((v) => (
                <li
                  key={v.id}
                  className="relative flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background"
                >
                  {/* whole row opens the profile; the buttons below sit above this overlay */}
                  <Link
                    href={`/vendors/detail?id=${v.id}`}
                    aria-label={`Open ${v.name}`}
                    className="absolute inset-0 z-0 rounded-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  />
                  <div className="pointer-events-none min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {labelOf(v.vendor_type)}
                      {v.specialisation ? ` · ${v.specialisation}` : ""}
                      {v.mobile ? ` · ${v.mobile}` : ""}
                    </p>
                  </div>
                  {v.item_count ? (
                    <span className="pointer-events-none hidden text-xs text-muted-foreground sm:inline">{v.item_count} items</span>
                  ) : null}
                  <span className="pointer-events-none">
                    <Badge tone={vendorStatusTone(v.vendor_status)}>{v.vendor_status}</Badge>
                  </span>
                  {can("vendors.manage") ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative z-10"
                      aria-label={`Edit ${v.name}`}
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

      <VendorFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        vendor={editing}
        defaultType={meta.defaultType}
        category={category}
        noun={meta.noun}
      />
    </div>
  );
}

function TypeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-pill px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary-soft text-primary-strong" : "bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
