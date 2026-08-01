"use client";

import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useEffect, useRef } from "react";
import { useCompanySettings, type CompanySettings } from "./api";
import { amountInWords, formatWeight, num } from "./calc";
import type { EstimateDetail, InvoiceDetail } from "./types";

/**
 * A4 print documents for a bill and for an estimate.
 *
 * globals.css already carries the `@media print` rule: when a `.print-invoice`
 * element is on the page, everything else on the page is hidden and the sheet is
 * laid out edge-to-edge with no browser header/footer. So nav, buttons and
 * filters simply never reach the paper.
 */

/** Fire the browser print dialog once, after the document has rendered. */
export function useAutoPrint(enabled: boolean, ready: boolean) {
  const fired = useRef(false);
  useEffect(() => {
    if (!enabled || !ready || fired.current) return;
    fired.current = true;
    const timer = setTimeout(() => window.print(), 350);
    return () => clearTimeout(timer);
  }, [enabled, ready]);
}

export function ShopHeader({ company, docTitle, docNo, docDate, extra }: {
  company: CompanySettings;
  docTitle: string;
  docNo: string;
  docDate: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary/60 pb-4">
      <div className="flex items-start gap-4">
        {company.company_logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.company_logo_path} alt="" className="h-16 w-16 shrink-0 object-contain" />
        ) : null}
        <div>
          <h3 className="text-2xl font-bold text-foreground">{company.company_name || "Mahalakshmi Jewellers"}</h3>
          {company.company_address ? (
            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{company.company_address}</p>
          ) : null}
          {company.company_phone || company.company_email ? (
            <p className="text-xs text-muted-foreground">{[company.company_phone, company.company_email].filter(Boolean).join(" · ")}</p>
          ) : null}
          {company.company_gstin ? <p className="text-xs text-muted-foreground">GSTIN: {company.company_gstin}</p> : null}
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold uppercase tracking-[2px] text-primary-strong">{docTitle}</p>
        <p className="mt-1 font-mono text-sm font-semibold text-foreground">{docNo}</p>
        <p className="text-xs text-muted-foreground">{formatDate(docDate)}</p>
        {extra}
      </div>
    </div>
  );
}

export function PartyBlock({ label, name, phone, address, gstin }: {
  label: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
}) {
  return (
    <div className="pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{name}</p>
      {phone ? <p className="text-xs text-muted-foreground">{phone}</p> : null}
      {address ? <p className="text-xs text-muted-foreground">{address}</p> : null}
      {gstin ? <p className="text-xs text-muted-foreground">GSTIN: {gstin}</p> : null}
    </div>
  );
}

export function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-6 py-0.5", strong ? "text-foreground" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}

