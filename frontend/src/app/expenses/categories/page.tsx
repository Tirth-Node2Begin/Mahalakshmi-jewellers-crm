"use client";

import { usePermissions } from "@/lib/permissions";
import { expensesApi, type ExpenseCategory, type FixedItem } from "@/features/expenses/api";
import { CategoryModal, ItemModal } from "@/features/expenses/category-modals";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Pencil, Plus, Power, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function CategoriesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"fixed" | "variable">("fixed");
  const [catModal, setCatModal] = useState<{ open: boolean; category?: ExpenseCategory | null }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean; categoryId: number; item?: FixedItem | null }>({ open: false, categoryId: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => expensesApi.categories(),
  });

  const shown = useMemo(() => (data?.categories ?? []).filter((c) => c.type === tab), [data, tab]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["expense-categories"] });

  const toggleCat = async (c: ExpenseCategory) => {
    try {
      await expensesApi.toggleCategory(c.id);
      void invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot update.");
    }
  };

  const deleteCat = async (c: ExpenseCategory) => {
    if (!window.confirm(`Delete “${c.name}”? This cannot be undone.`)) return;
    try {
      await expensesApi.deleteCategory(c.id);
      toast.success("Category deleted.");
      void invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete.");
    }
  };

  const deleteItem = async (it: FixedItem) => {
    if (!window.confirm(`Delete “${it.name}”?`)) return;
    try {
      await expensesApi.deleteItem(it.id);
      toast.success("Item deleted.");
      void invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete.");
    }
  };

  const canManage = can("expenses.update");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/expenses" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Expenses
        </Link>
        <div className="flex rounded-pill bg-background p-1">
          {(["fixed", "variable"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-pill px-5 py-1.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {can("expenses.create") ? (
          <Button size="sm" className="ml-auto" onClick={() => setCatModal({ open: true, category: null })}>
            <Plus className="h-4 w-4" aria-hidden /> New category
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {tab === "fixed"
          ? "Recurring costs with line items, tracked month-by-month in the tracker."
          : "One-off spend buckets used when recording a daily expense."}
      </p>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-card/60" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Tags} title={`No ${tab} categories yet`} hint="Create one to start organising your spend." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((cat) => {
            const locked = cat.is_system === 1;
            return (
              <Card key={cat.id} className={cn("flex flex-col", cat.is_active === 0 && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">{cat.name}</h3>
                      {locked ? (
                        <span title="Managed automatically" className="inline-flex items-center gap-1 rounded-pill bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Lock className="h-3 w-3" aria-hidden /> system
                        </span>
                      ) : null}
                      {cat.is_active === 0 ? <Badge tone="gray">inactive</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cat.type === "fixed" ? (
                        <>
                          {cat.items.length} {cat.items.length === 1 ? "line item" : "line items"}
                          {cat.items.length > 0 ? (
                            <> · <span className="tabular-nums">{formatCurrency(cat.items.reduce((s, it) => s + Number(it.amount), 0))}</span>/mo</>
                          ) : null}
                          {Number(cat.total_volume) > 0 ? (
                            <> · <span className="tabular-nums">{formatCurrency(cat.total_volume)}</span> paid so far</>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {cat.expense_count} {cat.expense_count === 1 ? "entry" : "entries"} · {formatCurrency(cat.total_volume)}
                        </>
                      )}
                    </p>
                  </div>
                  {canManage && !locked ? (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setCatModal({ open: true, category: cat })} className="text-muted-foreground hover:text-primary-strong" aria-label="Edit category">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => toggleCat(cat)} className="text-muted-foreground hover:text-warning-strong" aria-label="Toggle active">
                        <Power className="h-4 w-4" aria-hidden />
                      </button>
                      {can("expenses.delete") ? (
                        <button onClick={() => deleteCat(cat)} className="text-muted-foreground hover:text-attention-strong" aria-label="Delete category">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {cat.type === "fixed" ? (
                  <div className="mt-4 flex-1 space-y-1.5 border-t border-border/60 pt-4">
                    {cat.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No line items yet.</p>
                    ) : (
                      cat.items.map((it) => (
                        <div key={it.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-background">
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {it.name}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {Number(it.amount) > 0 ? formatCurrency(it.amount) : "—"}
                          </span>
                          {canManage && !locked ? (
                            <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button onClick={() => setItemModal({ open: true, categoryId: cat.id, item: it })} className="text-muted-foreground hover:text-primary-strong" aria-label="Edit item">
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button onClick={() => deleteItem(it)} className="text-muted-foreground hover:text-attention-strong" aria-label="Delete item">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                    {locked ? (
                      <p className="mt-2 text-xs text-muted-foreground">Managed automatically by the system.</p>
                    ) : canManage ? (
                      <button
                        onClick={() => setItemModal({ open: true, categoryId: cat.id, item: null })}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-strong hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Add line item
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 flex-1 border-t border-border/60 pt-4">
                    {locked ? (
                      <p className="text-xs text-muted-foreground">
                        Fed automatically by system entries.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Pick this when recording matching daily expenses.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CategoryModal
        open={catModal.open}
        onClose={() => setCatModal({ open: false })}
        category={catModal.category}
        defaultType={tab}
      />
      <ItemModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, categoryId: 0 })}
        categoryId={itemModal.categoryId}
        item={itemModal.item}
      />
    </div>
  );
}
