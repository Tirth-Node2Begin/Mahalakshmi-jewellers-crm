import { api } from "@/shared/api/http-client";

/** Chart of accounts, ledger statements and journal posting (api/accounting.php). */

export type Nature = "asset" | "liability" | "income" | "expense";
export type DrCr = "dr" | "cr";

export interface CoaLedger {
  id: number;
  group_id: number;
  name: string;
  code: string | null;
  linked_type: string | null;
  linked_id: number | null;
  metal: string | null;
  is_system: 0 | 1;
  is_active: 0 | 1;
  opening_balance: string;
  opening_type: DrCr;
}

/** A group node. `children` is only populated on root groups (max depth 2). */
export interface CoaGroup {
  id: number;
  name: string;
  parent_id: number | null;
  nature: Nature;
  is_system: 0 | 1;
  sort_order: number;
  ledgers: CoaLedger[];
  children?: CoaGroup[];
}

/** Flat row for dropdowns — includes per-party sub-ledgers the tree hides. */
export interface LedgerOption {
  id: number;
  name: string;
  code: string | null;
  group_id: number;
  group_name: string;
  nature: Nature;
  is_system: 0 | 1;
}

export interface CoaResponse {
  coa: CoaGroup[];
  groups: { id: number; name: string; parent_id: number | null; nature: Nature }[];
  ledgers: LedgerOption[];
}

/** The other side of the entry — where the money went to, or came from. */
export interface ContraAccount {
  name: string;
  amount: number;
  side: DrCr;
}

export interface StatementEntry {
  entry_id: number;
  voucher_id: number;
  voucher_no: string;
  vdate: string;
  vtype: string;
  ref_type: string | null;
  ref_id: number | null;
  narration: string | null;
  /** contra accounts, already prefixed "To …" (debit) or "By …" (credit) */
  particulars: string;
  contra: ContraAccount[];
  dr_amount: string;
  cr_amount: string;
  /** running balance, always positive — read it with balance_type */
  balance: number;
  balance_type: DrCr;
}

export interface LedgerStatement {
  ledger: { id: number; name: string; code: string | null; opening_balance: string; opening_type: DrCr; nature: Nature };
  view?: "full" | "gst";
  filtered_non_gst?: boolean;
  opening: number;
  opening_type: DrCr;
  entries: StatementEntry[];
  total_debit: number;
  total_credit: number;
  closing: number;
  closing_type: DrCr;
}

export interface JournalLine {
  ledger_id: number;
  dr: number;
  cr: number;
}

export const NATURE_LABEL: Record<Nature, string> = {
  asset: "Assets",
  liability: "Liabilities",
  income: "Income",
  expense: "Expenses",
};

export const accountingApi = {
  coa: () => api.get<CoaResponse>("accounting.php", { view: "coa" }),
  ledger: (ledgerId: number, from: string, to: string) =>
    api.get<{ statement: LedgerStatement }>("accounting.php", { view: "ledger", ledger_id: ledgerId, from, to }),
  createJournal: (payload: { vdate: string; narration: string; entries: JournalLine[] }) =>
    api.post<{ message: string; voucher_id: number }>("accounting.php", { action: "journal_create", ...payload }),
};
