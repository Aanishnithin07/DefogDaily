/**
 * Hash-based routing.
 *
 * The app previously held the current view in useState, which meant the browser
 * back button either did nothing or left the site entirely, refreshing dumped
 * you back on the landing page, and no screen could be linked to or shared.
 *
 * Hash routing is used rather than the History API deliberately: DefogDaily is
 * a static bundle that people will host on GitHub Pages, Netlify drop, or a
 * plain file server, none of which reliably rewrite deep paths to index.html.
 * A hash route works everywhere with no server config.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

/** Routes that can be linked to or restored on load. */
export const ROUTES = {
  landing: "/",
  report: "/report",
  train: "/train",
  practice: "/practice",
  progress: "/progress",
  scan: "/scan",
  results: "/results",
};

const PATH_TO_VIEW = Object.fromEntries(Object.entries(ROUTES).map(([view, path]) => [path, view]));

/**
 * Transient views. A scan is in-flight state and results belong to a run that
 * only exists in memory, so restoring either from a cold load would show an
 * empty or broken screen. Both fall back to a sensible landing spot instead.
 */
export const TRANSIENT_VIEWS = new Set(["scan", "results"]);

/** Split "#/scan?mode=daily" into its path and its query. */
const split = (hash) => {
  const raw = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const path = !pathPart || pathPart === "/" ? "/" : (pathPart.startsWith("/") ? pathPart : `/${pathPart}`).replace(/\/+$/, "") || "/";
  return { path, query: queryPart };
};

const normalize = (hash) => split(hash).path;

export const viewFromHash = (hash) => PATH_TO_VIEW[normalize(hash)] ?? null;

/** Query params on the hash, used by the PWA manifest shortcuts. */
export const paramsFromHash = (hash) => {
  const { query } = split(hash);
  if (!query) return {};
  const out = {};
  for (const [k, v] of new URLSearchParams(query)) out[k] = v;
  return out;
};

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const subscribe = (listener) => {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("hashchange", emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("hashchange", emit);
  };
};

const getSnapshot = () => (typeof window === "undefined" ? "#/" : window.location.hash || "#/");
const getServerSnapshot = () => "#/";

/**
 * Current view plus a navigate function.
 *
 * @param {(view: string) => string} resolve maps a requested view to the view
 *   that should actually render — lets the app redirect away from routes whose
 *   data does not exist yet (e.g. /results with nothing in memory).
 */
export function useRoute(resolve) {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const matched = viewFromHash(hash);
  const requested = matched ?? "landing";
  const params = useMemo(() => paramsFromHash(hash), [hash]);
  const view = resolve ? resolve(requested, params) : requested;

  // Correct the URL when the route was redirected (a guard sent us elsewhere)
  // or when it never matched at all (#/nonsense), so back/forward, refresh and
  // anything the user copies out of the address bar all stay truthful.
  useEffect(() => {
    if (matched && view === requested) return;
    const target = `#${ROUTES[view] ?? "/"}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", target);
      emit();
    }
  }, [view, requested, matched]);

  const navigate = useCallback((next, { replace = false } = {}) => {
    const target = `#${ROUTES[next] ?? "/"}`;
    if (window.location.hash === target) return;
    if (replace) {
      window.history.replaceState(null, "", target);
      emit();
    } else {
      window.location.hash = target;
    }
  }, []);

  return { view, requested, params, navigate };
}
