/**
 * Model-based normative scoring.
 *
 * IMPORTANT, and stated plainly everywhere it surfaces in the UI: these are
 * estimated norms derived from published effect sizes and typical distributions
 * for each paradigm, not a clinically validated sample. They are calibrated so
 * that a healthy, well-rested adult performing attentively lands near the 50th
 * percentile. They are useful for tracking yourself over time and for spotting
 * relative strengths and weaknesses. They are not a diagnosis.
 */

import { DOMAINS, DOMAIN_KEYS, PILLARS, domainsForPillar } from "./domains";

/** Mean and SD of each domain's 0-100 normalized score in the reference model. */
export const DOMAIN_NORMS = {
  speed: { mean: 62, sd: 15 },
  memory: { mean: 64, sd: 18 },
  stroop: { mean: 66, sd: 16 },
  spatial: { mean: 55, sd: 19 },
  nback: { mean: 58, sd: 18 },
  inhibition: { mean: 68, sd: 15 },
  span: { mean: 57, sd: 17 },
  flex: { mean: 60, sd: 17 },
};

/* Abramowitz & Stegun 7.1.26 — plenty accurate for percentile display. */
const erf = (x) => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
};

export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/**
 * Age adjustment. Cognitive throughput peaks in the mid-twenties and declines
 * roughly linearly after that, with speed-loaded domains declining fastest.
 * Returns the expected mean shift (in normalized points) for a given age.
 */
const AGE_PEAK = 25;
const AGE_SLOPE = {
  speed: 0.34,
  nback: 0.3,
  flex: 0.28,
  spatial: 0.26,
  stroop: 0.22,
  inhibition: 0.2,
  span: 0.16,
  memory: 0.15,
};

export const ageAdjustment = (domainKey, age) => {
  if (!age || age < 14 || age > 100) return 0;
  const slope = AGE_SLOPE[domainKey] ?? 0.25;
  if (age >= AGE_PEAK) return -(age - AGE_PEAK) * slope;
  // Adolescents are still maturing, especially on executive domains.
  return -(AGE_PEAK - age) * slope * 0.6;
};

/**
 * Percentile for a normalized 0-100 domain score.
 * @param {number} score
 * @param {string} domainKey
 * @param {number|null} age optional — enables age-referenced norms
 */
export const percentileFor = (score, domainKey, age = null) => {
  const norm = DOMAIN_NORMS[domainKey] ?? { mean: 60, sd: 17 };
  const mean = norm.mean + ageAdjustment(domainKey, age);
  const z = (score - mean) / norm.sd;
  return Math.min(99.5, Math.max(0.5, normalCdf(z) * 100));
};

export const zScoreFor = (score, domainKey, age = null) => {
  const norm = DOMAIN_NORMS[domainKey] ?? { mean: 60, sd: 17 };
  return (score - (norm.mean + ageAdjustment(domainKey, age))) / norm.sd;
};

export const TIERS = [
  { min: 98, label: "Exceptional", tone: "cyan", note: "Top 2% of the reference model." },
  { min: 91, label: "Superior", tone: "cyan", note: "Well above the typical adult." },
  { min: 75, label: "High Average", tone: "emerald", note: "Comfortably above the middle." },
  { min: 25, label: "Average", tone: "slate", note: "Within the typical range." },
  { min: 9, label: "Low Average", tone: "amber", note: "Below the middle — trainable." },
  { min: 0, label: "Needs Work", tone: "rose", note: "Your clearest opportunity." },
];

export const tierFor = (percentile) =>
  TIERS.find((tier) => percentile >= tier.min) ?? TIERS[TIERS.length - 1];

export const ordinal = (n) => {
  const v = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const mod = v % 100;
  return `${v}${s[(mod - 20) % 10] ?? s[mod] ?? s[0]}`;
};

/**
 * Cognitive age: the age at which this composite would be exactly average.
 * Inverted from the same age curve used for norms, using a speed-weighted
 * blend because that is what actually tracks age in the literature.
 */
export const cognitiveAge = (scores, actualAge = null) => {
  const available = DOMAIN_KEYS.filter((key) => typeof scores[key] === "number");
  if (available.length === 0) return null;

  // Weighted mean z-score against the age-25 reference.
  let weightSum = 0;
  let zSum = 0;
  for (const key of available) {
    const weight = AGE_SLOPE[key] ?? 0.25;
    zSum += zScoreFor(scores[key], key, null) * weight;
    weightSum += weight;
  }
  const meanZ = zSum / weightSum;

  // One SD of composite ability corresponds to roughly 17 years of drift.
  const YEARS_PER_SD = 17;
  const estimate = AGE_PEAK - meanZ * YEARS_PER_SD;
  const clamped = Math.max(16, Math.min(85, estimate));

  return {
    years: Math.round(clamped),
    delta: actualAge ? Math.round(clamped - actualAge) : null,
    meanZ,
  };
};

/** Composite index on the familiar 100-mean / 15-SD scale (IQ-style, not IQ). */
export const cognitiveIndex = (scores, age = null) => {
  const available = DOMAIN_KEYS.filter((key) => typeof scores[key] === "number");
  if (available.length === 0) return null;
  const meanZ =
    available.reduce((sum, key) => sum + zScoreFor(scores[key], key, age), 0) / available.length;
  return {
    index: Math.round(100 + meanZ * 15),
    percentile: Math.min(99.5, Math.max(0.5, normalCdf(meanZ) * 100)),
    meanZ,
    domainsUsed: available.length,
  };
};

/** Aggregate a pillar from whichever of its domains were measured. */
export const pillarScore = (scores, pillarKey, age = null) => {
  const keys = domainsForPillar(pillarKey).filter((key) => typeof scores[key] === "number");
  if (keys.length === 0) return null;
  const score = keys.reduce((sum, key) => sum + scores[key], 0) / keys.length;
  const percentile =
    keys.reduce((sum, key) => sum + percentileFor(scores[key], key, age), 0) / keys.length;
  return {
    key: pillarKey,
    label: PILLARS[pillarKey].label,
    blurb: PILLARS[pillarKey].blurb,
    accent: PILLARS[pillarKey].accent,
    score: Math.round(score),
    percentile,
    tier: tierFor(percentile),
    domains: keys.map((key) => ({ key, label: DOMAINS[key].label, score: scores[key] })),
  };
};

export const allPillarScores = (scores, age = null) =>
  Object.keys(PILLARS)
    .map((key) => pillarScore(scores, key, age))
    .filter(Boolean);

export const NORMS_DISCLAIMER =
  "Percentiles come from a model-based reference distribution, not a clinical sample. Use them to track yourself over time and to compare your own domains against each other — not as a medical assessment.";
