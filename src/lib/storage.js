/**
 * Local-first persistence. Everything DefogDaily offers works with zero signup
 * and zero backend — Firebase is a sync bonus, never a gate. This module owns
 * the whole client-side store and exposes a tiny subscribe API so React can
 * read it through useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";
import { DOMAIN_KEYS } from "./domains";

const STORE_KEY = "defogdaily:store:v2";
const LEGACY_SKILL_KEY = "defogdaily_skill_v1";

const emptyDomainStat = () => ({
  sessions: 0,
  best: 0,
  ema: null,
  last: null,
  history: [], // [{ t: epochMs, s: score }] capped at 120 entries
});

const defaultState = () => ({
  version: 2,
  createdAt: Date.now(),
  profile: DOMAIN_KEYS.reduce((acc, key) => {
    acc[key] = emptyDomainStat();
    return acc;
  }, {}),
  sessions: [], // newest last, capped at 200
  streak: { current: 0, longest: 0, lastDay: null, totalDays: 0 },
  xp: { total: 0 },
  achievements: {}, // { [id]: unlockedAtMs }
  plan: null,
  lastScan: null, // raw telemetry of the most recent scan, for report rebuilds
  totalSessions: 0, // lifetime count; sessions[] is capped, this is not
  practice: {}, // per-domain drill reps — training effort, not measurement
  prefs: {
    sound: true,
    haptics: true,
    age: null,
    shortcuts: true,
    displayName: null,
  },
});

let state = null;
const listeners = new Set();

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

/** Merge persisted JSON over defaults so new fields never crash old installs. */
const hydrate = (raw) => {
  const base = defaultState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    const profile = { ...base.profile };
    for (const key of DOMAIN_KEYS) {
      profile[key] = { ...emptyDomainStat(), ...(parsed.profile?.[key] ?? {}) };
      if (!Array.isArray(profile[key].history)) profile[key].history = [];
    }
    return {
      ...base,
      ...parsed,
      profile,
      streak: { ...base.streak, ...(parsed.streak ?? {}) },
      xp: { ...base.xp, ...(parsed.xp ?? {}) },
      prefs: { ...base.prefs, ...(parsed.prefs ?? {}) },
      achievements: parsed.achievements ?? {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      plan: parsed.plan ?? null,
      lastScan: parsed.lastScan ?? null,
      totalSessions:
        typeof parsed.totalSessions === "number"
          ? parsed.totalSessions
          : Array.isArray(parsed.sessions)
          ? parsed.sessions.length
          : 0,
      practice:
        parsed.practice && typeof parsed.practice === "object" && !Array.isArray(parsed.practice)
          ? parsed.practice
          : {},
    };
  } catch {
    return base;
  }
};

/** One-time import of the v1 skill profile so early users keep their history. */
const migrateLegacy = (next) => {
  if (!isBrowser()) return next;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_SKILL_KEY);
    if (!legacyRaw) return next;
    const legacy = JSON.parse(legacyRaw);
    let touched = false;
    for (const key of ["speed", "memory", "stroop", "spatial"]) {
      const old = legacy?.[key];
      if (!old || !old.sessions) continue;
      const slot = next.profile[key];
      if (slot.sessions > 0) continue;
      slot.sessions = old.sessions;
      slot.best = old.bestScore ?? 0;
      slot.ema = old.rollingAverage ?? null;
      slot.last = old.rollingAverage ?? null;
      touched = true;
    }
    if (touched) next.migratedFromV1 = true;
    window.localStorage.removeItem(LEGACY_SKILL_KEY);
  } catch {
    /* legacy data is best-effort; never block boot on it */
  }
  return next;
};

const read = () => {
  if (state) return state;
  if (!isBrowser()) {
    state = defaultState();
    return state;
  }
  state = migrateLegacy(hydrate(window.localStorage.getItem(STORE_KEY)));
  return state;
};

