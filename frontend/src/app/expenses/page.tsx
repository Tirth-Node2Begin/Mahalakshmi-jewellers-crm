"use client";

import { PermissionGate, usePermissions } from "@/lib/permissions";
import { expensesApi, type Expense } from "@/features/expenses/api";
import { ExpenseModal } from "@/features/expenses/expense-modal";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate, localDateString, addDaysStr } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ChartPie, ChevronLeft, ChevronRight, Layers, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function ExpensesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(localDateString());
  const [showAll, setShowAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  // one cached fetch of the whole FY; day/type/search filter client-side
  const { data, isLoading } = useQuery({
    queryKey: ["expenses", "list"],
    queryFn: () => expensesApi.list({}),
  });

  const filtered = useMemo(() => {
    let rows = data?.expenses ?? [];
    if (!showAll) rows = rows.filter((e) => e.expense_date === day);
    if (typeFilter) rows = rows.filter((e) => e.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (e) =>
          (e.paid_to ?? "").toLowerCase().includes(q) ||
          (e.description ?? "").toLowerCase().includes(q) ||
          e.category_name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, showAll, day, typeFilter, search]);

  const dayTotal = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  const remove = async (id: number) => {
    try {
      await expensesApi.remove(id);
      toast.success("Expense deleted.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot delete.");
    }
  };

  const shiftDay = (delta: number) => setDay(addDaysStr(day, delta));

  const resetFilters = () => {
    setDay(localDateString());
    setShowAll(false);
    setTypeFilter("");
    setSearch("");
  };

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="Today" value={kpis ? formatCurrency(kpis.today) : "—"} tone="purple" />
        <KpiCard icon={Wallet} label="This FY" value={kpis ? formatCurrency(kpis.total_year) : "—"} tone="coral" />
        <KpiCard icon={Layers} label="Fixed" value={kpis ? formatCurrency(kpis.fixed_total) : "—"} tone="amber" onClick={() => setTypeFilter(typeFilter === "fixed" ? "" : "fixed")} active={typeFilter === "fixed"} />
        <KpiCard icon={Layers} label="Variable" value={kpis ? formatCurrency(kpis.variable_total) : "—"} tone="green" onClick={() => setTypeFilter(typeFilter === "variable" ? "" : "variable")} active={typeFilter === "variable"} />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          {!showAll ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="iconSm" onClick={() => shiftDay(-1)} aria-label="Previous day">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-10 w-40" />
              <Button variant="ghost" size="iconSm" onClick={() => shiftDay(1)} aria-label="Next day">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
          <Button variant={showAll ? "primary" : "secondary"} size="sm" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show by day" : "Show all"}
          </Button>
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 w-auto">
            <option value="">All types</option>
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(dayTotal)}</span>
            {/* rent/salary-style recurring costs live in their own tracker — give
                them a road from here, not only from the sidebar */}
            <Link href="/expenses/monthly" className="text-sm font-medium text-primary-strong hover:underline">
              <CalendarCheck className="mr-1 inline h-4 w-4" aria-hidden /> Fixed costs
            </Link>
            <Link href="/expenses/insights" className="text-sm font-medium text-primary-strong hover:underline">
              <ChartPie className="mr-1 inline h-4 w-4" aria-hidden /> Insights
            </Link>
            <PermissionGate permission="expenses.create">
              <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </Button>
            </PermissionGate>
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Wallet} title={showAll ? "No expenses this year" : "No expenses on this day"} hint="Record an expense to track your spend." />
        ) : (
          <ul>
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-background">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.paid_to || e.description || e.category_name}
                    {e.item_name ? <span className="ml-1 text-xs text-muted-foreground">· {e.item_name}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.category_name} · {showAll ? formatDate(e.expense_date) : e.payment_mode}
                  </p>
                </div>
                <Badge tone={e.type === "fixed" ? "amber" : "green"}>{e.type}</Badge>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-foreground">{formatCurrency(e.amount)}</span>
                {/* module-managed (salary/purchase) is read-only; tracker-linked fixed costs are edited in the tracker;
                    only pure manual variable rows get inline edit/delete (the modal only offers variable categories) */}
                <div className="flex w-16 justify-end gap-1">
                  {e.ref_table !== null ? (
                    <span className="text-xs text-muted-foreground">auto</span>
                  ) : e.fixed_cost_item_id !== null ? (
                    <Link href="/expenses/monthly" className="text-xs font-medium text-primary-strong hover:underline">tracker</Link>
                  ) : can("expenses.update") && e.category_is_system === 0 ? (
                    <>
                      <button onClick={() => { setEditing(e); setModalOpen(true); }} className="text-muted-foreground hover:text-primary-strong" aria-label="Edit">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      {can("expenses.delete") ? (
                        <button onClick={() => remove(e.id)} className="text-muted-foreground hover:text-attention-strong" aria-label="Delete">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data ? (
        <ExpenseModal open={modalOpen} onClose={() => setModalOpen(false)} expense={editing} categories={data.categories} banks={data.bank_accounts} />
      ) : null}
    </div>
  );
}
