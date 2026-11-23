"use client";

import {
  itemStatusTone,
  makingLabel,
  metalLabel,
  STATUS_LABEL,
  stockApi,
  TRACKING_LABEL,
  type StockItem,
} from "@/features/stock/api";
import { ItemFormDialog } from "@/features/stock/item-form-dialog";
import { ItemHistoryDialog } from "@/features/stock/item-history-dialog";
import { useMetals } from "@/features/stock/metal-select";
import { PermissionGate, usePermissions } from "@/lib/permissions";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Pagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatWeight } from "@/shared/utils/format";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gem, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const PER_PAGE = 15;

export default function StockItemsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [metal, setMetal] = useState("");
  const [purityId, setPurityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tracking, setTracking] = useState("");
  const [status, setStatus] = useState("");

  const [formItem, setFormItem] = useState<StockItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  /** The item just saved — highlighted and scrolled to, so it is not hunted for. */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const scrolledTo = useRef<number | null>(null);

  const [page, setPage] = useState(1);
  const filters = useMemo(() => ({
    search: search || undefined,
    metal: metal || undefined,
    purity_id: purityId || undefined,
    category_id: categoryId || undefined,
    tracking: tracking || undefined,
    status: status || undefined,
  }), [search, metal, purityId, categoryId, tracking, status]);
  const queryParams = useMemo(() => ({ ...filters, page, per_page: PER_PAGE }), [filters, page]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["stock", "items", queryParams],
    queryFn: () => stockApi.items(queryParams),
    placeholderData: keepPreviousData,
  });
  const { data: metalsData } = useMetals();

  const items = data?.items ?? [];
  const totalPages = data?.pagination?.total_pages ?? 1;
  const purities = data?.purities ?? [];
  const categories = data?.categories ?? [];
  const metalPurities = metal ? purities.filter((p) => p.metal === metal) : purities;

  /**
   * Walk to the saved item when it is present on the current server page.
   * Scrolls once per save — a background refetch must not yank the view back.
   */
  useEffect(() => {
    if (selectedId === null || scrolledTo.current === selectedId) return;
    if (!items.some((i) => i.id === selectedId)) return;
    scrolledTo.current = selectedId;
    rowRefs.current.get(selectedId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId, items]);

  const clearFilters = () => {
    setRawSearch("");
    setMetal("");
    setPurityId("");
    setCategoryId("");
    setTracking("");
  };

  const resetFilters = () => {
    clearFilters();
    setStatus("");
    setSelectedId(null);
  };

  const openNew = () => {
    setFormItem(null);
    setFormOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setFormItem(item);
    setFormOpen(true);
  };

  // the server refuses (409) once the item has any stock/purchase/billing
  // history — that message is the one worth showing, so surface it as-is
  const deleteItem = async (item: StockItem) => {
    if (!window.confirm(`Delete “${item.name}” (${item.item_code})? This cannot be undone.`)) return;
    try {
      await stockApi.deleteItem(item.id);
      toast.success("Item deleted.");
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the item.");
    }
  };

  /**
   * A brand-new item is in stock by definition, so show the in-stock list and drop
   * whatever was filtered — otherwise the thing just created is off screen. An edit
   * leaves the filters alone and only moves to the row.
   */
  const handleSaved = ({ id, isNew }: { id: number; isNew: boolean }) => {
    if (isNew) {
      clearFilters();
      setStatus("in_stock");
      setPage(1);
    }
    scrolledTo.current = null; // saving the same item twice should scroll to it again
    setSelectedId(id);
  };

  return (
    <div className="space-y-6">
      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input
            placeholder="Search item, code, HUID or barcode…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-11 w-full max-w-sm"
          />
          <Select
            value={metal}
            onChange={(e) => {
              setMetal(e.target.value);
              setPurityId("");
            }}
            className="h-11 w-auto"
          >
            <option value="">All metals</option>
            {(metalsData?.metals ?? []).map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select value={purityId} onChange={(e) => setPurityId(e.target.value)} className="h-11 w-auto">
            <option value="">All purities</option>
            {metalPurities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </Select>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-11 w-auto">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={tracking} onChange={(e) => setTracking(e.target.value)} className="h-11 w-auto">
            <option value="">Tagged &amp; bulk</option>
            <option value="tagged">Tagged pieces</option>
            <option value="bulk">Bulk metal</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 w-auto">
            <option value="">Any status</option>
            <option value="in_stock">In stock</option>
            <option value="sold">Sold</option>
            <option value="removed">Removed</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="inventory.manage">
            <Button size="sm" className="ml-auto" onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden /> Add item
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="No items match"
            hint="Change the filters, or add your first item to the master list."
            action={can("inventory.manage") ? "Add item" : undefined}
            onAction={can("inventory.manage") ? openNew : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-4 py-3">Code</th>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3">Metal &amp; purity</th>
                    <th className="px-3 py-3">Kept as</th>
                    <th className="px-3 py-3 text-right">Gross</th>
                    <th className="px-3 py-3 text-right">Net</th>
                    <th className="px-3 py-3">Making</th>
                    <th className="px-3 py-3">HUID</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(it.id, el);
                        else rowRefs.current.delete(it.id);
                      }}
                      className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-background",
                        // background, not a ring: Tailwind collapses table borders and a
                        // box-shadow on <tr> clips unevenly across browsers
                        it.id === selectedId && "bg-primary-soft hover:bg-primary-soft",
                      )}
                    >
                      <td
                        className={cn(
                          "px-4 py-3 font-mono text-xs text-muted-foreground",
                          it.id === selectedId && "border-l-[3px] border-primary-deep pl-[13px] text-primary-strong",
                        )}
                      >
                        {it.item_code}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setHistoryId(it.id)}
                          className="text-left font-medium text-foreground hover:text-primary-strong"
                        >
                          {it.name}
                        </button>
                        {it.category_name ? (
                          <span className="block text-xs text-muted-foreground">{it.category_name}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={it.metal === "silver" ? "blue" : "gold"}>
                          {metalLabel(it.metal, metalsData?.metals)}
                          {it.purity_code ? ` · ${it.purity_code}` : ""}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{TRACKING_LABEL[it.tracking]}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {formatWeight(it.gross_weight)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatWeight(it.net_weight)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{makingLabel(it.making_type, it.making_value)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{it.huid ?? "—"}</td>
                      <td className="px-3 py-3">
                        <Badge tone={itemStatusTone(it.status)}>{STATUS_LABEL[it.status]}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setHistoryId(it.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-primary-strong"
                            title="Stock and history"
                            aria-label="Stock and history"
                          >
                            <History className="h-4 w-4" aria-hidden />
                          </button>
                          {can("inventory.manage") ? (
                            <>
                              <button
                                onClick={() => openEdit(it)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-primary-strong"
                                title="Edit item"
                                aria-label="Edit item"
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </button>
                              <button
                                onClick={() => void deleteItem(it)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-attention-strong"
                                title="Delete item"
                                aria-label="Delete item"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <ItemFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        item={formItem}
        purities={purities}
        categories={categories}
      />
      <ItemHistoryDialog itemId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}
