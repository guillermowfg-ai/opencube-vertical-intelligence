/**
 * The one place this app talks to the back end.
 *
 * Every route here is a read except `createTask`, which is the product's only
 * write. It posts to the public product route `POST /runs`; the internal
 * `/tasks/*` Cloud Tasks handlers are never referenced from browser code and
 * a test asserts that. `createTask` refuses outright unless Product Mode is
 * on, so a future read-only build cannot launch anything by accident.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { canLaunchTasks } from "../product/mode";
import type {
  BusinessListResponse,
  CatalogResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  MatchDetail,
  MatchListResponse,
  MatchStatus,
  OverviewResponse,
  RunBusinessesResponse,
  RunListResponse,
  RunStatusResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;

  constructor(status: number, message: string, detail: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Distinguishes "the backend said no" from "the backend was unreachable",
   * because those need different words on screen. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

async function request<T>(
  path: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Could not reach the OpenCube Intel API.", null);
  }

  if (!response.ok) {
    let detail: string | null = null;
    try {
      const body = await response.json();
      detail = typeof body?.detail === "string" ? body.detail : null;
    } catch {
      detail = null;
    }
    throw new ApiError(
      response.status,
      detail ?? `Request failed with status ${response.status}.`,
      detail,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  overview: (signal?: AbortSignal) =>
    request<OverviewResponse>(`/overview${query({ recent_runs: 5, highlights: 6 })}`, signal),

  runs: (limit = 50, signal?: AbortSignal) =>
    request<RunListResponse>(`/runs${query({ limit })}`, signal),

  run: (runId: string, signal?: AbortSignal) =>
    request<RunStatusResponse>(`/runs/${encodeURIComponent(runId)}`, signal),

  runBusinesses: (runId: string, signal?: AbortSignal) =>
    request<RunBusinessesResponse>(
      `/runs/${encodeURIComponent(runId)}/businesses`,
      signal,
    ),

  matches: (
    options: { runId?: string; matchStatus?: MatchStatus | null; limit?: number } = {},
    signal?: AbortSignal,
  ) =>
    request<MatchListResponse>(
      `/matches${query({
        run_id: options.runId,
        match_status: options.matchStatus,
        limit: options.limit ?? 300,
      })}`,
      signal,
    ),

  match: (matchId: string, signal?: AbortSignal) =>
    request<MatchDetail>(`/matches/${encodeURIComponent(matchId)}`, signal),

  businesses: (signal?: AbortSignal) =>
    request<BusinessListResponse>(`/businesses`, signal),

  catalog: (signal?: AbortSignal) => request<CatalogResponse>(`/catalog`, signal),

  /**
   * Launch a task. The product's only write, and the only cost-bearing call
   * in the app -- it enqueues real discovery and real model work.
   *
   * `provider_capabilities` is the sole field `CreateRunRequest` accepts
   * beyond the frozen vertical and geography, so nothing else is sent. Vertical
   * and geography are deliberately omitted rather than echoed back: the API
   * treats a mismatch as a 422, and sending values we did not let the user
   * choose would only create a way to get that wrong.
   */
  createTask: (body: CreateTaskRequest, signal?: AbortSignal) => {
    if (!canLaunchTasks) {
      return Promise.reject(
        new ApiError(0, "Launching tasks is disabled in this build.", null),
      );
    }
    return request<CreateTaskResponse>(`/runs`, signal, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export interface Resource<T> {
  data: T | null;
  error: ApiError | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  /** True while a later fetch is in flight and previous data is still on
   * screen — a live run must not blink back to skeletons every poll. */
  refreshing: boolean;
  reload: () => void;
}

interface Settled<T> {
  key: string;
  data: T | null;
  error: ApiError | null;
}

const NOTHING: Settled<never> = { key: "", data: null, error: null };

/**
 * Minimal data hook: fetch on mount, abort on unmount, refetch when `deps`
 * change, and optionally poll. No cache layer — at this scale a request is
 * cheap and a stale progress number is not.
 *
 * `loading` and `refreshing` are derived from whether the settled result
 * matches the request currently wanted, rather than set from inside the
 * effect. That keeps a poll from triggering a second render pass purely to
 * announce that it started.
 */
export function useResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { pollMs?: number | null } = {},
): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>(NOTHING);

  const key = `${JSON.stringify(deps)}#${nonce}`;
  const pollMs = options.pollMs ?? null;

  // Callers pass an inline closure, so the fetcher's identity changes on
  // every render and cannot be an effect dependency. `key` is the real
  // dependency; the ref only carries the latest closure across to it.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (!cancelled) setSettled({ key, data: result, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }
        const error =
          caught instanceof ApiError
            ? caught
            : new ApiError(0, "Something went wrong loading this view.", null);
        // Previous data is deliberately retained: a failed poll should show a
        // stale-but-real screen, not wipe it.
        setSettled((previous) => ({ key, data: previous.data, error }));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key]);

  useEffect(() => {
    if (!pollMs) return;
    const id = window.setInterval(() => setNonce((n) => n + 1), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const inFlight = settled.key !== key;

  return {
    data: settled.data,
    error: settled.error,
    loading: inFlight && settled.data === null && settled.error === null,
    refreshing: inFlight && settled.data !== null,
    reload,
  };
}
