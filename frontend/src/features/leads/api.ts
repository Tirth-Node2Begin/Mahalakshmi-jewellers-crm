import { api } from "@/shared/api/http-client";
import type { LeadListResponse } from "./types";

export const leadsApi = {
  list: (params: Record<string, string | undefined>) => api.get<LeadListResponse>("leads.php", params),
  create: (payload: Record<string, unknown>) => api.post<{ id: number }>("leads.php", { action: "create", ...payload }),
  update: (payload: Record<string, unknown>) => api.post("leads.php", { action: "update", ...payload }),
  delete: (id: number) => api.post("leads.php", { action: "delete", id }),
};