export function Signatures({ shopName, leftLabel = "Customer signature" }: { shopName: string; leftLabel?: string }) {
  return (
    <div className="mt-12 flex items-end justify-between gap-6">
      <div className="text-xs text-muted-foreground">
        <div className="h-10 w-44 border-b border-border" />
        <p className="mt-1.5">{leftLabel}</p>
      </div>
      <div className="w-44 text-right text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">For {shopName}</p>
        <div className="h-10 border-b border-border" />
        <p className="mt-1.5">Authorised Signatory</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the bill */

export function BillPrintSheet({ invoice }: { invoice: InvoiceDetail }) {
  const company = useCompanySettings();
  const shopName = company.company_name || "Mahalakshmi Jewellers";
  const isGst = num(invoice.tax_total) > 0;
  const customerName = invoice.customer_name || invoice.walkin_name || "Walk-in customer";
  const phone = invoice.customer_mobile || invoice.walkin_phone;
  const balance = num(invoice.grand_total) - num(invoice.paid_amount);
  const taxableTotal = invoice.tax_summary.reduce((sum, row) => sum + num(row.taxable_value), 0);

  return (
    <div className="print-invoice rounded-card bg-card p-8 shadow-card" style={{ printColorAdjust: "exact" }}>
      <ShopHeader
        company={company}
        docTitle={isGst ? "Tax Invoice" : "Bill of Supply"}
        docNo={invoice.invoice_no ?? "DRAFT — not yet numbered"}
        docDate={invoice.invoice_date}
        extra={invoice.status === "cancelled" ? <p className="mt-1 text-xs font-bold uppercase text-attention-strong">Cancelled</p> : null}
      />

      <PartyBlock
        label="Bill to"
        name={customerName}
        phone={phone}
        address={invoice.customer_address}
        gstin={invoice.customer_gstin}
      />

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-y border-border text-[10px] uppercase tracking-[0.4px] text-muted-foreground">
            <th className="py-2 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Gross wt</th>
            <th className="py-2 text-right font-semibold">Net wt</th>
            <th className="py-2 text-right font-semibold">Rate / g</th>
            <th className="py-2 text-right font-semibold">Making</th>
            <th className="py-2 text-right font-semibold">GST</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={item.id} className="border-b border-border/60 align-top">
              <td className="py-2.5 text-muted-foreground">{idx + 1}</td>
              <td className="py-2.5 text-foreground">
                <span className="font-medium">{item.description}</span>
                <span className="block text-xs text-muted-foreground">
                  {[
                    item.item_code,
                    item.purity_code,
                    item.huid ? `HUID ${item.huid}` : null,
                    item.hsn_code ? `HSN ${item.hsn_code}` : null,
                    num(item.qty) !== 1 ? `${num(item.qty)} pc` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </td>
              <td className="py-2.5 text-right tabular-nums">{formatWeight(item.gross_weight)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatWeight(item.net_weight)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatCurrency(item.rate_per_gram, true)}</td>
              <td className="py-2.5 text-right tabular-nums">{formatCurrency(item.making_charge, true)}</td>
              <td className="py-2.5 text-right tabular-nums">
                {item.tax_treatment === "taxable" ? `${num(item.tax_rate)}%` : item.tax_treatment.replace(/_/g, " ")}
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(item.line_total, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-4">
          {/* the GST block a tax invoice must carry */}
          {invoice.tax_summary.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Tax summary</p>
              <table className="mt-1 w-full max-w-sm text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left font-medium">Rate</th>
                    <th className="py-1 text-right font-medium">Taxable</th>
                    <th className="py-1 text-right font-medium">CGST</th>
                    <th className="py-1 text-right font-medium">SGST</th>
                    {num(invoice.igst) > 0 ? <th className="py-1 text-right font-medium">IGST</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {invoice.tax_summary.map((row, idx) => (
                    <tr key={`${row.tax_rate}-${row.tax_treatment}-${idx}`} className="border-b border-border/50">
                      <td className="py-1">
                        {row.tax_treatment === "taxable" ? `${num(row.tax_rate)}%` : row.tax_treatment.replace(/_/g, " ")}
                      </td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(row.taxable_value, true)}</td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(row.cgst, true)}</td>
                      <td className="py-1 text-right tabular-nums">{formatCurrency(row.sgst, true)}</td>
                      {num(invoice.igst) > 0 ? <td className="py-1 text-right tabular-nums">{formatCurrency(row.igst, true)}</td> : null}
                    </tr>
                  ))}
                  <tr className="font-semibold text-foreground">
                    <td className="py-1">Total</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(taxableTotal, true)}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(invoice.cgst, true)}</td>
                    <td className="py-1 text-right tabular-nums">{formatCurrency(invoice.sgst, true)}</td>
                    {num(invoice.igst) > 0 ? <td className="py-1 text-right tabular-nums">{formatCurrency(invoice.igst, true)}</td> : null}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {invoice.old_metal.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Old metal taken in exchange</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {invoice.old_metal.map((row) => (
                  <li key={row.id}>
                    {row.metal === "silver" ? "Silver" : "Gold"} {row.purity_code ?? ""} · {formatWeight(row.gross_weight)} gross −{" "}
                    {num(row.deduction_pct)}% = {formatWeight(row.net_weight)} @ {formatCurrency(row.rate_per_gram, true)}/g ={" "}
                    <span className="font-medium text-foreground">{formatCurrency(row.value, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Amount in words</p>
            <p className="mt-1 text-sm text-foreground">{amountInWords(invoice.grand_total)}</p>
          </div>

          {invoice.notes ? (
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">Note:</span> {invoice.notes}
            </p>
          ) : null}
        </div>

        <div className="w-full space-y-1 text-sm sm:max-w-[16rem] sm:shrink-0">
          <SumRow label="Metal value" value={formatCurrency(invoice.metal_total, true)} />
          <SumRow label="Making charges" value={formatCurrency(invoice.making_total, true)} />
          {num(invoice.discount_total) > 0 ? (
            <SumRow label="Discount" value={`− ${formatCurrency(invoice.discount_total, true)}`} />
          ) : null}
          {isGst ? (
            <>
              <SumRow label="CGST" value={formatCurrency(invoice.cgst, true)} />
              <SumRow label="SGST" value={formatCurrency(invoice.sgst, true)} />
              {num(invoice.igst) > 0 ? <SumRow label="IGST" value={formatCurrency(invoice.igst, true)} /> : null}
            </>
          ) : null}
          {num(invoice.old_metal_value) > 0 ? (
            <SumRow label="Old metal given" value={`− ${formatCurrency(invoice.old_metal_value, true)}`} />
          ) : null}
          {Math.abs(num(invoice.round_off)) >= 0.005 ? (
            <SumRow label="Round off" value={formatCurrency(invoice.round_off, true)} />
          ) : null}
          <div className="mt-1 flex justify-between border-y-2 border-primary/70 py-2">
            <span className="text-base font-bold text-primary-strong">Grand Total</span>
            <span className="text-base font-bold tabular-nums text-primary-strong">{formatCurrency(invoice.grand_total, true)}</span>
          </div>
          {num(invoice.paid_amount) > 0 ? <SumRow label="Money received" value={formatCurrency(invoice.paid_amount, true)} /> : null}
          {balance > 0.005 ? <SumRow label="Balance due" value={formatCurrency(balance, true)} strong /> : null}
        </div>
      </div>

      {invoice.payments.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Received by{" "}
          {invoice.payments
            .map((p) => `${p.payment_mode.toUpperCase()} ${formatCurrency(p.amount, true)}${p.account_name ? ` (${p.account_name})` : ""}`)
            .join(", ")}
          .
        </p>
      ) : null}

      <p className="mt-5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
        {company.invoice_terms || DEFAULT_TERMS}
      </p>
      {company.invoice_footer_note ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">{company.invoice_footer_note}</p>
      ) : null}

      <Signatures shopName={shopName} />
    </div>
  );
}

const DEFAULT_TERMS =
  "Goods once sold will be taken back or exchanged as per shop policy. Weight and purity checked and accepted by the customer at the counter. Hallmarking charges included where applicable. Subject to local jurisdiction.";

/* --------------------------------------------------------- the estimate */

export function EstimatePrintSheet({ estimate }: { estimate: EstimateDetail }) {
  const company = useCompanySettings();
  const shopName = company.company_name || "Mahalakshmi Jewellers";
  const customerName = estimate.customer_name || estimate.walkin_name || "Walk-in customer";
  const phone = estimate.customer_mobile || estimate.walkin_phone;

  return (
    <div className="print-invoice relative overflow-hidden rounded-card bg-card p-8 shadow-card" style={{ printColorAdjust: "exact" }}>
      {/* an estimate must never be mistaken for a bill */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="-rotate-[24deg] whitespace-nowrap text-[2.4rem] font-black uppercase tracking-[6px] text-attention-strong opacity-[0.12]">
          Estimate — Not a Tax Invoice
        </span>
      </div>

      <div className="relative">
        <ShopHeader
          company={company}
          docTitle="Estimate"
          docNo={estimate.estimate_no}
          docDate={estimate.estimate_date}
          extra={
            estimate.valid_until ? (
              <p className="mt-1 text-xs font-semibold text-attention-strong">Valid until {formatDate(estimate.valid_until)}</p>
            ) : null
          }
        />

        <p className="mt-3 rounded-input border border-attention-soft bg-attention-soft px-3 py-2 text-xs font-semibold uppercase tracking-[1px] text-attention-strong">
          Estimate — not a tax invoice. No GST is charged on this slip.
        </p>

        <PartyBlock label="Quotation for" name={customerName} phone={phone} address={estimate.customer_address} />

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-y border-border text-[10px] uppercase tracking-[0.4px] text-muted-foreground">
              <th className="py-2 text-left font-semibold">#</th>
              <th className="py-2 text-left font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Gross wt</th>
              <th className="py-2 text-right font-semibold">Net wt</th>
              <th className="py-2 text-right font-semibold">Rate / g</th>
              <th className="py-2 text-right font-semibold">Making</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {estimate.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-border/60 align-top">
                <td className="py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="py-2.5 text-foreground">
                  <span className="font-medium">{item.description}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[item.item_code, item.purity_code, num(item.qty) !== 1 ? `${num(item.qty)} pc` : null].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums">{formatWeight(item.gross_weight)}</td>
                <td className="py-2.5 text-right tabular-nums">{formatWeight(item.net_weight)}</td>
                <td className="py-2.5 text-right tabular-nums">{formatCurrency(item.rate_per_gram, true)}</td>
                <td className="py-2.5 text-right tabular-nums">{formatCurrency(item.making_charge, true)}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">{formatCurrency(item.line_total, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">Amount in words</p>
              <p className="mt-1 text-sm text-foreground">{amountInWords(estimate.grand_total)}</p>
            </div>
            {estimate.notes ? (
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">Note:</span> {estimate.notes}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rates quoted are today&apos;s metal rates and change daily. This slip is a price estimate only — it is not a tax
              invoice, no goods have been sold and no GST has been charged. A proper bill is raised at the time of purchase.
            </p>
          </div>

          <div className="w-full space-y-1 text-sm sm:max-w-[16rem] sm:shrink-0">
            <SumRow label="Metal value" value={formatCurrency(estimate.metal_total, true)} />
            <SumRow label="Making charges" value={formatCurrency(estimate.making_total, true)} />
            {num(estimate.discount_total) > 0 ? (
              <SumRow label="Discount" value={`− ${formatCurrency(estimate.discount_total, true)}`} />
            ) : null}
            <SumRow label="GST (estimated)" value={formatCurrency(estimate.tax_estimate, true)} />
            <div className="mt-1 flex justify-between border-y-2 border-primary/70 py-2">
              <span className="text-base font-bold text-primary-strong">Estimated Total</span>
              <span className="text-base font-bold tabular-nums text-primary-strong">{formatCurrency(estimate.grand_total, true)}</span>
            </div>
          </div>
        </div>

        <Signatures shopName={shopName} />
      </div>
    </div>
  );
}
