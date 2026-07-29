import type {
  BillLine,
  MakingType,
  Num,
  OldMetalLine,
  PriceMode,
  Purity,
  StockItem,
} from "./types";

/**
 * Client-side jewellery maths — a MIRROR of src/Jewellery/Pricing.php, used for
 * the live figures on screen only. The server recomputes everything when the
 * draft is saved and again when the bill is finalised, so a disagreement here
 * must never block a sale.
 *
 *   metal value = net weight × rate per gram × qty   (the rate is purity-specific)
 *   making      = per gram | fixed | percent of metal value
 *   taxable     = metal + making − discount
 */

export const num = (v: Num | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Weights always read as `12.350 g` — three decimals, never truncated. */
export function formatWeight(value: Num | null | undefined): string {
  return `${num(value).toFixed(3)} g`;
}

export function makingCharge(
  type: MakingType,
  value: number,
  netWeight: number,
  metalValue: number,
  qty = 1,
): number {
  if (type === "fixed") return value * qty;
  if (type === "percent") return (metalValue * value) / 100;
  return value * netWeight * qty;
}

export interface PricedLine {
  metal_value: number;
  making_charge: number;
  discount: number;
  taxable_value: number;
  tax_amount: number;
  line_total: number;
}

/** Price one line. `inclusive` means the agreed figure already contains GST. */
export function priceLine(line: BillLine, priceMode: PriceMode): PricedLine {
  const qty = Math.max(0, num(line.qty));
  const netWeight = Math.max(0, num(line.net_weight));
  const rate = Math.max(0, num(line.rate_per_gram));
  const discount = Math.max(0, num(line.discount));

  let metalValue = round2(netWeight * rate * qty);
  let making = round2(makingCharge(line.making_type, num(line.making_value), netWeight, metalValue, qty));

  const taxable = Math.max(0, round2(metalValue + making - discount));
  const effectiveRate = line.tax_treatment === "taxable" ? Math.max(0, num(line.tax_rate)) : 0;

  let tax: number;
  let lineTotal: number;
  if (priceMode === "inclusive" && effectiveRate > 0) {
    tax = round2((taxable * effectiveRate) / (100 + effectiveRate));
    const net = round2(taxable - tax);
    lineTotal = taxable;
    const scale = taxable > 0 ? net / taxable : 1;
    metalValue = round2(metalValue * scale);
    making = round2(net - metalValue);
  } else {
    tax = round2((taxable * effectiveRate) / 100);
    lineTotal = round2(taxable + tax);
  }

  return {
    metal_value: metalValue,
    making_charge: making,
    discount: round2(discount),
    taxable_value: round2(metalValue + making - discount),
    tax_amount: tax,
    line_total: lineTotal,
  };
}

/** Value of old metal handed over, after the melting deduction. */
export function priceOldMetal(row: OldMetalLine): { net_weight: number; value: number } {
  const gross = Math.max(0, num(row.gross_weight));
  const deduction = Math.min(100, Math.max(0, num(row.deduction_pct)));
  const netWeight = round3(gross * (1 - deduction / 100));
  return { net_weight: netWeight, value: round2(netWeight * Math.max(0, num(row.rate_per_gram))) };
}

export interface BillTotals {
  metal: number;
  making: number;
  discount: number;
  tax: number;
  oldMetal: number;
  roundOff: number;
  grand: number;
  /** total before the round-off nudge — used for the estimate slip */
  beforeRounding: number;
}

/** Whole-document totals. Old metal is a credit; the bill rounds to the rupee. */
export function billTotals(
  lines: BillLine[],
  oldMetal: OldMetalLine[],
  billDiscount: number,
  priceMode: PriceMode,
  applyRounding = true,
): BillTotals {
  let metal = 0;
  let making = 0;
  let lineDiscount = 0;
  let tax = 0;

  for (const line of lines) {
    const priced = priceLine(line, priceMode);
    metal += priced.metal_value;
    making += priced.making_charge;
    lineDiscount += priced.discount;
    tax += priced.tax_amount;
  }

  const oldMetalValue = round2(oldMetal.reduce((sum, row) => sum + priceOldMetal(row).value, 0));
  const discount = round2(Math.max(0, num(billDiscount)));
  const beforeRounding = round2(round2(metal) + round2(making) - discount + round2(tax) - oldMetalValue);
  const grand = applyRounding ? Math.round(beforeRounding) : beforeRounding;

  return {
    metal: round2(metal),
    making: round2(making),
    discount: round2(discount + lineDiscount),
    tax: round2(tax),
    oldMetal: oldMetalValue,
    roundOff: round2(grand - beforeRounding),
    grand,
    beforeRounding,
  };
}

/* ----------------------------------------------------------------- factory */

let lineCounter = 0;
export const nextKey = (prefix = "l"): string => `${prefix}${++lineCounter}`;

/** Today's rate for a purity, or 0 when it has not been entered yet. */
export function rateForPurity(purities: Purity[], purityId: number | null): number {
  if (purityId === null) return 0;
  const purity = purities.find((p) => p.id === purityId);
  return num(purity?.rate_per_gram);
}

/** Turn a scanned/searched stock item into an editable bill line. */
export function lineFromStockItem(
  item: StockItem,
  purities: Purity[],
  defaultTaxRate: number,
  overrides: Partial<Pick<BillLine, "qty" | "gross_weight" | "net_weight">> = {},
): BillLine {
  const gross = overrides.gross_weight ?? num(item.gross_weight);
  const netFromItem = num(item.net_weight);
  const net = overrides.net_weight ?? (netFromItem > 0 ? netFromItem : gross);
  return {
    key: nextKey(),
    item_id: item.id,
    item_code: item.item_code,
    description: item.name,
    huid: item.huid,
    purity_id: item.purity_id,
    purity_code: item.purity_code,
    tracking: item.tracking,
    qty: overrides.qty ?? 1,
    gross_weight: gross,
    net_weight: net > 0 ? net : gross,
    rate_per_gram: rateForPurity(purities, item.purity_id),
    making_type: item.making_type ?? "per_gram",
    making_value: num(item.making_value),
    discount: 0,
    tax_rate: defaultTaxRate,
    tax_treatment: "taxable",
    exempt_reason: null,
  };
}

/** A blank line, for quoting something that is not in stock yet (estimates). */
export function blankLine(defaultTaxRate: number): BillLine {
  return {
    key: nextKey(),
    item_id: null,
    item_code: null,
    description: "",
    huid: null,
    purity_id: null,
    purity_code: null,
    tracking: "bulk",
    qty: 1,
    gross_weight: 0,
    net_weight: 0,
    rate_per_gram: 0,
    making_type: "per_gram",
    making_value: 0,
    discount: 0,
    tax_rate: defaultTaxRate,
    tax_treatment: "taxable",
    exempt_reason: null,
  };
}

export function blankOldMetal(purities: Purity[]): OldMetalLine {
  // gold is what walks in nine times out of ten
  const gold: Purity | undefined = purities.find((p) => p.metal === "gold");
  return {
    key: nextKey("o"),
    metal: "gold",
    purity_id: gold ? gold.id : null,
    description: "",
    gross_weight: 0,
    deduction_pct: 0,
    rate_per_gram: gold ? num(gold.rate_per_gram) : 0,
  };
}

/* --------------------------------------------------------------- payloads */

/** Editor line → the `items[]` shape api/invoices.php and api/estimates.php expect. */
export function lineToPayload(line: BillLine): Record<string, unknown> {
  return {
    item_id: line.item_id,
    description: line.description,
    purity_code: line.purity_code,
    qty: num(line.qty),
    gross_weight: num(line.gross_weight),
    net_weight: num(line.net_weight),
    rate_per_gram: num(line.rate_per_gram),
    making_type: line.making_type,
    making_value: num(line.making_value),
    discount: num(line.discount),
    tax_rate: num(line.tax_rate),
    tax_treatment: line.tax_treatment,
    exempt_reason: line.exempt_reason,
  };
}

export function oldMetalToPayload(row: OldMetalLine): Record<string, unknown> {
  return {
    metal: row.metal,
    purity_id: row.purity_id,
    description: row.description || null,
    gross_weight: num(row.gross_weight),
    deduction_pct: num(row.deduction_pct),
    rate_per_gram: num(row.rate_per_gram),
  };
}

/* ------------------------------------------------------------ amount words */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** Indian-English words with Lakh/Crore grouping — for "Amount in words". */
function numberToIndianWords(input: number): string {
  const n = Math.round(Math.abs(input));
  if (n === 0) return "Zero";

  const twoDigits = (v: number): string => (v < 20 ? ONES[v]! : TENS[Math.floor(v / 10)] + (v % 10 ? ` ${ONES[v % 10]}` : ""));
  const threeDigits = (v: number): string =>
    v >= 100 ? `${ONES[Math.floor(v / 100)]} Hundred${v % 100 ? ` ${twoDigits(v % 100)}` : ""}` : twoDigits(v);

  let rest = n;
  const crore = Math.floor(rest / 10000000);
  rest %= 10000000;
  const lakh = Math.floor(rest / 100000);
  rest %= 100000;
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

export function amountInWords(value: Num): string {
  const amount = num(value);
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  let words = `Rupees ${numberToIndianWords(rupees)}`;
  if (paise > 0) words += ` and ${numberToIndianWords(paise)} Paise`;
  return `${words} Only`;
}

/** "₹450 / g" · "₹1,200 fixed" · "12% of metal" — plain wording for the counter. */
export function makingLabel(type: MakingType, value: Num): string {
  const v = num(value);
  if (v === 0) return "—";
  if (type === "fixed") return `₹${v.toLocaleString("en-IN")} fixed`;
  if (type === "percent") return `${v}% of metal`;
  return `₹${v.toLocaleString("en-IN")} / g`;
}
