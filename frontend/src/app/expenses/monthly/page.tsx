"use client";

import { usePermissions } from "@/lib/permissions";
import { expensesApi } from "@/features/expenses/api";
import { AddCostModal } from "@/features/expenses/add-cost-modal";
import { ItemModal } from "@/features/expenses/category-modals";
import { TrackerPayModal, type PayTarget } from "@/features/expenses/tracker-pay-modal";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { invalidateMoneyQueries } from "@/shared/api/invalidate-money";

// fiscal year runs Apr → Mar; columns in that order
const FY_MONTHS = [
  { m: 4, label: "Apr" }, { m: 5, label: "May" }, { m: 6, label: "Jun" },
  { m: 7, label: "Jul" }, { m: 8, label: "Aug" }, { m: 9, label: "Sep" },
  { m: 10, label: "Oct" }, { m: 11, label: "Nov" }, { m: 12, label: "Dec" },
  { m: 1, label: "Jan" }, { m: 2, label: "Feb" }, { m: 3, label: "Mar" },
];

/**
 * The tree guide for everything nested under a category: a continuous vertical
 * rule starting under the category's chevron, so a line item reads as belonging
 * to the heading above it instead of floating in the table.
 */
const CHILD_INDENT = "ml-[26px] border-l border-border pl-4";

