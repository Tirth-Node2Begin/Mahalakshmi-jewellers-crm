import type { InvoiceDetailResponse } from "@/features/invoices/types";

export const inr = (v: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(v ?? 0));

export const fmtDate = (v: string | null) =>
  v ? new Date(v.replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank Transfer",
  card: "Card",
  cheque: "Cheque",
};

/** Small-number → Indian-English words (Lakh/Crore grouping), used for "Amount in words". */
function numberToIndianWords(input: number): string {
  const n = Math.round(Math.abs(input));
  if (n === 0) return "Zero";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (v: number): string => {
    if (v < 20) return ones[v]!;
    return tens[Math.floor(v / 10)] + (v % 10 ? ` ${ones[v % 10]}` : "");
  };
  const threeDigits = (v: number): string => {
    if (v >= 100) return `${ones[Math.floor(v / 100)]} Hundred${v % 100 ? ` ${twoDigits(v % 100)}` : ""}`;
    return twoDigits(v);
  };

  let rest = n;
  const crore = Math.floor(rest / 10000000);
  rest %= 10000000;
  const lakh = Math.floor(rest / 100000);
  rest %= 100000;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  const hundred = rest;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

export function amountInWords(value: number): string {
  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);
  let words = `Rupees ${numberToIndianWords(rupees)}`;
  if (paise > 0) words += ` and ${numberToIndianWords(paise)} Paise`;
  return `${words} Only`;
}

