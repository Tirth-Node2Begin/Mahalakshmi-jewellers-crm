import type { Invoice, InvoicePayment } from "@/features/invoices/types";
import { amountInWords, escapeHtml, fmtDate, inr, openPrintWindow, PAYMENT_MODE_LABELS } from "./print";

/**
 * "Money Received" slip for a single payment — half an A4 page, printed from a
 * hidden iframe like the invoice itself (style.md §6 / planning/09 §5).
 */
export function printPaymentReceipt({
  payment,
  invoice,
  company,
}: {
  payment: InvoicePayment;
  invoice: Invoice;
  company: Record<string, string>;
}): void {
  const companyName = escapeHtml(company.company_name || "Mahalakshmi Jewellers");
  const logoHtml = company.company_logo_path
    ? `<img class="logo" src="${escapeHtml(company.company_logo_path)}" alt="${companyName}" />`
    : "";

  const balance = Number(invoice.grand_total) - Number(invoice.paid_amount);
  const chequeBits =
    payment.payment_mode === "cheque"
      ? [
          payment.cheque_number ? `Cheque #${payment.cheque_number}` : "",
          payment.cheque_bank ? escapeHtml(payment.cheque_bank) : "",
          payment.cheque_date ? fmtDate(payment.cheque_date) : "",
          payment.cheque_status ? `Status: ${payment.cheque_status}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(payment.receipt_no)}</title>
  <style>
    :root { --ink:#1f2733; --text:#3a424e; --muted:#6b7280; --faint:#9aa1ab; --line:#e6e8ec; --line2:#c8cdd5; --accent:#1f3a5c; }
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #fff; color: var(--text); font-size: 12px; line-height: 1.5;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .top-accent { height: 3px; background: var(--accent); }
    .sheet { padding: 14mm 14mm 12mm; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
    .brand { display: flex; flex-direction: column; gap: 7px; max-width: 62%; }
    .logo { height: 56px; width: auto; max-width: 200px; object-fit: contain; object-position: left top; }
    .co-name { font-size: 19px; font-weight: 800; color: var(--accent); }
    .co-meta { font-size: 10.5px; color: var(--muted); line-height: 1.6; }
    .doc-title { font-size: 19px; font-weight: 800; letter-spacing: 2.5px; color: var(--accent); }
    .rule { border: 0; border-top: 1px solid var(--line); margin: 15px 0; }
    .label { font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 5px; }
    .meta-row { display: flex; justify-content: space-between; gap: 30px; }
    .party .name { font-size: 14px; font-weight: 700; color: var(--ink); }
    .party .ln { font-size: 11px; color: var(--muted); margin-top: 1px; }
    .kv { display: flex; justify-content: space-between; gap: 24px; font-size: 11.5px; padding: 2.5px 0; min-width: 210px; }
    .kv .k { color: var(--muted); }
    .kv .v { color: var(--ink); font-weight: 600; }
    .kv .no { font-family: 'DM Mono', ui-monospace, monospace; color: var(--accent); }
    .amount { margin-top: 18px; border-top: 1.5px solid var(--accent); border-bottom: 1.5px solid var(--accent);
      padding: 12px 0; display: flex; justify-content: space-between; align-items: baseline; }
    .amount .k { font-size: 12px; font-weight: 700; color: var(--accent); letter-spacing: .4px; }
    .amount .v { font-size: 20px; font-weight: 800; color: var(--accent); }
    .words { margin-top: 10px; font-size: 11.5px; color: var(--ink); }
    .words .k { display: block; font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--faint); margin-bottom: 4px; }
    .info { margin-top: 16px; font-size: 10.5px; color: var(--muted); line-height: 1.7; }
    .info b { color: var(--ink); font-weight: 600; }
    .sign { margin-top: 42px; display: flex; justify-content: flex-end; }
    .sign .box { width: 210px; text-align: right; }
    .sign .for { font-size: 10.5px; font-weight: 600; color: var(--ink); }
    .sign .space { height: 40px; }
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
        <div class="doc-title">MONEY RECEIVED</div>
      </div>

      <hr class="rule">

      <div class="meta-row">
        <div class="party">
          <div class="label">Received from</div>
          <div class="name">${escapeHtml(invoice.customer_name ?? "")}</div>
          ${invoice.customer_mobile ? `<div class="ln">${escapeHtml(invoice.customer_mobile)}</div>` : ""}
        </div>
        <div>
          <div class="kv"><span class="k">Receipt No.</span><span class="v no">${escapeHtml(payment.receipt_no)}</span></div>
          <div class="kv"><span class="k">Date</span><span class="v">${fmtDate(payment.payment_date)}</span></div>
          <div class="kv"><span class="k">Against bill</span><span class="v no">${escapeHtml(invoice.invoice_no)}</span></div>
          <div class="kv"><span class="k">Mode</span><span class="v">${PAYMENT_MODE_LABELS[payment.payment_mode] ?? escapeHtml(payment.payment_mode)}</span></div>
          ${payment.bank_name ? `<div class="kv"><span class="k">Bank</span><span class="v">${escapeHtml(payment.bank_name)}</span></div>` : ""}
        </div>
      </div>

      <div class="amount">
        <span class="k">AMOUNT RECEIVED</span>
        <span class="v">${inr(payment.amount)}</span>
      </div>

      <div class="words"><span class="k">Amount in words</span>${escapeHtml(amountInWords(Number(payment.amount)))}</div>

      <div class="info">
        <b>Bill total:</b> ${inr(invoice.grand_total)} &nbsp;&nbsp;·&nbsp;&nbsp;
        <b>Received so far:</b> ${inr(invoice.paid_amount)} &nbsp;&nbsp;·&nbsp;&nbsp;
        <b>Balance due:</b> ${inr(balance)}
      </div>
      ${chequeBits ? `<div class="info">${chequeBits}</div>` : ""}
      ${payment.notes ? `<div class="info"><b>Note:</b> ${escapeHtml(payment.notes)}</div>` : ""}
      ${
        payment.payment_mode === "cheque"
          ? `<div class="info">A cheque payment is subject to realisation.</div>`
          : ""
      }

      <div class="sign">
        <div class="box">
          <div class="for">For ${companyName}</div>
          <div class="space"></div>
          <div class="ln">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}