function defaultFyYear() {
  const now = new Date();
  return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function MonthlyTrackerPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  // backend: paying writes an expense (create), reversing deletes one (delete)
  const canPay = can("expenses.create");
  const canUnpay = can("expenses.delete");
  const [year, setYear] = useState(defaultFyYear());
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [addItemCat, setAddItemCat] = useState<number | null>(null);
  const [addCostOpen, setAddCostOpen] = useState(false);
  const canAddItem = can("expenses.create");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", "tracker", year],
    queryFn: () => expensesApi.tracker(year),
  });

  const cellYear = (m: number) => (m >= 4 ? year : year + 1);
  const cellOf = (itemId: number, m: number) => data?.tracker?.[itemId]?.[cellYear(m)]?.[m];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["expenses"] });
  invalidateMoneyQueries(queryClient);

  const unpay = async (itemId: number, m: number) => {
    if (!window.confirm("Reverse this payment? The linked expense will be removed.")) return;
    try {
      await expensesApi.unpay({ fixed_cost_item_id: itemId, month: m, year: cellYear(m) });
      toast.success("Payment reversed.");
      void invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot reverse.");
    }
  };

  // pay every non-system, priced, still-due item in one month column
  const nonSystem = useMemo(
    () => (data?.categories ?? []).filter((c) => c.is_system === 0),
    [data],
  );
  // no line items anywhere → the grid is all dashes; show a "start here" prompt instead
  const totalItems = useMemo(
    () => (data?.categories ?? []).reduce((sum, c) => sum + c.items.length, 0),
    [data],
  );
  // "pay all" is pointless when every item is payroll-managed or unpriced
  const hasBulkTargets = useMemo(
    () => nonSystem.some((c) => c.items.some((it) => Number(it.amount) > 0)),
    [nonSystem],
  );

  const payColumn = async (m: number, label: string) => {
    const eligible = nonSystem
      .flatMap((c) => c.items)
      .filter((it) => Number(it.amount) > 0 && cellOf(it.id, m)?.payment_status !== "paid");
    if (eligible.length === 0) {
      toast.info("Nothing due to pay in this month.");
      return;
    }
    if (!window.confirm(`Pay ${eligible.length} item(s) for ${label} ${cellYear(m)}?`)) return;
    try {
      await expensesApi.markBulk({
        item_ids: eligible.map((i) => i.id),
        month: m,
        year: cellYear(m),
        payment_date: `${cellYear(m)}-${String(m).padStart(2, "0")}-05`,
        payment_mode: "cash",
      });
      toast.success("Bulk payment recorded.");
      void invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk payment failed.");
    }
  };

  const columnTotal = (m: number) =>
    (data?.categories ?? [])
      .flatMap((c) => c.items)
      .reduce((sum, it) => sum + (cellOf(it.id, m)?.payment_status === "paid" ? Number(cellOf(it.id, m)!.paid_amount) : 0), 0);

  // clicking a category's month pill: one unpaid item → the regular pay dialog,
  // several → one confirm that pays them all at their default amounts
  const payCategoryMonth = (cat: { items: { id: number; name: string; amount: string }[] }, m: number, label: string) => {
    const eligible = cat.items.filter((it) => Number(it.amount) > 0 && cellOf(it.id, m)?.payment_status !== "paid");
    if (eligible.length === 0) {
      toast.info("Nothing left to pay in this month.");
      return;
    }
    if (eligible.length === 1) {
      setPayTarget({ itemId: eligible[0].id, itemName: eligible[0].name, month: m, year: cellYear(m), defaultAmount: eligible[0].amount });
      return;
    }
    const total = eligible.reduce((s, it) => s + Number(it.amount), 0);
    if (!window.confirm(`Pay ${eligible.length} items (${formatCurrency(total)}) for ${label} ${cellYear(m)}?`)) return;
    void expensesApi
      .markBulk({
        item_ids: eligible.map((i) => i.id),
        month: m,
        year: cellYear(m),
        payment_date: `${cellYear(m)}-${String(m).padStart(2, "0")}-05`,
        payment_mode: "cash",
      })
      .then(() => {
        toast.success("Payment recorded.");
        void invalidate();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Payment failed."));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/expenses" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Expenses
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="iconSm" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-28 text-center text-sm font-semibold text-foreground">
              FY {year}-{String((year + 1) % 100).padStart(2, "0")}
            </span>
            <Button variant="ghost" size="iconSm" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {canAddItem ? (
            <Button onClick={() => setAddCostOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add cost
            </Button>
          ) : null}
        </div>
      </div>

      {!isLoading && (data?.categories ?? []).length > 0 && totalItems === 0 ? (
        <Card className="flex flex-wrap items-center gap-4 border border-dashed border-border">
          <div className="min-w-52 flex-1">
            <p className="text-sm font-semibold text-foreground">Set up your monthly costs</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add each recurring cost (rent, electricity, staff…) with its monthly amount — then mark it paid month by month below.
            </p>
          </div>
          {canAddItem ? (
            <Button onClick={() => setAddCostOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add your first cost
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {/* table-fixed + explicit first-column width: expanding/collapsing a category must
              never change any column's position */}
          <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: 1180 }}>
            <colgroup>
              <col style={{ width: 250 }} />
              {FY_MONTHS.map((mo) => (
                <col key={mo.m} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fixed cost
                </th>
                {FY_MONTHS.map((mo) => (
                  <th key={mo.m} className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground">
                    <div>{mo.label}</div>
                    {canPay && hasBulkTargets ? (
                      <button
                        onClick={() => payColumn(mo.m, mo.label)}
                        className="mt-0.5 text-[10px] font-medium text-primary-strong hover:underline"
                      >
                        pay all
                      </button>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-16 text-center text-sm text-muted-foreground">Loading tracker…</td>
                </tr>
              ) : (data?.categories ?? []).length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    {canAddItem ? (
                      <span className="inline-flex flex-col items-center gap-3">
                        No fixed costs yet.
                        <Button onClick={() => setAddCostOpen(true)}>
                          <Plus className="h-4 w-4" aria-hidden /> Add your first cost
                        </Button>
                      </span>
                    ) : (
                      <>
                        No fixed costs yet. Add them under{" "}
                        <Link href="/expenses/categories" className="text-primary-strong hover:underline">Categories</Link>.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                (data?.categories ?? []).map((cat) => (
                  <CategoryRows
                    key={cat.id}
                    cat={cat}
                    months={FY_MONTHS}
                    cellOf={cellOf}
                    canPay={canPay}
                    canUnpay={canUnpay}
                    onAddItem={canAddItem ? (categoryId) => setAddItemCat(categoryId) : undefined}
                    onPay={(itemId, itemName, m, amount) =>
                      setPayTarget({ itemId, itemName, month: m, year: cellYear(m), defaultAmount: amount })
                    }
                    onPayCategory={(m, label) => payCategoryMonth(cat, m, label)}
                    onUnpay={unpay}
                  />
                ))
              )}
            </tbody>
            {(data?.categories ?? []).length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border bg-background/60">
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Paid total
                  </td>
                  {FY_MONTHS.map((mo) => (
                    <td key={mo.m} className="px-2 py-3 text-center text-xs font-semibold tabular-nums text-foreground">
                      {columnTotal(mo.m) > 0 ? formatCurrency(columnTotal(mo.m)) : "—"}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Lock className="mr-1 inline h-3 w-3" aria-hidden />
        System categories are managed automatically — their amounts cannot be paid from this tracker.
      </p>

      <TrackerPayModal target={payTarget} banks={data?.bank_accounts ?? []} onClose={() => setPayTarget(null)} />
      <AddCostModal
        open={addCostOpen}
        categories={nonSystem.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => {
          setAddCostOpen(false);
          void invalidate();
        }}
      />
      <ItemModal
        open={addItemCat !== null}
        categoryId={addItemCat ?? 0}
        item={null}
        onClose={() => {
          setAddItemCat(null);
          void invalidate(); // refresh the tracker with the new line item
        }}
      />
    </div>
  );
}

function CategoryRows({
  cat,
  months,
  cellOf,
  canPay,
  canUnpay,
  onPay,
  onPayCategory,
  onUnpay,
  onAddItem,
}: {
  cat: {
    id: number;
    name: string;
    is_system: 0 | 1;
    system_key: string | null;
    items: { id: number; name: string; amount: string }[];
  };
  months: { m: number; label: string }[];
  cellOf: (itemId: number, m: number) => { paid_amount: string; payment_status: string } | undefined;
  canPay: boolean;
  canUnpay: boolean;
  onPay: (itemId: number, itemName: string, m: number, amount: string) => void;
  onPayCategory: (m: number, label: string) => void;
  onUnpay: (itemId: number, m: number) => void;
  onAddItem?: (categoryId: number) => void;
}) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const locked = cat.is_system === 1;

  // Salaries is a system category because its line items come from payroll, not
  // from someone typing a cost here. A padlock states that as a prohibition and
  // leaves the user nowhere to go; the place the figures ARE editable is the
  // payroll page, so point at it instead. Falls back to the padlock when the
  // user cannot open payroll, rather than offering a link that would be refused.
  const payrollLink = locked && cat.system_key === "SALARY" && can("hr.payroll.read");

  const expectedMonthly = cat.items.reduce((sum, it) => sum + Number(it.amount), 0);
  const monthPaid = (m: number) =>
    cat.items.reduce((sum, it) => {
      const cell = cellOf(it.id, m);
      return sum + (cell?.payment_status === "paid" ? Number(cell.paid_amount) : 0);
    }, 0);

  return (
    <>
      <tr className="border-b border-border/60 bg-background/50">
        <td className="sticky left-0 z-10 bg-background px-2 py-2 text-left">
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex min-w-0 items-center gap-1 rounded-lg py-0.5 pl-1 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:text-primary-strong"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")} aria-hidden />
              <span className="truncate">{cat.name}</span>
              <span className="font-normal normal-case text-muted-foreground">({cat.items.length})</span>
            </button>
            {payrollLink ? (
              <Link
                href="/hr/payroll"
                title="Salaries come from payroll — open it to add or change them"
                className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-primary/40 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-strong transition-colors hover:border-primary hover:brightness-105"
              >
                <Wallet className="h-3 w-3" aria-hidden /> Payroll
              </Link>
            ) : locked ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                title="System category — managed automatically"
              >
                <Lock className="h-3 w-3" aria-hidden /> system
              </span>
            ) : onAddItem ? (
              <button
                onClick={() => onAddItem(cat.id)}
                aria-label={`Add a cost under ${cat.name}`}
                title={`Add a cost under ${cat.name}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-strong"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </td>
        {months.map((mo) => {
          const paid = monthPaid(mo.m);
          // green only when the month is fully covered — a partial payment must not look "done"
          const fullyPaid = paid > 0 && paid + 0.005 >= expectedMonthly;
          const pillBase =
            "inline-flex max-w-full items-center justify-center overflow-hidden rounded-pill px-1.5 py-0.5 text-[11px] tabular-nums";
          // what a click on this cell should do
          const categoryPayable = !locked && canPay && cat.items.some((it) => Number(it.amount) > 0 && cellOf(it.id, mo.m)?.payment_status !== "paid");
          return (
            <td key={mo.m} className="px-1 py-2 text-center">
              {fullyPaid ? (
                <span className={cn(pillBase, "bg-success-soft font-semibold text-success-strong")} title="Paid">
                  {formatCurrency(paid)}
                </span>
              ) : paid > 0 ? (
                categoryPayable ? (
                  <button
                    onClick={() => onPayCategory(mo.m, mo.label)}
                    className={cn(pillBase, "bg-warning-soft font-semibold text-warning-strong hover:bg-warning-soft/70")}
                    title={`Partly paid — ${formatCurrency(paid)} of ${formatCurrency(expectedMonthly)}. Click to pay the rest.`}
                  >
                    {formatCurrency(paid)}
                  </button>
                ) : (
                  <span className={cn(pillBase, "bg-warning-soft font-semibold text-warning-strong")} title={`Partly paid — ${formatCurrency(paid)} of ${formatCurrency(expectedMonthly)}`}>
                    {formatCurrency(paid)}
                  </span>
                )
              ) : expectedMonthly > 0 ? (
                categoryPayable ? (
                  <button
                    onClick={() => onPayCategory(mo.m, mo.label)}
                    className={cn(pillBase, "bg-background font-medium text-muted-foreground hover:bg-primary-soft hover:text-primary-strong")}
                    title="Not paid yet — click to pay"
                  >
                    {formatCurrency(expectedMonthly)}
                  </button>
                ) : (
                  <span className={cn(pillBase, "bg-background font-medium text-muted-foreground")} title="Not paid yet">
                    {formatCurrency(expectedMonthly)}
                  </span>
                )
              ) : (
                <span className="text-border">—</span>
              )}
            </td>
          );
        })}
      </tr>
      {open && cat.items.length === 0 ? (
        <tr className="border-b border-border/40">
          <td className="sticky left-0 z-10 bg-card p-0 text-left">
            <div className={cn(CHILD_INDENT, "py-3 pr-4 text-xs text-muted-foreground")}>
              Nothing under this heading yet.
            </div>
          </td>
          <td colSpan={months.length} className="bg-card px-4 py-3 text-xs text-muted-foreground">
            {!locked && onAddItem ? (
              "Add a line item below to pay it month by month."
            ) : (
              <>
                Add them in{" "}
                <Link href="/expenses/categories" className="text-primary-strong hover:underline">Categories</Link>{" "}
                to track this cost month by month.
              </>
            )}
          </td>
        </tr>
      ) : null}
      {open && cat.items.map((it) => (
        <tr key={it.id} className="group border-b border-border/40 last:border-0 hover:bg-background/40">
          <td className="sticky left-0 z-10 bg-card p-0 text-left transition-colors group-hover:bg-background/40">
            <div className={cn(CHILD_INDENT, "flex items-center gap-2 overflow-hidden whitespace-nowrap py-2.5 pr-4")}>
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{it.name}</span>
              {Number(it.amount) > 0 ? (
                <span className="shrink-0 rounded-pill bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(it.amount)}/mo
                </span>
              ) : (
                // an unpriced item is skipped by "pay all" and shows "pay" in every
                // cell — say so rather than leaving the row looking merely blank
                <span className="shrink-0 text-[11px] font-medium text-warning-strong">no amount set</span>
              )}
            </div>
          </td>
          {months.map((mo) => {
            const cell = cellOf(it.id, mo.m);
            const paid = cell?.payment_status === "paid";
            if (locked) {
              return (
                <td key={mo.m} className="px-1 py-2.5 text-center">
                  {paid ? (
                    <span
                      className="inline-flex max-w-full items-center justify-center gap-1 rounded-pill bg-success-soft px-1.5 py-1 text-[11px] font-semibold text-success-strong tabular-nums"
                      title="Paid"
                    >
                      <Check className="h-3 w-3 shrink-0" aria-hidden />
                      {formatCurrency(cell!.paid_amount)}
                    </span>
                  ) : (
                    <span
                      className="inline-flex max-w-full items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground/60 tabular-nums"
                      title="System category — managed automatically"
                    >
                      <Lock className="h-3 w-3 shrink-0" aria-hidden />
                      {Number(it.amount) > 0 ? formatCurrency(it.amount) : null}
                    </span>
                  )}
                </td>
              );
            }
            return (
              <td key={mo.m} className="px-1 py-2.5 text-center">
                {paid ? (
                  <button
                    onClick={() => canUnpay && onUnpay(it.id, mo.m)}
                    disabled={!canUnpay}
                    title={canUnpay ? "Paid — click to reverse" : "Paid"}
                    className="inline-flex max-w-full items-center justify-center rounded-pill bg-success-soft px-1.5 py-1 text-[11px] font-semibold text-success-strong tabular-nums transition-colors enabled:hover:bg-attention-soft enabled:hover:text-attention-strong"
                  >
                    {formatCurrency(cell!.paid_amount)}
                  </button>
                ) : canPay ? (
                  <button
                    onClick={() => onPay(it.id, it.name, mo.m, it.amount)}
                    title={`Not paid — click to pay ${it.name} for ${mo.label}`}
                    className="inline-flex max-w-full items-center justify-center rounded-pill bg-background px-1.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums transition-colors hover:bg-primary-soft hover:text-primary-strong"
                  >
                    {Number(it.amount) > 0 ? formatCurrency(it.amount) : "pay"}
                  </button>
                ) : Number(it.amount) > 0 ? (
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{formatCurrency(it.amount)}</span>
                ) : (
                  <span className="text-border">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
      {open && !locked && onAddItem ? (
        <tr className="border-b border-border/40">
          <td className="sticky left-0 z-10 bg-card p-0">
            <div className={cn(CHILD_INDENT, "py-1.5 pr-4")}>
              <button
                onClick={() => onAddItem(cat.id)}
                className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add line item
              </button>
            </div>
          </td>
          <td colSpan={months.length} className="bg-card" />
        </tr>
      ) : null}
    </>
  );
}
