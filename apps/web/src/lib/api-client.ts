const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

const AUTH_KEYS = {
  access: "cdp_access_token",
  refresh: "cdp_refresh_token",
  user: "cdp_user",
};

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: ApiMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    issues?: { path: (string | number)[]; message: string }[];
  };
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  status?: string | null;
  branch_id?: string | null;
  branchLocation?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: NonNullable<ApiResponse["error"]>["issues"];

  constructor(status: number, code: string, message: string, issues?: NonNullable<ApiResponse["error"]>["issues"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getStoredAccessToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(AUTH_KEYS.access);
}

export function getStoredRefreshToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(AUTH_KEYS.refresh);
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(AUTH_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function persistSession(session: AuthSession): void {
  if (!canUseStorage()) return;
  localStorage.setItem(AUTH_KEYS.access, session.accessToken);
  localStorage.setItem(AUTH_KEYS.refresh, session.refreshToken);
  localStorage.setItem(AUTH_KEYS.user, JSON.stringify(session.user));
}

export function clearSession(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(AUTH_KEYS.access);
  localStorage.removeItem(AUTH_KEYS.refresh);
  localStorage.removeItem(AUTH_KEYS.user);
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as ApiResponse<AuthSession>;
    if (!body.success || !body.data) return false;
    persistSession(body.data);
    return true;
  } catch {
    return false;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}, retried = false): Promise<ApiResponse<T>> {
  const token = getStoredAccessToken();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !retried && getStoredRefreshToken()) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(endpoint, options, true);
  }

  const text = await response.text();
  let body: ApiResponse<T>;
  try {
    body = text ? (JSON.parse(text) as ApiResponse<T>) : ({ success: response.ok } as ApiResponse<T>);
  } catch {
    body = { success: false, error: { code: "PARSE_ERROR", message: "Invalid server response" } };
  }

  if (!response.ok || !body.success) {
    const err = body.error ?? { code: "HTTP_ERROR", message: `Request failed (${response.status})` };
    throw new ApiError(response.status, err.code, err.message ?? "Request failed", err.issues);
  }

  return body;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: "PUT", body }),
  patch: <T>(endpoint: string, body?: unknown) => request<T>(endpoint, { method: "PATCH", body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};