import { escapeHtml } from "@/app/invoices/detail/print";

export interface TagToPrint {
  item_code: string;
  name: string;
  weight: string | number;
  purity: string | null;
  huid?: string | null;
}

/**
 * Print the paper tags for pieces that have just been taken into stock.
 * Deliberately plain: code, name, weight, purity — what goes on the string tag.
 * Uses a hidden iframe so the CRM page itself is never replaced (same technique
 * as the bill/receipt printing in app/invoices/detail).
 */
export function printItemTags(tags: TagToPrint[], heading = "Stock tags"): void {
  if (tags.length === 0) return;

  const cards = tags
    .map(
      (t) => `
      <div class="tag">
        <div class="code">${escapeHtml(t.item_code)}</div>
        <div class="name">${escapeHtml(t.name)}</div>
        <div class="row"><span>Weight</span><b>${Number(t.weight ?? 0).toFixed(3)} g</b></div>
        <div class="row"><span>Purity</span><b>${escapeHtml(t.purity ?? "—")}</b></div>
        ${t.huid ? `<div class="row"><span>HUID</span><b>${escapeHtml(t.huid)}</b></div>` : ""}
      </div>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'DM Sans', system-ui, -apple-system, sans-serif; }
    body { margin: 0; color: #1f2733; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 14px; margin: 0 0 10px; color: #1f3a5c; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
    .tag { border: 1px solid #c8cdd5; border-radius: 4px; padding: 5mm; page-break-inside: avoid; }
    .code { font-family: monospace; font-size: 13px; font-weight: 700; color: #1f3a5c; }
    .name { margin: 2mm 0 3mm; font-size: 11px; line-height: 1.3; }
    .row { display: flex; justify-content: space-between; border-top: 1px dashed #e6e8ec; padding: 1.5mm 0; font-size: 10px; color: #6b7280; }
    .row b { color: #1f2733; }
  </style></head><body>
    <h1>${escapeHtml(heading)}</h1>
    <div class="grid">${cards}</div>
  </body></html>`;

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
