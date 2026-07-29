/** Runtime configuration — planning/04 §3. */

export function getApiBase(): string {
  if (process.env.NODE_ENV === "production") {
    // Deployed self-contained under /crm/ (endpoints at /crm/api, with its own
    // src/.env) so it never collides with the public site's /api backend.
    // See build.bat / the deploy layout.
    return "/crm/api";
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000/api`;
  }
  return "http://localhost:8000/api";
}

export const STORAGE_KEYS = {
  theme: "crm_theme",
  rememberUsername: "crm_remember_username",
} as const;

export const CSRF_COOKIE = "crm_csrf_token";
export const AUTH_EXPIRED_EVENT = "crm:auth-expired";