/** Client-side print via a hidden iframe (style.md §6 / planning/09 §5). */
export function printInvoice(data: InvoiceDetailResponse): void {
  const { invoice, items, payments, company } = data;
  const balance = Number(invoice.grand_total) - Number(invoice.paid_amount);
  const isGst = Number(invoice.tax_total) > 0;
  const docTitle = isGst ? "TAX INVOICE" : "INVOICE";
  const taxableValue = Number(invoice.subtotal) - Number(invoice.discount_total);
  const addressLine = [invoice.customer_address, invoice.customer_city, invoice.customer_state].filter(Boolean).join(", ");

  const rows = items
    .map((it, idx) => {
      const meta = [
        it.metal_type,
        it.purity,
        Number(it.gross_wt) > 0 || Number(it.net_wt) > 0 ? `Gr ${it.gross_wt ?? 0}g / Net ${it.net_wt ?? 0}g` : null,
        Number(it.making_charge) > 0 ? `MC ${inr(it.making_charge ?? 0)}` : null,
        Number(it.diamond_wt) > 0 ? `Diamond ${it.diamond_wt}ct${it.diamond_grade ? ` (${it.diamond_grade})` : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
        <td class="idx">${idx + 1}</td>
        <td><div class="desc">${escapeHtml(it.description)}</div>${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ""}</td>
        <td class="muted">${it.hsn_code ? escapeHtml(it.hsn_code) : "—"}</td>
        <td class="r">${Number(it.qty)}</td>
        <td class="r">${inr(it.rate)}</td>
        <td class="r">${Number(it.discount) > 0 ? inr(it.discount) : "—"}</td>
        <td class="r">${Number(it.tax_rate)}%</td>
        <td class="r">${inr(it.line_total ?? 0)}</td>
      </tr>`;
    })
    .join("");

  const paymentRows = payments
    .map((p) => {
      const chequeInfo =
        p.payment_mode === "cheque" ? [p.cheque_number ? `#${p.cheque_number}` : "", p.cheque_status ? p.cheque_status : ""].filter(Boolean).join(" · ") : "";
      return `<tr>
        <td>${escapeHtml(p.receipt_no)}</td>
        <td>${fmtDate(p.payment_date)}</td>
        <td>${PAYMENT_MODE_LABELS[p.payment_mode] ?? escapeHtml(p.payment_mode)}</td>
        <td class="muted">${[p.bank_name ? escapeHtml(p.bank_name) : "", chequeInfo].filter(Boolean).join(" · ") || "—"}</td>
        <td class="r">${inr(p.amount)}</td>
      </tr>`;
    })
    .join("");

  const logoHtml = company.company_logo_path ? `<img class="logo" src="${escapeAttr(company.company_logo_path)}" alt="${escapeAttr(company.company_name || "Mahalakshmi Jewellers")}" />` : "";
  const companyName = escapeHtml(company.company_name || "Mahalakshmi Jewellers");

  const infoBits = [
    invoice.hallmark_no ? `<b>Hallmark / BIS:</b> ${escapeHtml(invoice.hallmark_no)}` : "",
    invoice.huid ? `<b>HUID:</b> ${escapeHtml(invoice.huid)}` : "",
    invoice.warranty_months ? `<b>Warranty:</b> ${invoice.warranty_months} months` : "",
  ].filter(Boolean).join(" &nbsp;&nbsp;·&nbsp;&nbsp; ");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_no)}</title>
  <style>
    /* Minimal, print-first: black/grey on white with a single restrained navy accent. */
    :root {
      --ink:#1f2733; --text:#3a424e; --muted:#6b7280; --faint:#9aa1ab;
      --line:#e6e8ec; --line2:#c8cdd5; --accent:#1f3a5c;
    }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #fff; color: var(--text); font-size: 12px; line-height: 1.5;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .top-accent { height: 3px; background: var(--accent); }
    .sheet { padding: 14mm 14mm 12mm; }

    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .brand { display: flex; flex-direction: column; gap: 7px; max-width: 62%; }
    .logo { height: 62px; width: auto; max-width: 210px; object-fit: contain; object-position: left top; }
    .co-name { font-size: 19px; font-weight: 800; color: var(--accent); letter-spacing: .2px; }
    .co-meta { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
    .doc-title { font-size: 21px; font-weight: 800; letter-spacing: 3px; color: var(--accent); padding-top: 2px; }

    .rule { border: 0; border-top: 1px solid var(--line); margin: 15px 0; }

    .meta-row { display: flex; justify-content: space-between; gap: 30px; }
    .label { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 5px; }
    .party .name { font-size: 14px; font-weight: 700; color: var(--ink); }
    .party .ln { font-size: 11px; color: var(--muted); margin-top: 1px; }
    .inv-meta { min-width: 210px; }
    .inv-meta .kv { display: flex; justify-content: space-between; gap: 24px; font-size: 11.5px; padding: 2.5px 0; }
    .inv-meta .kv .k { color: var(--muted); }
    .inv-meta .kv .v { color: var(--ink); font-weight: 600; }
    .inv-meta .kv .no { font-family: 'DM Mono', ui-monospace, monospace; color: var(--accent); }

    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    thead th { text-align: left; font-size: 9.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase;
      color: var(--muted); padding: 8px 7px; border-top: 1px solid var(--line2); border-bottom: 1px solid var(--line2); }
    tbody td { padding: 9px 7px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: 11.5px; }
    td.idx { color: var(--faint); width: 22px; }
    td .desc { font-weight: 600; color: var(--ink); font-size: 12px; }
    td .meta { color: var(--muted); font-size: 10px; margin-top: 2px; }
    .muted { color: var(--muted); }
    .r { text-align: right; white-space: nowrap; }

    /* footer: descriptive content (left) balances the money column (right) */
    .foot { display: flex; gap: 28px; margin-top: 14px; align-items: flex-start; }
    .foot-left { flex: 1; min-width: 0; padding-top: 2px; }
    .foot-right { width: 70mm; flex-shrink: 0; }
    .sum { width: 100%; }
    .sum .row { display: flex; justify-content: space-between; font-size: 11.5px; padding: 3px 0; }
    .sum .row .k { color: var(--muted); }
    .sum .row .v { color: var(--ink); }
    .sum .grand { display: flex; justify-content: space-between; margin-top: 6px; padding: 9px 0;
      border-top: 1.5px solid var(--accent); border-bottom: 1.5px solid var(--accent);
      font-size: 14px; font-weight: 800; color: var(--accent); }
    .sum .paid { margin-top: 7px; }
    .sum .bal .k, .sum .bal .v { font-weight: 700; color: var(--ink); }

    .words { font-size: 11.5px; color: var(--ink); line-height: 1.5; }
    .words .k { display: block; font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 4px; }
    .foot-left .info { margin-top: 14px; }

    .sec { margin-top: 20px; }
    .sec-label { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 4px; }
    .sec table { margin-top: 0; }
    .sec thead th { font-size: 9px; padding: 6px 7px; }
    .sec tbody td { font-size: 10.5px; padding: 6px 7px; }

    .info { margin-top: 16px; font-size: 10.5px; color: var(--muted); line-height: 1.7; }
    .info b { color: var(--ink); font-weight: 600; }
    .foot-note { margin-top: 18px; text-align: center; font-size: 11px; color: var(--muted); }

    .sign { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
    .sign .box { width: 210px; }
    .sign .box.right { text-align: right; }
    .sign .for { font-size: 10.5px; font-weight: 600; color: var(--ink); }
    .sign .space { height: 42px; }
    .sign .ln { border-top: 1px solid var(--line2); padding-top: 5px; font-size: 10.5px; color: var(--muted); }
  </style></head><body>
    <div class="top-accent"></div>
    <div class="sheet">
      <div class="head">
        <div class="brand">
          ${logoHtml || `<div class="co-name">${companyName}</div>`}
          <div class="co-meta">
            ${company.company_address ? `${escapeHtml(company.company_address)}<br>` : ""}
            ${[company.company_phone, company.company_email].filter(Boolean).map(escapeHtml).join(" &nbsp;·&nbsp; ")}
            ${company.company_gstin ? `${company.company_phone || company.company_email ? "<br>" : ""}GSTIN: ${escapeHtml(company.company_gstin)}` : ""}
          </div>
        </div>
        <div class="doc-title">${docTitle}</div>
      </div>

      <hr class="rule">

      <div class="meta-row">
        <div class="party">
          <div class="label">Bill To</div>
          <div class="name">${escapeHtml(invoice.customer_name ?? "")}</div>
          ${invoice.customer_company ? `<div class="ln">${escapeHtml(invoice.customer_company)}</div>` : ""}
          ${addressLine ? `<div class="ln">${escapeHtml(addressLine)}</div>` : ""}
          ${invoice.customer_mobile || invoice.customer_email ? `<div class="ln">${[invoice.customer_mobile, invoice.customer_email].filter((v): v is string => Boolean(v)).map(escapeHtml).join(" · ")}</div>` : ""}
          ${invoice.customer_gstin ? `<div class="ln">GSTIN: ${escapeHtml(invoice.customer_gstin)}</div>` : ""}
        </div>
        <div class="inv-meta">
          <div class="kv"><span class="k">Invoice No.</span><span class="v no">${escapeHtml(invoice.invoice_no)}</span></div>
          <div class="kv"><span class="k">Date</span><span class="v">${fmtDate(invoice.invoice_date)}</span></div>
          ${invoice.due_date ? `<div class="kv"><span class="k">Due date</span><span class="v">${fmtDate(invoice.due_date)}</span></div>` : ""}
          ${invoice.order_no ? `<div class="kv"><span class="k">Against order</span><span class="v">${escapeHtml(invoice.order_no)}</span></div>` : ""}
        </div>
      </div>

      <table>
        <thead><tr><th>#</th><th>Description</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc.</th><th class="r">GST%</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="foot">
        <div class="foot-left">
          <div class="words"><span class="k">Amount in words</span>${escapeHtml(amountInWords(Number(invoice.grand_total)))}</div>
          ${infoBits ? `<div class="info">${infoBits}</div>` : ""}
          ${invoice.notes ? `<div class="info"><b>Note:</b> ${escapeHtml(invoice.notes)}</div>` : ""}
        </div>
        <div class="foot-right">
          <div class="sum">
            <div class="row"><span class="k">Subtotal</span><span class="v">${inr(invoice.subtotal)}</span></div>
            ${Number(invoice.discount_total) > 0 ? `<div class="row"><span class="k">Discount</span><span class="v">− ${inr(invoice.discount_total)}</span></div><div class="row"><span class="k">Taxable value</span><span class="v">${inr(taxableValue)}</span></div>` : ""}
            ${isGst ? `<div class="row"><span class="k">CGST</span><span class="v">${inr(invoice.cgst)}</span></div><div class="row"><span class="k">SGST</span><span class="v">${inr(invoice.sgst)}</span></div>` : ""}
            ${Number(invoice.igst) > 0 ? `<div class="row"><span class="k">IGST</span><span class="v">${inr(invoice.igst)}</span></div>` : ""}
            ${Number(invoice.old_gold_adjustment) > 0 ? `<div class="row"><span class="k">Old gold exchange</span><span class="v">− ${inr(invoice.old_gold_adjustment)}</span></div>` : ""}
            <div class="grand"><span>Grand Total</span><span>${inr(invoice.grand_total)}</span></div>
            ${Number(invoice.paid_amount) > 0 ? `<div class="row paid"><span class="k">Paid</span><span class="v">${inr(invoice.paid_amount)}</span></div><div class="row bal"><span class="k">Balance due</span><span class="v">${inr(balance)}</span></div>` : ""}
          </div>
        </div>
      </div>

      ${
        payments.length > 0
          ? `<div class="sec">
        <div class="sec-label">Payments received</div>
        <table>
          <thead><tr><th>Receipt</th><th>Date</th><th>Mode</th><th>Details</th><th class="r">Amount</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>`
          : ""
      }

      ${invoice.terms || company.invoice_terms ? `<div class="info">${escapeHtml(invoice.terms || company.invoice_terms || "")}</div>` : ""}
      ${company.invoice_footer_note ? `<div class="foot-note">${escapeHtml(company.invoice_footer_note)}</div>` : ""}

      <div class="sign">
        <div class="box">
          <div class="space"></div>
          <div class="ln">Customer signature</div>
        </div>
        <div class="box right">
          <div class="for">For ${companyName}</div>
          <div class="space"></div>
          <div class="ln">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}

/** Render an HTML document in a hidden iframe and send it to the printer. */
export function openPrintWindow(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
