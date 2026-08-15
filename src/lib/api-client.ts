"use client";

/** Browser-side API helper: attaches the Firebase ID token and unwraps errors. */

type TokenProvider = () => Promise<string | null>;

let getToken: TokenProvider = async () => null;

export function setTokenProvider(provider: TokenProvider) {
  getToken = provider;
}

export async function currentToken() {
  return getToken();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}
