import type { QueryClient } from "@tanstack/react-query";

/**
 * Refresh everything that reads the ledgers, after money has moved.
 *
 * Queries are cached for 60s and this app deliberately does not refetch when a
 * window regains focus (see `createAppQueryClient`). That is right for lists,
 * but it meant the Accounts page, the ledger statements and the financial
 * reports could sit on a minute-old figure after a bill was billed or a payment
 * taken — the entry was already in the database, the screen just had not asked
 * again, and there was no way to make it.
 *
 * Call this from every screen that finalises a bill, takes or cancels a payment,
 * records a purchase or expense, or posts a stock correction. The ledgers
 * themselves are always derived from the vouchers, so one refetch is all that
 * is needed for the new entry to appear.
 */
export function invalidateMoneyQueries(queryClient: QueryClient): void {
  for (const key of ["accounting", "books", "dashboard", "reports"]) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}
