import { api } from "@/shared/api/http-client";

/** Activity trail (api/audit.php). old_values/new_values arrive already json_decoded. */

export type AuditValues = Record<string, unknown> | null;

export interface AuditLog {
  id: number;
  user_id: number | null;
  /** users.full_name — null when the actor was deleted or the action was automatic */
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: AuditValues;
  new_values: AuditValues;
  ip_address: string | null;
  created_at: string;
}

export interface AuditListResponse {
  logs: AuditLog[];
  meta: { page: number; per_page: number; total: number };
}

export interface AuditListParams {
  page?: number;
  per_page?: number;
  user_id?: number;
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
}

/** Every action the backend records (grepped from Audit::log call sites). */
export const AUDIT_ACTIONS: string[] = [
  "accounting.journal_create",
  "accounting.ledger_create",
  "accounting.ledger_update",
  "estimate.cancel",
  "estimate.convert",
  "invoice.cancel",
  "invoice.draft_discard",
  "invoice.finalize",
  "invoice.reprint",
  "item.create",
  "item.update",
  "payment.cancel",
  "payment.receive",
  "payment.vendor",
  "purchase.cancel",
  "purchase.create",
  "rates.set",
  "rates.update",
  "rbac.delete_role",
  "rbac.save_permission",
  "rbac.save_role",
  "rbac.save_role_grants",
  "settings.save",
  "stock.adjust",
  "stock.opening",
  "users.assign_roles",
  "users.create",
  "users.reset_password",
  "users.toggle_active",
  "users.update",
  "voucher.cancel",
];

/** "invoice.finalize" → "Invoice finalize" — plain words for a non-technical reader. */
export function actionLabel(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "metal_rates" #12 → "Metal rates #12" */
export function entityLabel(entityType: string, entityId: number | null): string {
  const name = entityType.replace(/_/g, " ");
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  return entityId ? `${pretty} #${entityId}` : pretty;
}

export const auditApi = {
  list: (params: AuditListParams) => api.get<AuditListResponse>("audit.php", { ...params }),
};
