"use client";

import { usePermissions } from "@/lib/permissions";

/**
 * Cost/value figures on stock screens are only sent by the server when the user
 * holds reports.stock or accounting.read (api/stock.php `$canSeeCost`).
 * Mirror that rule in the UI so we never render an empty money column.
 */
export function useCanSeeCost(): boolean {
  const { canAny } = usePermissions();
  return canAny("reports.stock", "accounting.read");
}
