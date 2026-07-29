"use client";

import { accountingApi, type LedgerOption } from "@/features/accounting/api";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, localDateString } from "@/shared/utils/format";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface Row {
  ledgerId: string;
  dr: string;
  cr: string;
}

const emptyRow = (): Row => ({ ledgerId: "", dr: "", cr: "" });
const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Manual double-entry voucher. Save stays locked until debits equal credits. */
export function JournalDialog({
  open,
  onClose,
  ledgers,
}: {
  open: boolean;
  onClose: () => void;
  ledgers: LedgerOption[];
}) {
  const queryClient = useQueryClient();
  const [vdate, setVdate] = useState(localDateString());
  const [narration, setNarration] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow()]);

  const grouped = useMemo(() => {
    const map = new Map<string, LedgerOption[]>();
    for (const l of ledgers) {
      const list = map.get(l.group_name) ?? [];
      list.push(l);
      map.set(l.group_name, list);
    }
    return [...map.entries()];
  }, [ledgers]);

  const totalDr = rows.reduce((s, r) => s + num(r.dr), 0);
  const totalCr = rows.reduce((s, r) => s + num(r.cr), 0);
  const difference = totalDr - totalCr;
  const balanced = Math.abs(difference) < 0.005 && totalDr > 0;

  const validEntries = rows
    .filter((r) => r.ledgerId !== "" && (num(r.dr) > 0 || num(r.cr) > 0))
    .map((r) => ({ ledger_id: Number(r.ledgerId), dr: num(r.dr), cr: num(r.cr) }));

  const canSave = balanced && validEntries.length >= 2;

  const reset = () => {
    setVdate(localDateString());
    setNarration("");
    setRows([emptyRow(), emptyRow()]);
  };

  const save = useMutation({
    mutationFn: () => accountingApi.createJournal({ vdate, narration, entries: validEntries }),
    onSuccess: () => {
      toast.success("Journal entry saved.");
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      reset();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the entry. Please try again."),
  });

  const update = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Journal Entry"
      maxWidth={880}
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Difference</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                balanced ? "text-success-strong" : "text-attention-strong",
              )}
            >
              {formatCurrency(Math.abs(difference), true)}
            </span>
            {balanced ? <span className="text-xs text-success-strong">balanced</span> : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
            Post entry
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="journal-date" required>
              Date
            </Label>
            <Input id="journal-date" type="date" value={vdate} onChange={(e) => setVdate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground sm:grid sm:grid-cols-[1fr_9rem_9rem_2.5rem]">
            <span>Ledger</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span />
          </div>

          {rows.map((row, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_2.5rem] sm:items-center">
              <Select
                value={row.ledgerId}
                onChange={(e) => update(i, { ledgerId: e.target.value })}
                aria-label={`Ledger for line ${i + 1}`}
              >
                <option value="">Choose a ledger…</option>
                {grouped.map(([groupName, options]) => (
                  <optgroup key={groupName} label={groupName}>
                    {options.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {l.code ? ` (${l.code})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Debit"
                aria-label={`Debit for line ${i + 1}`}
                value={row.dr}
                onChange={(e) => update(i, { dr: e.target.value, cr: e.target.value ? "" : row.cr })}
                className="text-right tabular-nums"
              />
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Credit"
                aria-label={`Credit for line ${i + 1}`}
                value={row.cr}
                onChange={(e) => update(i, { cr: e.target.value, dr: e.target.value ? "" : row.dr })}
                className="text-right tabular-nums"
              />
              <Button
                variant="ghost"
                size="iconSm"
                aria-label={`Remove line ${i + 1}`}
                disabled={rows.length <= 2}
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}

          <Button variant="secondary" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add line
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-input bg-background px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Totals</span>
          <span className="flex gap-6 tabular-nums">
            <span>
              <span className="text-muted-foreground">Dr </span>
              {formatCurrency(totalDr, true)}
            </span>
            <span>
              <span className="text-muted-foreground">Cr </span>
              {formatCurrency(totalCr, true)}
            </span>
          </span>
        </div>

        {!balanced ? (
          <p className="text-xs text-muted-foreground">
            Debits and credits must match before this can be posted.
          </p>
        ) : null}

        <div>
          <Label htmlFor="journal-narration">Narration</Label>
          <Textarea
            id="journal-narration"
            value={narration}
            maxLength={255}
            placeholder="What is this entry for?"
            onChange={(e) => setNarration(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}