/**
 * Progressively shed the largest data first when the browser refuses a write.
 * Losing old trial detail is always better than losing the whole store, which
 * is what an unhandled QuotaExceededError amounts to.
 */
const SHED_STEPS = [
  (s) => ({ ...s, lastScan: s.lastScan ? { ...s.lastScan, rawScores: null } : null }),
  (s) => ({ ...s, sessions: s.sessions.slice(-60) }),
  (s) => ({
    ...s,
    sessions: s.sessions.slice(-20).map(({ metrics: _drop, ...rest }) => rest),
  }),
  (s) => ({ ...s, sessions: s.sessions.slice(-5), lastScan: null }),
];

let quotaWarned = false;

const persist = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return;
  } catch (error) {
    // Private mode, a full disk, or genuine quota exhaustion. Try to keep the
    // most valuable data (profile, streak, XP, achievements, plan) alive by
    // dropping bulk history rather than failing the write entirely.
    for (const shed of SHED_STEPS) {
      try {
        const reduced = shed(state);
        window.localStorage.setItem(STORE_KEY, JSON.stringify(reduced));
        state = reduced;
        if (!quotaWarned) {
          quotaWarned = true;
          console.warn("DefogDaily: storage full — older scan history was trimmed to make room.");
        }
        return;
      } catch {
        // Try the next, more aggressive step.
      }
    }
    console.warn("DefogDaily: could not persist local store", error);
  }
};

const emit = () => {
  for (const listener of listeners) listener();
};

/**
 * Adopt what another tab wrote.
 *
 * Without this, two open tabs each hold their own cached `state` and every
 * write is a full overwrite, so whichever tab saves last silently erases the
 * other's session. Re-hydrating on the `storage` event (which only fires in
 * *other* tabs) keeps each tab's cache fresh, so the next write in this tab
 * builds on the newest data instead of stale data.
 *
 * Note this deliberately assigns a NEW object: useSyncExternalStore detects
 * change by identity, so a fresh reference is what makes React re-render. The
 * stability requirement is that repeated `read()` calls with no intervening
 * write return the same reference, which they still do.
 */
const syncFromStorage = () => {
  if (!isBrowser()) return;
  state = hydrate(window.localStorage.getItem(STORE_KEY));
  emit();
};

if (isBrowser()) {
  window.addEventListener("storage", (event) => {
    if (event.key === STORE_KEY) syncFromStorage();
  });
}

/** Apply a pure updater to the store, persist, and notify subscribers. */
export const update = (updater) => {
  const current = read();
  const next = updater({ ...current });
  state = next;
  persist();
  emit();
  return state;
};

export const getState = () => read();

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useStore = (selector = (s) => s) => {
  return useSyncExternalStore(
    subscribe,
    () => selector(read()),
    () => selector(defaultState())
  );
};

/* ------------------------------------------------------------------ *
 * Domain profile
 * ------------------------------------------------------------------ */

const EMA_ALPHA = 0.3;

const applyDomainResult = (profile, key, score, at) => {
  const slot = profile[key] ?? emptyDomainStat();
  const history = [...slot.history, { t: at, s: score }].slice(-120);
  return {
    ...profile,
    [key]: {
      sessions: slot.sessions + 1,
      best: Math.max(slot.best, score),
      ema: slot.ema === null ? score : slot.ema * (1 - EMA_ALPHA) + score * EMA_ALPHA,
      last: score,
      history,
    },
  };
};

/* ------------------------------------------------------------------ *
 * Streaks
 * ------------------------------------------------------------------ */

export const dayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const daysBetween = (aKey, bKey) => {
  const [ay, am, ad] = aKey.split("-").map(Number);
  const [by, bm, bd] = bKey.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
};

const advanceStreak = (streak, at) => {
  const today = dayKey(at);
  if (streak.lastDay === today) return streak;
  const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : null;
  const current = gap === 1 ? streak.current + 1 : 1;
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastDay: today,
    totalDays: streak.totalDays + 1,
  };
};

