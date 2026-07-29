import { api } from "@/shared/api/http-client";
import type { CustomerDetailResponse, CustomerListResponse } from "./types";

export const customersApi = {
  list: (params: Record<string, string | undefined>) => api.get<CustomerListResponse>("customers.php", params),
  detail: (id: number) => api.get<CustomerDetailResponse>("customers.php", { id }),
  create: (payload: Record<string, unknown>) => api.post<{ id: number }>("customers.php", { action: "create", ...payload }),
  update: (payload: Record<string, unknown>) => api.post("customers.php", { action: "update", ...payload }),
  updateStage: (id: number, stage: string) => api.post("customers.php", { action: "update_stage", id, stage }),
  addNote: (id: number, note: string) => api.post("customers.php", { action: "add_note", id, note }),
  archive: (id: number) => api.post("customers.php", { action: "archive", id }),
};
