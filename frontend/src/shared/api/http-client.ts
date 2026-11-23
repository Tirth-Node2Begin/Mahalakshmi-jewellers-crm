import { AUTH_EXPIRED_EVENT, CSRF_COOKIE, getApiBase } from "@/configs/app.config";
import { normalizeApiError } from "./api-error";

/**
 * HttpClient - cookie credentials, X-CSRF-Token on mutations, no-store,
 * one silent refresh retry on 401, then a global auth-expired event.
 */

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  skipAuthRetry?: boolean;
}

const MUTATION_METHODS: Method[] = ["POST", "PUT", "PATCH", "DELETE"];
const AUTH_ENDPOINTS = ["v1/auth/login.php", "v1/auth/refresh.php", "v1/auth/logout.php"];
const inFlightGetRequests = new Map<string, Promise<unknown>>();

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function buildUrl(endpoint: string, params?: RequestOptions["params"]): string {
  const url = new URL(
    `${getApiBase()}/${endpoint.replace(/^\//, "")}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

class HttpClient {
  async request<T>(endpoint: string, options: RequestOptions = {}, retriedAuth = false): Promise<T> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;

    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    if (MUTATION_METHODS.includes(method)) {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }

    const url = buildUrl(endpoint, options.params);
    const dedupeKey = method === "GET" && !options.signal && !retriedAuth ? url : null;
    if (dedupeKey) {
      const existing = inFlightGetRequests.get(dedupeKey);
      if (existing) return existing as Promise<T>;
    }

    const run = async (): Promise<T> => {
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body,
          credentials: "include",
          cache: "no-store",
          signal: options.signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw normalizeApiError(null, 0, endpoint);
      }

      const parsed = await parseBody(response);

      if (!response.ok) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some((a) => endpoint.includes(a));
        if (response.status === 401 && !retriedAuth && !options.skipAuthRetry && !isAuthEndpoint) {
          try {
            await this.request("v1/auth/refresh.php", { method: "POST", skipAuthRetry: true }, true);
            return this.request<T>(endpoint, options, true);
          } catch {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
            }
          }
        }
        throw normalizeApiError(parsed, response.status, endpoint);
      }

      return parsed as T;
    };

    if (!dedupeKey) return run();

    const promise = run();
    inFlightGetRequests.set(dedupeKey, promise);
    try {
      return await promise;
    } finally {
      inFlightGetRequests.delete(dedupeKey);
    }
  }

  get<T>(endpoint: string, params?: RequestOptions["params"], signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { params, signal });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body });
  }

  formPost<T>(endpoint: string, form: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body: form });
  }
}

export const api = new HttpClient();