/** Days since the last session, or null if there has never been one. */
export const daysSinceLastSession = (streak, now = Date.now()) => {
  if (!streak?.lastDay) return null;
  return daysBetween(streak.lastDay, dayKey(now));
};

/**
 * The streak as it stands *right now*.
 *
 * `streak.current` is only recalculated when a session is recorded, so a stored
 * value of 12 keeps rendering as "12 day streak" months after the streak was
 * actually broken. Anything user-facing must read through this instead: a
 * streak survives today and yesterday, and is zero beyond that.
 */
export const liveStreak = (streak, now = Date.now()) => {
  if (!streak?.lastDay) return 0;
  const gap = daysBetween(streak.lastDay, dayKey(now));
  return gap <= 1 ? streak.current : 0;
};

/* ------------------------------------------------------------------ *
 * XP & levels
 * ------------------------------------------------------------------ */

const MAX_LEVEL = 99;

/** Levels widen as you climb: level N needs 120 * N^1.35 cumulative XP. */
export const levelForXp = (total) => {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  let level = 1;
  while (level < MAX_LEVEL && safeTotal >= xpForLevel(level + 1)) level += 1;

  const isMax = level >= MAX_LEVEL;
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);

  return {
    level,
    isMax,
    floor,
    ceiling,
    // Past the cap, XP keeps accruing with nowhere to go. Clamping keeps the
    // meter full and stops "XP to level 100" rendering as a negative number.
    into: isMax ? span : safeTotal - floor,
    needed: span,
    remaining: isMax ? 0 : Math.max(0, ceiling - safeTotal),
    progress: isMax ? 1 : Math.min(1, Math.max(0, (safeTotal - floor) / span)),
  };
};

export const xpForLevel = (level) => (level <= 1 ? 0 : Math.round(120 * (level - 1) ** 1.35));

/* ------------------------------------------------------------------ *
 * Public mutations
 * ------------------------------------------------------------------ */

/**
 * Records a finished scan or drill.
 * @param {object} session { mode, domains, scores, raw, composite, durationMs }
 * @returns {{ session: object, xpGained: number, streak: object }}
 */
export const recordSession = (session) => {
  const at = session.finishedAt ?? Date.now();
  let xpGained = 0;
  let nextStreak = null;

  update((s) => {
    const isDrillRun = (session.kind ?? "scan") === "drill";

    /**
     * Only a standardised scan may move your measured profile.
     *
     * Practice drills adapt their difficulty to you, which is exactly right for
     * training and exactly wrong for measurement: a 4-back drill and a 2-back
     * scan produce scores that are not on the same scale, so letting drills
     * write here silently corrupted percentiles, personal bests and the
     * training plan's choice of target. Drill effort is tracked separately so
     * it is still visible without contaminating the measurement.
     */
    let profile = s.profile;
    let practice = s.practice ?? {};

    for (const key of session.domains ?? []) {
      const score = session.scores?.[key];
      if (typeof score !== "number" || Number.isNaN(score)) continue;

      if (isDrillRun) {
        const slot = practice[key] ?? { reps: 0, best: 0, last: null, history: [] };
        practice = {
          ...practice,
          [key]: {
            reps: slot.reps + 1,
            best: Math.max(slot.best, score),
            last: score,
            history: [...slot.history, { t: at, s: score }].slice(-60),
          },
        };
      } else {
        profile = applyDomainResult(profile, key, score, at);
      }
    }

    // XP rewards effort and quality: base per domain plus a performance bonus.
    const domainCount = (session.domains ?? []).length;
    const avg = session.composite ?? 0;
    xpGained = Math.round(domainCount * 18 + avg * 0.9 + (session.mode === "deep" ? 60 : 0));

    nextStreak = isDrillRun ? s.streak : advanceStreak(s.streak, at);

    const record = {
      id: `${at}-${Math.round(avg)}`,
      t: at,
      mode: session.mode ?? "practice",
      kind: session.kind ?? "scan",
      domains: session.domains ?? [],
      scores: session.scores ?? {},
      composite: session.composite ?? 0,
      metrics: session.metrics ?? {},
      durationMs: session.durationMs ?? null,
    };

    /**
     * `lastScan` is what the Report tab rebuilds itself from after a reload,
     * so only a real multi-domain scan may claim that slot. Letting a
     * single-domain practice drill overwrite it silently destroyed the user's
     * whole profile: an 8-domain Deep Scan report would collapse to one
     * domain, taking the composite index, cognitive age and training plan
     * targets down with it. An empty run (everything skipped) must not claim
     * it either — `{}` is truthy.
     */
    const isDrill = (session.kind ?? "scan") === "drill";
    const hasTelemetry =
      !!session.rawScores && Object.keys(session.rawScores).length > 0;

    return {
      ...s,
      profile,
      practice,
      sessions: [...s.sessions, record].slice(-200),
      // sessions[] is capped for quota reasons, so its length stops being a
      // truthful lifetime count after 200 runs. Track that separately.
      totalSessions: (s.totalSessions ?? s.sessions.length) + 1,
      streak: nextStreak,
      xp: { total: s.xp.total + xpGained },
      lastScan:
        !isDrill && hasTelemetry
          ? {
              rawScores: session.rawScores,
              scores: session.scores,
              at,
              mode: session.mode ?? "practice",
              domains: session.domains ?? [],
            }
          : s.lastScan ?? null,
    };
  });

  return { xpGained, streak: nextStreak, state: read() };
};

