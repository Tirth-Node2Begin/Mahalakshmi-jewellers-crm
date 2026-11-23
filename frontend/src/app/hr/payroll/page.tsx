"use client";

import { hrApi } from "@/features/hr/api";
import type { BankAccount, PaymentMode, PayrollItem, PayrollItemStatus, PayrollRunStatus } from "@/features/hr/types";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, IndianRupee, Pencil, RefreshCw, ShieldCheck, UsersRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const RUN_TONE: Record<PayrollRunStatus, "amber" | "green" | "gray"> = {
  draft: "amber",
  completed: "green",
  paid: "gray",
};

const ITEM_TONE: Record<PayrollItemStatus, "amber" | "green" | "gray"> = {
  draft: "amber",
  finalized: "green",
  paid: "gray",
};

const PAYMENT_MODES: PaymentMode[] = ["cash", "bank", "upi", "cheque", "card"];

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [runId, setRunId] = useState<number | undefined>();
  const [payPeriod, setPayPeriod] = useState(localDateString().slice(0, 7));
  const [adjusting, setAdjusting] = useState<PayrollItem | null>(null);
  const [paying, setPaying] = useState<PayrollItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr", "payroll", runId],
    queryFn: () => hrApi.payroll(runId),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["hr", "payroll"] });
  const run = data?.run ?? null;
  const items = data?.items ?? [];
  const paidCount = items.filter((item) => item.status === "paid").length;

  const createRun = useMutation({
    mutationFn: (period: string) => hrApi.createPayrollRun(period),
    onSuccess: (created) => {
      toast.success("Payroll run created.");
      setRunId(created.id);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create payroll."),
  });

  const recompute = useMutation({
    mutationFn: (id: number) => hrApi.recomputePayroll(id),
    onSuccess: () => {
      toast.success("Payroll recomputed.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not recompute payroll."),
  });

  const finalize = useMutation({
    mutationFn: (id: number) => hrApi.finalizePayroll(id),
    onSuccess: () => {
      toast.success("Payroll finalized.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not finalize payroll."),
  });

  const unpay = useMutation({
    mutationFn: (itemId: number) => hrApi.unpaySalary(itemId),
    onSuccess: () => {
      toast.success("Salary payment reversed.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reverse salary."),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={UsersRound} label="Employees" value={run?.total_employees ?? "-"} tone="purple" />
        <KpiCard icon={IndianRupee} label="Gross" value={run ? formatCurrency(run.total_gross) : "-"} tone="sky" />
        <KpiCard icon={ShieldCheck} label="Deductions" value={run ? formatCurrency(run.total_deductions) : "-"} tone="amber" />
        <KpiCard icon={Wallet} label="Net payable" value={run ? formatCurrency(run.total_net) : "-"} tone="green" />
        <KpiCard icon={CheckCircle2} label="Paid" value={`${paidCount}/${items.length}`} tone="gray" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Select value={run?.id ? String(run.id) : ""} onChange={(e) => setRunId(e.target.value ? Number(e.target.value) : undefined)} className="h-10 w-auto">
            {(data?.runs ?? []).length === 0 ? <option value="">No payroll runs</option> : null}
            {(data?.runs ?? []).map((payrollRun) => (
              <option key={payrollRun.id} value={payrollRun.id}>
                {payrollRun.pay_period} - {payrollRun.status}
              </option>
            ))}
          </Select>
          {run ? <Badge tone={RUN_TONE[run.status]}>{run.status}</Badge> : null}
          {run?.computed_at ? <span className="text-xs text-muted-foreground">computed {formatDate(run.computed_at)}</span> : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {can("hr.payroll.manage") ? (
              <>
                <Input type="month" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} className="h-10 w-40" aria-label="Payroll month" />
                <Button size="sm" onClick={() => createRun.mutate(payPeriod)} loading={createRun.isPending}>
                  Create run
                </Button>
              </>
            ) : null}
            {run && run.status === "draft" && can("hr.payroll.manage") ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => recompute.mutate(run.id)} loading={recompute.isPending}>
                  <RefreshCw className="h-4 w-4" aria-hidden /> Recompute
                </Button>
                <Button variant="cta" size="sm" onClick={() => finalize.mutate(run.id)} loading={finalize.isPending}>
                  Finalize
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : !run ? (
          <EmptyState icon={Wallet} title="No payroll run yet" hint="Create a monthly payroll run after adding employees." />
        ) : items.length === 0 ? (
          <EmptyState icon={UsersRound} title="No employees in this run" hint="Active employees with a joining date in this period are included." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background text-left text-xs uppercase tracking-[0.4px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Bonus</th>
                  <th className="px-4 py-3 text-right">Deduction</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{item.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.employee_code}
                        {item.department_name ? ` - ${item.department_name}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-medium text-foreground">{Number(item.payable_days).toFixed(1)} / {Number(item.working_days).toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{item.late_count} late</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.gross)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.bonus)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.deduction)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{formatCurrency(item.net)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ITEM_TONE[item.status]}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {run.status === "draft" && can("hr.payroll.manage") ? (
                          <Button variant="ghost" size="iconSm" onClick={() => setAdjusting(item)} aria-label="Adjust salary">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                        ) : null}
                        {item.status === "finalized" && can("hr.payroll.pay") ? (
                          <Button size="sm" onClick={() => setPaying(item)}>
                            Pay
                          </Button>
                        ) : null}
                        {item.status === "paid" && can("hr.payroll.pay") ? (
                          <Button variant="ghost" size="sm" onClick={() => unpay.mutate(item.id)}>
                            Reverse
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdjustmentDialog item={adjusting} onClose={() => setAdjusting(null)} onDone={invalidate} />
      <PayDialog item={paying} banks={data?.bank_accounts ?? []} onClose={() => setPaying(null)} onDone={invalidate} />
    </div>
  );
}

function AdjustmentDialog({ item, onClose, onDone }: { item: PayrollItem | null; onClose: () => void; onDone: () => void }) {
  const [bonus, setBonus] = useState("");
  const [deduction, setDeduction] = useState("");
  const [overrideNet, setOverrideNet] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setBonus(String(item.bonus ?? ""));
      setDeduction(String(item.deduction ?? ""));
      setOverrideNet(item.override_net ? String(item.override_net) : "");
      setNote(item.deduction_note ?? "");
    }
  }, [item]);

  const save = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await hrApi.updatePayrollItem({
        item_id: item.id,
        bonus: bonus ? Number(bonus) : 0,
        deduction: deduction ? Number(deduction) : 0,
        override_net: overrideNet ? Number(overrideNet) : null,
        deduction_note: note || null,
      });
      toast.success("Salary adjusted.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not adjust salary.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      title={item ? `Adjust ${item.employee_name}` : "Adjust salary"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save adjustment</Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <Label htmlFor="pay_bonus">Bonus</Label>
          <Input id="pay_bonus" inputMode="decimal" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pay_deduction">Deduction</Label>
          <Input id="pay_deduction" inputMode="decimal" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pay_override">Final net</Label>
          <Input id="pay_override" inputMode="decimal" value={overrideNet} onChange={(e) => setOverrideNet(e.target.value)} placeholder="Auto" />
        </div>
        <div className="sm:col-span-3">
          <Label htmlFor="pay_note">Note</Label>
          <Textarea id="pay_note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}

function PayDialog({
  item,
  banks,
  onClose,
  onDone,
}: {
  item: PayrollItem | null;
  banks: BankAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(localDateString());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [bankId, setBankId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setDate(localDateString());
      setMode("cash");
      setBankId("");
    }
  }, [item]);

  const pay = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await hrApi.paySalary({
        item_id: item.id,
        payment_date: date,
        payment_mode: mode,
        bank_account_id: bankId ? Number(bankId) : null,
      });
      toast.success("Salary paid.");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not pay salary.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!item}
      onClose={onClose}
      title={item ? `Pay ${item.employee_name}` : "Pay salary"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={pay} loading={saving}>Pay salary</Button>
        </>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="rounded-input bg-primary-soft p-4">
            <p className="text-xs font-medium uppercase tracking-[0.4px] text-primary-strong">Net payable</p>
            <p className="mt-1 text-3xl font-bold text-primary-strong">{formatCurrency(item.net)}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="salary_date">Payment date</Label>
              <Input id="salary_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="salary_mode">Mode</Label>
              <Select id="salary_mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map((paymentMode) => (
                  <option key={paymentMode} value={paymentMode}>{paymentMode}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="salary_bank">Bank account</Label>
              <Select id="salary_bank" value={bankId} onChange={(e) => setBankId(e.target.value)} disabled={mode === "cash"}>
                <option value="">Not needed</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.account_name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
