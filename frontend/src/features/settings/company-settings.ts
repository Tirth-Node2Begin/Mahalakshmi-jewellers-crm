"use client";

import { api } from "@/shared/api/http-client";
import { useQuery } from "@tanstack/react-query";

export const SETTINGS_QUERY_KEY = ["settings"] as const;
export const DEFAULT_COMPANY_NAME = "Mahalakshmi Jewellers";

export type CompanySettings = Record<string, string>;
export type CompanySettingsResponse = { settings: CompanySettings };

export function fetchCompanySettings(): Promise<CompanySettingsResponse> {
  return api.get<CompanySettingsResponse>("settings.php");
}

export function useCompanySettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchCompanySettings,
  });
}

export function getCompanyName(settings?: CompanySettings | null): string {
  return settings?.company_name?.trim() || DEFAULT_COMPANY_NAME;
}

export function getCompanyLogo(settings?: CompanySettings | null): string {
  return settings?.company_logo_path?.trim() || "";
}
