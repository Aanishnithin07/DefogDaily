/**
 * Deep trial-level metric extraction.
 *
 * The 0-100 domain score answers "how did I do". These metrics answer *why* —
 * whether a low score came from being slow, being inconsistent, being impulsive,
 * fading over time, or genuinely running out of capacity. Each failure mode has
 * a different fix, so the report and the training plan both key off these.
 */

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const stdev = (values) => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
};

/** Signal detection sensitivity. Higher d' = cleaner separation of signal from noise. */
export const dPrime = (hits, targets, falseAlarms, distractors) => {
  if (!targets || !distractors) return null;
  // Log-linear correction keeps d' finite at ceiling/floor.
  const hitRate = (hits + 0.5) / (targets + 1);
  const faRate = (falseAlarms + 0.5) / (distractors + 1);
  const zInv = (p) => {
    // Acklam's inverse normal CDF approximation.
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const pLow = 0.02425;
    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= 1 - pLow) {
      const q = p - 0.5;
      const r = q * q;
      return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  };
  return Number((zInv(hitRate) - zInv(faRate)).toFixed(2));
};

/**
 * Core reaction-time profile shared by every speeded task.
 * @param {Array<{reactionMs:number, correct:boolean, elapsedMs?:number}>} trials
 */
export const trialStats = (trials = []) => {
  const valid = trials.filter((t) => typeof t.reactionMs === "number" && t.reactionMs > 0);
  if (valid.length === 0) return null;

  const rts = valid.map((t) => t.reactionMs);
  const correctRts = valid.filter((t) => t.correct).map((t) => t.reactionMs);
  const med = median(rts);
  const sd = stdev(rts);
  const avg = mean(rts);

  // Lapses: unusually long responses, the classic marker of attentional drift.
  const lapseThreshold = Math.max(900, med * 2.5);
  const lapses = valid.filter((t) => t.reactionMs > lapseThreshold).length;

  // Anticipations: responses too fast to be a real decision.
  const anticipations = valid.filter((t) => t.reactionMs < 220).length;

  // Fatigue / vigilance decrement: RT change from the first third to the last.
  const third = Math.max(1, Math.floor(valid.length / 3));
  const firstThird = mean(valid.slice(0, third).map((t) => t.reactionMs));
  const lastThird = mean(valid.slice(-third).map((t) => t.reactionMs));
  const accFirst = mean(valid.slice(0, third).map((t) => (t.correct ? 1 : 0)));
  const accLast = mean(valid.slice(-third).map((t) => (t.correct ? 1 : 0)));

  const errors = valid.filter((t) => !t.correct);
  const fastErrors = errors.filter((t) => t.reactionMs < med * 0.8).length;

  return {
    trials: valid.length,
    accuracy: mean(valid.map((t) => (t.correct ? 1 : 0))) * 100,
    meanRt: Math.round(avg),
    medianRt: Math.round(med),
    correctMeanRt: correctRts.length ? Math.round(mean(correctRts)) : null,
    fastestRt: Math.round(Math.min(...rts)),
    sdRt: Math.round(sd),
    /** Coefficient of variation — the single best index of attentional stability. */
    cv: avg > 0 ? Number((sd / avg).toFixed(3)) : 0,
    lapses,
    lapseRate: (lapses / valid.length) * 100,
    anticipations,
    fastErrorShare: errors.length ? (fastErrors / errors.length) * 100 : 0,
    fatigueMs: Math.round(lastThird - firstThird),
    accuracyDrift: Number(((accLast - accFirst) * 100).toFixed(1)),
    errorCount: errors.length,
  };
};

/* ------------------------------------------------------------------ *
 * Per-domain extractors. Each returns a flat, display-ready object.
 * ------------------------------------------------------------------ */

