"use client";

import { useCompanySettings } from "@/features/billing/api";
import { amountInWords, formatWeight, num } from "@/features/billing/calc";
import { PartyBlock, ShopHeader, Signatures, SumRow } from "@/features/billing/print-sheet";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { PAYMENT_MODE_LABEL, type PurchaseDetail } from "./api";

/**
 * A4 print document for a purchase — same sheet structure as the sales bill
 * (shop header, party block, item table, totals, signatures), so every paper
 * the shop hands out or files looks like it came from one place.
 *
 * Rendered `hidden print:block` on the detail page: globals.css prints ONLY the
 * `.print-invoice` element, so the screen keeps its cards and the paper gets this.
 */
export function PurchasePrintSheet({ purchase }: { purchase: PurchaseDetail }) {
  const company = useCompanySettings();
  const shopName = company.company_name || "Mahalakshmi Jewellers";
  const paid = num(purchase.paid_amount);
  const balance = num(purchase.grand_total) - paid;
  const isGst = num(purchase.tax_total) > 0;
  const payments = purchase.payments.filter((p) => p.status === "active");
  const vendorLine = [purchase.vendor_company].filter(Boolean).join(" · ");

  return (
    <div className="print-invoice rounded-card bg-card p-8 shadow-card" style={{ printColorAdjust: "exact" }}>
      <ShopHeader
        company={company}
        docTitle="Purchase"
        docNo={purchase.purchase_no}
        docDate={purchase.purchase_date}
        extra={
          <>
            {purchase.invoice_ref ? (
              <p className="mt-1 text-xs text-muted-foreground">Vendor bill: {purchase.invoice_ref}</p>
            ) : null}
            {purchase.status === "cancelled" ? (
              <p className="mt-1 text-xs font-bold uppercase text-attention-strong">Cancelled</p>
            ) : null}
          </>
        }
      />

      <PartyBlock
        label="Purchased from"
        name={purchase.vendor_name}
        address={vendorLine || null}
        gstin={purchase.vendor_gstin}
      />

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-y border-border text-[10px] uppercase tracking-[0.4px] text-muted-foreground">
            <th className="py-2 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Weight</th>
            <th className="py-2 text-right font-semibold">Rate / g</th>
            <th className="py-2 text-right font-semibold">Making</th>
            <th className="py-2 text-right font-semibold">GST</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((line, idx) => {
            const isService = num(line.weight) <= 0;
            return (
              <tr key={line.id} className="border-b border-border/60 align-top">
                <td className="py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="py-2.5 text-foreground">
                  <span className="font-medium">{line.description || line.item_name || "Item"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[line.item_code, line.purity_code, line.huid ? `HUID ${line.huid}` : null]
                      .filter(Boolean)
                      .join(" · ") || (isService ? "Service / labour" : "")}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{num(line.qty) || 1}</td>
                <td className="py-2.5 text-right tabular-nums">{isService ? "—" : formatWeight(line.weight)}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {num(line.rate_per_gram) > 0 ? formatCurrency(line.rate_per_gram, true) : "—"}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {num(line.making_charge) > 0 ? formatCurrency(line.making_charge, true) : "—"}
                </td>
                <td className="py-2.5 text-right tabular-nums">{num(line.tax_rate) > 0 ? `${num(line.tax_rate)}%` : "—"}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(line.line_total, true)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Amount in words</p>
            <p className="mt-1 text-sm text-foreground">{amountInWords(purchase.grand_total)}</p>
          </div>

          {payments.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Payments made</p>
              <table className="mt-1 w-full max-w-sm text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left font-medium">Payment</th>
                    <th className="py-1 text-left font-medium">Date</th>
                    <th className="py-1 text-left font-medium">Mode</th>
                    <th className="py-1 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-1 font-mono">{p.payment_no}</td>
                      <td className="py-1">{formatDate(p.payment_date)}</td>
                      <td className="py-1">
                        {PAYMENT_MODE_LABEL[p.payment_mode]}
                        {p.ref_no ? ` · ${p.ref_no}` : ""}
                      </td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(p.amount, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {purchase.notes ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">Note:</span> {purchase.notes}
            </p>
          ) : null}
          {purchase.cancel_reason ? (
            <p className="text-xs text-attention-strong">
              <span className="font-semibold">Cancelled:</span> {purchase.cancel_reason}
            </p>
          ) : null}
        </div>

        <div className="w-full space-y-1 text-sm sm:max-w-[16rem] sm:shrink-0">
          <SumRow label="Subtotal" value={formatCurrency(purchase.subtotal, true)} />
          {isGst ? (
            <>
              {num(purchase.cgst) > 0 ? <SumRow label="CGST" value={formatCurrency(purchase.cgst, true)} /> : null}
              {num(purchase.sgst) > 0 ? <SumRow label="SGST" value={formatCurrency(purchase.sgst, true)} /> : null}
              {num(purchase.igst) > 0 ? <SumRow label="IGST" value={formatCurrency(purchase.igst, true)} /> : null}
            </>
          ) : null}
          {Math.abs(num(purchase.round_off)) >= 0.005 ? (
            <SumRow label="Round off" value={formatCurrency(purchase.round_off, true)} />
          ) : null}
          <div className="mt-1 flex justify-between border-y-2 border-primary/70 py-2">
            <span className="text-base font-bold text-primary-strong">Grand Total</span>
            <span className="text-base font-bold tabular-nums text-primary-strong">
              {formatCurrency(purchase.grand_total, true)}
            </span>
          </div>
          {paid > 0 ? <SumRow label="Paid" value={formatCurrency(paid, true)} /> : null}
          {balance > 0.005 ? <SumRow label="Balance to pay" value={formatCurrency(balance, true)} strong /> : null}
        </div>
      </div>

      <Signatures shopName={shopName} leftLabel="Goods received & checked by" />
    </div>
  );
}
