/**
 * Converts raw game telemetry into a normalized 0-100 score per domain.
 *
 * Every formula is documented with its anchors so it can be recalibrated once
 * real population data exists. Anchors were chosen so that attentive adult
 * performance lands near the domain mean declared in `norms.js`.
 */

import { DOMAIN_KEYS } from "./domains";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

/** Games historically emitted accuracy as either 0-1 or 0-100. Normalize both. */
const toPercent = (value) => {
  if (!Number.isFinite(value)) return 0;
  return value <= 1.0001 ? value * 100 : value;
};

/**
 * Linear reaction-time bonus: `fast` ms scores 100, `slow` ms scores 0.
 * Guards on isFinite, not `<= 0` — NaN fails every comparison, so a NaN
 * reaction time slipped through and propagated NaN into the domain score and
 * from there into the composite index.
 */
const reactionBonus = (ms, fast, slow) => {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const clamped = Math.max(fast, Math.min(slow, ms));
  return 100 - ((clamped - fast) / (slow - fast)) * 100;
};

const scorers = {
  // Accuracy dominates; raw speed is the tiebreaker. 300ms -> 100, 1500ms -> 0.
  speed: (payload) => {
    const accuracy = toPercent(payload.accuracy);
    return accuracy * 0.7 + reactionBonus(payload.avgReactionMs, 300, 1500) * 0.3;
  },

  // The recall game already emits a decoy-penalised 0-100 accuracy.
  memory: (payload) => toPercent(payload.accuracy),

  // Errors are expensive here — resisting interference is the whole point.
  stroop: (payload) => {
    const accuracy = toPercent(payload.accuracy);
    return accuracy * 0.85 + reactionBonus(payload.avgReactionMs, 400, 2000) * 0.15;
  },

  // Corsi-style span. Level 12 (span 15) is a ceiling almost nobody reaches.
  spatial: (payload) => {
    const raw = payload.levelReached ?? payload.raw?.levelReached ?? 1;
    // Clamp before the fractional exponent: Math.pow of a negative base with a
    // fractional power is NaN, so a corrupt negative level poisoned the score.
    const level = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    // Non-linear: early levels are cheap, later levels are worth much more.
    return clamp(Math.pow(level / 12, 0.78) * 100);
  },

  // N-back scored from sensitivity (d'), scaled by the N actually sustained.
  nback: (payload) => {
    const raw = payload.raw ?? payload;
    const hits = raw.hits ?? 0;
    const misses = raw.misses ?? 0;
    const falseAlarms = raw.falseAlarms ?? 0;
    const correctRejections = raw.correctRejections ?? 0;
    const targets = hits + misses;
    const nonTargets = falseAlarms + correctRejections;
    if (targets === 0 && nonTargets === 0) return 0;

    const hitRate = targets ? hits / targets : 0;
    const faRate = nonTargets ? falseAlarms / nonTargets : 0;
    // Balanced accuracy keeps "tap everything" from scoring well.
    const balanced = (hitRate + (1 - faRate)) / 2;
    // N=2 is the reference; each extra level is worth a 22% multiplier.
    const n = raw.peakN ?? raw.n ?? 2;
    const nMultiplier = 1 + (n - 2) * 0.22;
    return clamp(balanced * 100 * nMultiplier);
  },

  // Go/No-Go: holding back is weighted far above simply going.
  inhibition: (payload) => {
    const raw = payload.raw ?? payload;
    const goTrials = raw.goTrials ?? 0;
    const noGoTrials = raw.noGoTrials ?? 0;
    if (!goTrials && !noGoTrials) return 0;
    const goAccuracy = goTrials ? ((goTrials - (raw.omissionErrors ?? 0)) / goTrials) * 100 : 0;
    const noGoAccuracy = noGoTrials ? ((noGoTrials - (raw.commissionErrors ?? 0)) / noGoTrials) * 100 : 0;
    return noGoAccuracy * 0.6 + goAccuracy * 0.25 + reactionBonus(payload.avgReactionMs, 280, 900) * 0.15;
  },

  // Digit span. Combined span of 4 is typical; 8+ is exceptional.
  span: (payload) => {
    const raw = payload.raw ?? payload;
    const forward = raw.forwardSpan ?? 0;
    const backward = raw.backwardSpan ?? 0;
    // Backward span is harder, so it carries more weight per item.
    const combined = forward * 0.45 + backward * 0.55;
    return clamp(((combined - 2) / 6) * 100);
  },

  // Task switching: accuracy first, then how cheap your switches are.
  flex: (payload) => {
    const accuracy = toPercent(payload.accuracy);
    const switchCost = payload.raw?.switchCostMs ?? payload.switchCostMs;
    // 0ms switch cost -> 100, 500ms+ -> 0.
    const costBonus =
      typeof switchCost === "number" ? clamp(100 - (Math.max(0, switchCost) / 500) * 100) : 55;
    return accuracy * 0.7 + costBonus * 0.3;
  },
};

/**
 * @param {Record<string, object|null>} rawScores keyed by domain
 * @returns {Record<string, number>} normalized scores plus `aggregate`
 */
export function normalizeScores(rawScores = {}) {
  const out = {};
  const measured = [];

  for (const key of DOMAIN_KEYS) {
    const payload = rawScores?.[key];
    if (!payload) continue;
    const scorer = scorers[key];
    if (!scorer) continue;
    try {
      const computed = scorer(payload);
      // Final backstop: a domain score is shown to the user, drives their
      // percentile and picks their training target, so a NaN escaping any
      // individual formula must never reach them.
      const value = Number.isFinite(computed) ? Math.round(clamp(computed)) : 0;
      out[key] = value;
      measured.push(value);
    } catch (error) {
      console.warn(`DefogDaily: scoring failed for ${key}`, error);
    }
  }

  out.aggregate = measured.length
    ? Math.round(measured.reduce((sum, v) => sum + v, 0) / measured.length)
    : 0;

  return out;
}

/** Domains actually present in a normalized score object. */
export const measuredDomains = (scores = {}) =>
  DOMAIN_KEYS.filter((key) => typeof scores[key] === "number");

export { clamp, toPercent, reactionBonus };