const extractors = {
  speed: (raw) => {
    const base = trialStats(raw?.attempts ?? []);
    if (!base) return null;
    // Does accuracy hold as the digit count climbs?
    const byDigits = {};
    for (const t of raw.attempts ?? []) {
      const key = t.digitLength ?? 1;
      byDigits[key] = byDigits[key] ?? { n: 0, correct: 0, rt: [] };
      byDigits[key].n += 1;
      byDigits[key].correct += t.correct ? 1 : 0;
      byDigits[key].rt.push(t.reactionMs);
    }
    const loadCurve = Object.entries(byDigits)
      .map(([digits, v]) => ({
        load: Number(digits),
        accuracy: (v.correct / v.n) * 100,
        meanRt: Math.round(mean(v.rt)),
        n: v.n,
      }))
      .sort((a, b) => a.load - b.load);

    const easy = loadCurve.filter((l) => l.load <= 2);
    const hard = loadCurve.filter((l) => l.load >= 3);
    const loadCost =
      easy.length && hard.length ? Math.round(mean(hard.map((h) => h.meanRt)) - mean(easy.map((e) => e.meanRt))) : null;

    return { ...base, bestStreak: raw.bestStreak ?? 0, loadCurve, loadCost };
  },

  stroop: (raw) => {
    const attempts = raw?.attempts ?? [];
    const base = trialStats(attempts);
    if (!base) return null;
    const congruent = attempts.filter((t) => t.congruent);
    const incongruent = attempts.filter((t) => t.congruent === false);
    const congruentRt = congruent.length ? mean(congruent.filter((t) => t.correct).map((t) => t.reactionMs)) : null;
    const incongruentRt = incongruent.length
      ? mean(incongruent.filter((t) => t.correct).map((t) => t.reactionMs))
      : null;

    return {
      ...base,
      bestStreak: raw.bestStreak ?? 0,
      congruentRt: congruentRt ? Math.round(congruentRt) : null,
      incongruentRt: incongruentRt ? Math.round(incongruentRt) : null,
      /** The Stroop effect itself: extra ms needed when word and ink conflict. */
      interferenceMs: congruentRt && incongruentRt ? Math.round(incongruentRt - congruentRt) : null,
      congruentAccuracy: congruent.length ? mean(congruent.map((t) => (t.correct ? 1 : 0))) * 100 : null,
      incongruentAccuracy: incongruent.length
        ? mean(incongruent.map((t) => (t.correct ? 1 : 0))) * 100
        : null,
    };
  },

  memory: (raw) => {
    if (!raw) return null;
    const targets = raw.targetWords?.length ?? 5;
    const decoys = raw.decoyWords?.length ?? 7;
    const hits = raw.correctSelections ?? 0;
    const falseAlarms = raw.decoySelections ?? 0;
    return {
      hits,
      misses: raw.missedTargets?.length ?? targets - hits,
      falseAlarms,
      targets,
      decoys,
      dPrime: dPrime(hits, targets, falseAlarms, decoys),
      recallTimeMs: raw.timeTakenMs ?? null,
      category: raw.category ?? null,
      /** Above 1 means you leaned toward guessing yes — a liberal criterion. */
      liberalBias: falseAlarms > raw.missedTargets?.length,
    };
  },

  spatial: (raw) => {
    if (!raw) return null;
    return {
      levelReached: raw.levelReached ?? 1,
      cellsCorrect: raw.totalCellsCorrect ?? 0,
      spanReached: (raw.levelReached ?? 1) + 3,
      encodeMsPerCell: raw.encodeMsPerCell ?? null,
      firstErrorLevel: raw.failedRound ?? null,
      perfect: raw.perfect ?? false,
    };
  },

  nback: (raw) => {
    if (!raw) return null;
    const base = trialStats(raw.attempts ?? []);
    return {
      ...(base ?? {}),
      n: raw.n ?? 2,
      hits: raw.hits ?? 0,
      misses: raw.misses ?? 0,
      falseAlarms: raw.falseAlarms ?? 0,
      correctRejections: raw.correctRejections ?? 0,
      dPrime: dPrime(raw.hits ?? 0, (raw.hits ?? 0) + (raw.misses ?? 0), raw.falseAlarms ?? 0, (raw.falseAlarms ?? 0) + (raw.correctRejections ?? 0)),
      peakN: raw.peakN ?? raw.n ?? 2,
    };
  },

  inhibition: (raw) => {
    if (!raw) return null;
    const base = trialStats((raw.attempts ?? []).filter((t) => t.isGo));
    const goTrials = raw.goTrials ?? 0;
    const noGoTrials = raw.noGoTrials ?? 0;
    return {
      ...(base ?? {}),
      goTrials,
      noGoTrials,
      /** Tapped when you should have held: impulsivity. */
      commissionErrors: raw.commissionErrors ?? 0,
      commissionRate: noGoTrials ? ((raw.commissionErrors ?? 0) / noGoTrials) * 100 : 0,
      /** Missed a Go entirely: inattention. */
      omissionErrors: raw.omissionErrors ?? 0,
      omissionRate: goTrials ? ((raw.omissionErrors ?? 0) / goTrials) * 100 : 0,
      dPrime: dPrime(goTrials - (raw.omissionErrors ?? 0), goTrials, raw.commissionErrors ?? 0, noGoTrials),
    };
  },

  span: (raw) => {
    if (!raw) return null;
    return {
      forwardSpan: raw.forwardSpan ?? 0,
      backwardSpan: raw.backwardSpan ?? 0,
      /** Storage minus manipulation. A big gap points at executive load, not capacity. */
      manipulationCost: (raw.forwardSpan ?? 0) - (raw.backwardSpan ?? 0),
      totalCorrect: raw.totalCorrect ?? 0,
      totalTrials: raw.totalTrials ?? 0,
      longestCorrect: Math.max(raw.forwardSpan ?? 0, raw.backwardSpan ?? 0),
    };
  },

  flex: (raw) => {
    const attempts = raw?.attempts ?? [];
    const base = trialStats(attempts);
    if (!base) return null;
    const switchTrials = attempts.filter((t) => t.isSwitch && t.correct);
    const repeatTrials = attempts.filter((t) => !t.isSwitch && t.correct);
    const switchRt = switchTrials.length ? mean(switchTrials.map((t) => t.reactionMs)) : null;
    const repeatRt = repeatTrials.length ? mean(repeatTrials.map((t) => t.reactionMs)) : null;
    return {
      ...base,
      switchRt: switchRt ? Math.round(switchRt) : null,
      repeatRt: repeatRt ? Math.round(repeatRt) : null,
      /** The tax you pay for changing rules mid-stream. */
      switchCostMs: switchRt && repeatRt ? Math.round(switchRt - repeatRt) : null,
      switchAccuracy: attempts.filter((t) => t.isSwitch).length
        ? mean(attempts.filter((t) => t.isSwitch).map((t) => (t.correct ? 1 : 0))) * 100
        : null,
      repeatAccuracy: attempts.filter((t) => !t.isSwitch).length
        ? mean(attempts.filter((t) => !t.isSwitch).map((t) => (t.correct ? 1 : 0))) * 100
        : null,
    };
  },
};

/** Build the full metric object for every domain present in a raw score payload. */
export const extractMetrics = (rawScores = {}) => {
  const out = {};
  for (const [key, extractor] of Object.entries(extractors)) {
    const raw = rawScores[key]?.raw ?? rawScores[key];
    if (!raw) continue;
    try {
      const metrics = extractor(raw);
      if (metrics) out[key] = metrics;
    } catch (error) {
      console.warn(`DefogDaily: metric extraction failed for ${key}`, error);
    }
  }
  return out;
};

export { mean, median, stdev };
