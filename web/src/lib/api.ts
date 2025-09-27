import { z } from 'zod';

/**
 * The single place the API is reached from.
 *
 * The legacy client called fetch directly at roughly thirty sites, each with
 * `http://localhost:5000` written in and each reading the token from
 * localStorage itself. There was nowhere to change the base URL, attach
 * credentials, or handle an expired session.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const TOKEN_KEY = 'srms.token';

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Mirrors the error envelope the API returns for every failure. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { path: string; message: string }[];
  readonly meta: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: { path: string; message: string }[] = [],
    meta: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.meta = meta;
  }

  /** Field errors keyed by name, for handing straight to a form. */
  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((detail) => [detail.path, detail.message]));
  }
}

/** Called when the API reports the session is no longer usable. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as multipart. Used for report submissions with attachments. */
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, signal } = options;
  const headers: Record<string, string> = {};

  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (formData) {
    // Content-Type is left unset so the browser adds the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload, signal });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    const asError = apiErrorSchema.safeParse(parsed);

    if (asError.success) {
      const { code, message, details, meta } = asError.data.error;

      // An expired or rejected token means the stored session is dead; clearing
      // it here is what stops every subsequent call from failing the same way.
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID' || code === 'UNAUTHENTICATED') {
        tokenStore.clear();
        onSessionExpired?.();
      }

      throw new ApiError(response.status, code, message, details ?? [], meta ?? {});
    }

    throw new ApiError(
      response.status,
      'UNKNOWN',
      `Request failed with status ${response.status}`
    );
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', formData }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  patchForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'PATCH', formData }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Builds a query string, omitting empty values so the URL stays clean. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