export const unlockAchievements = (ids, at = Date.now()) => {
  const fresh = [];
  update((s) => {
    const achievements = { ...s.achievements };
    for (const id of ids) {
      if (achievements[id]) continue;
      achievements[id] = at;
      fresh.push(id);
    }
    return { ...s, achievements };
  });
  return fresh;
};

export const setPrefs = (patch) =>
  update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }));

export const savePlan = (plan) => update((s) => ({ ...s, plan }));

export const markPlanTask = (dayIndex, taskId, done = true) =>
  update((s) => {
    if (!s.plan) return s;
    const progress = { ...(s.plan.progress ?? {}) };
    const day = new Set(progress[dayIndex] ?? []);
    if (done) day.add(taskId);
    else day.delete(taskId);
    progress[dayIndex] = [...day];
    return { ...s, plan: { ...s.plan, progress } };
  });

export const clearAllData = () => {
  if (isBrowser()) window.localStorage.removeItem(STORE_KEY);
  state = defaultState();
  persist();
  emit();
};

export const exportData = () => JSON.stringify(read(), null, 2);

export const importData = (json) => {
  const next = hydrate(json);
  state = next;
  persist();
  emit();
  return next;
};

/* ------------------------------------------------------------------ *
 * Derived selectors
 * ------------------------------------------------------------------ */

export const latestSession = (s = read()) => s.sessions[s.sessions.length - 1] ?? null;

export const sessionsForDomain = (key, s = read()) =>
  s.sessions.filter((session) => typeof session.scores?.[key] === "number");

/** Best available estimate of current ability in a domain. */
export const domainLevel = (key, s = read()) => {
  const slot = s.profile[key];
  if (!slot || slot.sessions === 0) return null;
  return slot.ema ?? slot.last ?? slot.best;
};

/** Trend over the last N sessions: positive means improving. */
export const domainTrend = (key, window = 5, s = read()) => {
  const history = s.profile[key]?.history ?? [];
  if (history.length < 3) return null;
  const recent = history.slice(-window);
  const older = history.slice(-window * 2, -window);
  if (older.length === 0) return null;
  const mean = (arr) => arr.reduce((sum, h) => sum + h.s, 0) / arr.length;
  return mean(recent) - mean(older);
};
