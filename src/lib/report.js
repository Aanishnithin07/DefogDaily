/**
 * The diagnostic engine.
 *
 * Takes raw telemetry plus your history and produces the thing every other
 * brain-training app puts behind a subscription: a specific, evidence-backed
 * account of *where* you are weak, *why* you are weak there, and exactly what
 * to do about it.
 *
 * Every finding cites the number that triggered it, so nothing here is vibes.
 */

import { DOMAINS, DOMAIN_KEYS, PILLARS } from "./domains";
import { extractMetrics } from "./metrics";
import {
  allPillarScores,
  cognitiveAge,
  cognitiveIndex,
  ordinal,
  percentileFor,
  tierFor,
} from "./norms";
import { domainTrend, getState } from "./storage";

const SEVERITY_ORDER = { critical: 0, watch: 1, note: 2, strength: 3 };

const fmtMs = (ms) => `${Math.round(ms)}ms`;
const pct = (v) => `${Math.round(v)}%`;

/* ------------------------------------------------------------------ *
 * Finding rules
 *
 * Each rule inspects one domain's deep metrics and, when a threshold trips,
 * explains the failure mode in plain language and prescribes the fix.
 * ------------------------------------------------------------------ */

const RULES = [
  {
    id: "unstable-attention",
    domains: ["speed", "stroop", "inhibition", "flex"],
    test: (m) => m.cv != null && m.cv > 0.34 && m.trials >= 12,
    build: (m, key) => ({
      severity: m.cv > 0.45 ? "critical" : "watch",
      title: "Your attention is flickering, not fading",
      evidence: `Reaction-time variability (CV) of ${m.cv.toFixed(2)} on ${DOMAINS[key].label} — above the 0.34 stability threshold.`,
      whatItMeans:
        "Your fast responses are genuinely fast. The problem is that they are interrupted by slow ones. That pattern points at moment-to-moment attentional instability rather than a low ceiling — which is good news, because stability responds to training and to sleep far faster than raw capacity does.",
      fix: {
        headline: "Train sustained attention, not speed",
        steps: [
          "Run Go/No-Go drills — they punish drift directly and give you instant feedback on it.",
          "Do one 10-minute single-task block a day with the phone in another room.",
          "Check sleep first: variability is the earliest and most sensitive marker of sleep debt.",
        ],
        drill: "inhibition",
        minutes: 6,
      },
    }),
  },
  {
    id: "attentional-lapses",
    domains: ["speed", "stroop", "inhibition", "flex"],
    test: (m) => m.lapseRate != null && m.lapseRate > 8 && m.trials >= 12,
    build: (m, key) => ({
      severity: m.lapseRate > 16 ? "critical" : "watch",
      title: "You are dropping out mid-task",
      evidence: `${m.lapses} lapse${m.lapses === 1 ? "" : "s"} (${pct(m.lapseRate)} of trials) on ${DOMAINS[key].label}, where a lapse is a response over 2.5× your own median.`,
      whatItMeans:
        "These are not slow decisions — they are moments where you were briefly not on the task at all. A handful is normal. Above roughly one in twelve trials, they start eating measurably into real-world output: rereading paragraphs, missing what someone just said, losing your place mid-task.",
      fix: {
        headline: "Shorten the gap between check-ins",
        steps: [
          "Work in 12-minute blocks with a hard start and stop rather than open-ended sessions.",
          "Before each block, name the single output you want. Unstated goals are where attention leaks.",
          "Run the Impulse drill three times a week — lapse rate is the metric it moves fastest.",
        ],
        drill: "inhibition",
        minutes: 5,
      },
    }),
  },
  {
    id: "speed-accuracy-tradeoff",
    domains: ["speed", "stroop", "flex", "inhibition"],
    test: (m) => m.errorCount >= 3 && m.fastErrorShare > 60,
    build: (m, key) => ({
      severity: "watch",
      title: "You are answering before you have decided",
      evidence: `${pct(m.fastErrorShare)} of your errors on ${DOMAINS[key].label} came in faster than your own median response — the signature of pre-emptive responding.`,
      whatItMeans:
        "Your errors cluster in fast responses, not slow ones. This is a strategy problem rather than an ability problem: you are trading accuracy for speed at a rate that costs you more points than it earns. Deliberately slowing by about 10% usually raises the score.",
      fix: {
        headline: "Buy accuracy with a small amount of time",
        steps: [
          "On your next run, consciously wait until you can name the answer before you move your hand.",
          "Target 95% accuracy first. Speed follows accuracy; it does not work the other way round.",
          "Watch your fast-error share in the report — it should fall below 40%.",
        ],
        drill: key,
        minutes: 4,
      },
    }),
  },
  {
    id: "vigilance-decrement",
    domains: ["speed", "stroop", "inhibition", "flex"],
    test: (m) => m.fatigueMs != null && m.fatigueMs > 90 && m.trials >= 15,
    build: (m, key) => ({
      severity: m.fatigueMs > 180 ? "critical" : "watch",
      title: "You fade inside a single minute",
      evidence: `Your last third of ${DOMAINS[key].label} trials ran ${fmtMs(m.fatigueMs)} slower than your first third${m.accuracyDrift < -4 ? `, with accuracy down ${Math.abs(m.accuracyDrift)} points` : ""}.`,
      whatItMeans:
        "A vigilance decrement this steep over 30-60 seconds usually scales up badly: if you fade this fast in one minute, hour-long focused work is expensive for you. The most common drivers are short sleep, dehydration, and going into deep work without a warm-up.",
      fix: {
        headline: "Front-load the hard work and cap the block",
        steps: [
          "Put your most demanding task in the first 90 minutes after you properly wake up.",
          "Use 25-minute blocks with real breaks — walk, look out a window, do not switch to a screen.",
          "Re-scan after a week of 7.5+ hours of sleep and compare this number specifically.",
        ],
        drill: key,
        minutes: 5,
      },
    }),
  },
  {
    id: "high-interference",
    domains: ["stroop"],
    test: (m) => m.interferenceMs != null && m.interferenceMs > 200,
    build: (m) => ({
      severity: m.interferenceMs > 350 ? "critical" : "watch",
      title: "Overriding a habit is expensive for you",
      evidence: `Interference cost of ${fmtMs(m.interferenceMs)} — the extra time you need when the word and the ink disagree (${fmtMs(m.congruentRt)} congruent vs ${fmtMs(m.incongruentRt)} incongruent).`,
      whatItMeans:
        "Your automatic reading response is strong and your override is comparatively slow. In practice this shows up as difficulty dropping a habit you have decided against, being pulled by whatever is most salient on screen, and needing extra effort to follow a new process instead of the old one.",
      fix: {
        headline: "Rehearse the override, not the task",
        steps: [
          "Stroop drills are the direct exercise — 3 minutes, four times a week.",
          "Remove the interference you can: notifications off, one window, phone face down.",
          "When you catch the old habit starting, say the new action out loud once. Verbalising recruits the same control system.",
        ],
        drill: "stroop",
        minutes: 4,
      },
    }),
  },
  {
    id: "impulsive-responding",
    domains: ["inhibition"],
    test: (m) => m.commissionRate > 22 && m.noGoTrials >= 6,
    build: (m) => ({
      severity: m.commissionRate > 40 ? "critical" : "watch",
      title: "Your brake is slower than your accelerator",
      evidence: `You responded on ${pct(m.commissionRate)} of No-Go trials (${m.commissionErrors} of ${m.noGoTrials}) — where the correct move was to do nothing.`,
      whatItMeans:
        "Commission errors measure how well you can cancel an action that has already started. A high rate alongside good Go accuracy means the issue is specifically stopping, not attending. This is the mechanism behind sending the message you meant to reread and clicking the thing you had decided to skip.",
      fix: {
        headline: "Practise stopping, deliberately",
        steps: [
          "Go/No-Go drills at high Go-frequency — the harder the prepotency, the better the training.",
          "Install one physical delay in real life: a 10-second pause before sending anything written in irritation.",
          "Track commission rate week to week. Under 15% is a good target.",
        ],
        drill: "inhibition",
        minutes: 5,
      },
    }),
  },
  {
    id: "omission-drift",
    domains: ["inhibition"],
    test: (m) => m.omissionRate > 12 && m.goTrials >= 12,
    build: (m) => ({
      severity: "watch",
      title: "You are missing signals that are plainly there",
      evidence: `${pct(m.omissionRate)} omission rate — ${m.omissionErrors} Go trials passed with no response at all.`,
      whatItMeans:
        "Omissions are the inattention half of the picture, separate from impulsivity. When they run high while commission errors stay low, the story is under-arousal rather than over-eagerness: you are not being pulled into errors, you are drifting out of the task.",
      fix: {
        headline: "Raise arousal before demanding focus",
        steps: [
          "Two minutes of brisk movement immediately before focused work — it reliably cuts omissions.",
          "Do demanding work sitting upright in bright light, not reclined.",
          "If omissions stay high across several sessions when you feel rested, that is worth mentioning to a doctor.",
        ],
        drill: "inhibition",
        minutes: 5,
      },
    }),
  },
  {
    id: "switch-cost",
    domains: ["flex"],
    test: (m) => m.switchCostMs != null && m.switchCostMs > 220,
    build: (m) => ({
      severity: m.switchCostMs > 380 ? "critical" : "watch",
      title: "Changing rules costs you real time",
      evidence: `Switch cost of ${fmtMs(m.switchCostMs)} (${fmtMs(m.switchRt)} on switch trials vs ${fmtMs(m.repeatRt)} on repeats).`,
      whatItMeans:
        "Switch cost is the tax on mental set-shifting, and it is the single best lab predictor of how much context-switching hurts you at work. A high cost means your day is more expensive than your calendar suggests — every jump between projects is charged at this rate.",
      fix: {
        headline: "Batch by rule, not by urgency",
        steps: [
          "Group same-type work into blocks. Two hours of one kind of task beats four alternating hours.",
          "Run Task Switch drills — the cost drops measurably within about two weeks of practice.",
          "Write the next action down before you switch away, so re-entry does not cost a rebuild.",
        ],
        drill: "flex",
        minutes: 5,
      },
    }),
  },
  {
    id: "weak-encoding",
    domains: ["memory"],
    test: (m) => m.dPrime != null && m.dPrime < 1.6,
    build: (m) => ({
      severity: m.dPrime < 0.9 ? "critical" : "watch",
      title: "Items are not landing in the first place",
      evidence: `Recognition sensitivity d' = ${m.dPrime} (${m.hits}/${m.targets} hits with ${m.falseAlarms} false alarms).`,
      whatItMeans:
        "Low d' means you cannot cleanly tell a word you saw from a plausible one you did not. That is an encoding failure rather than a retrieval failure — the information never got a strong enough trace. Depth of processing at the moment of exposure matters far more here than effort at recall.",
      fix: {
        headline: "Encode with meaning, not repetition",
        steps: [
          "During the memorise phase, build one absurd image linking all five words into a scene. Elaboration beats rehearsal every time.",
          "Say each item once, silently but with intent. Sub-vocalising strengthens the trace.",
          "In real life: after meeting someone, use their name in your next sentence.",
        ],
        drill: "memory",
        minutes: 4,
      },
    }),
  },
  {
    id: "liberal-criterion",
    domains: ["memory"],
    test: (m) => m.falseAlarms >= 2 && m.liberalBias,
    build: (m) => ({
      severity: "note",
      title: "You trust familiarity too much",
      evidence: `${m.falseAlarms} false alarms against ${m.misses} misses — you claimed more items than you actually rejected.`,
      whatItMeans:
        "You are set to a liberal criterion: when something feels familiar, you accept it. Same-category decoys feel familiar for the wrong reason. In practice this shows up as confidently misremembering details, because fluency is being read as recollection.",
      fix: {
        headline: "Demand a source, not a feeling",
        steps: [
          "Before selecting, ask 'can I recall seeing this specific item?' rather than 'does this feel right?'",
          "When it matters in real life, check rather than trust the feeling of knowing.",
        ],
        drill: "memory",
        minutes: 3,
      },
    }),
  },
  {
    id: "manipulation-bottleneck",
    domains: ["span"],
    test: (m) => m.forwardSpan >= 4 && m.manipulationCost >= 2,
    build: (m) => ({
      severity: m.manipulationCost >= 3 ? "watch" : "note",
      title: "Storage is fine. Working on the contents is not",
      evidence: `Forward span ${m.forwardSpan} vs backward span ${m.backwardSpan} — a manipulation cost of ${m.manipulationCost} items.`,
      whatItMeans:
        "You can hold information perfectly well; the cost appears the moment you have to do something to it while holding it. That is executive load, not capacity. It is why mental arithmetic and following restructured instructions feel disproportionately hard compared with simple recall.",
      fix: {
        headline: "Train manipulation under load",
        steps: [
          "Backward span and N-back both target this directly — favour them over plain recall drills.",
          "Practise mental arithmetic with carries for two minutes a day. It is the same machinery.",
          "When instructions arrive out of order, restate them in order before acting.",
        ],
        drill: "nback",
        minutes: 6,
      },
    }),
  },
  {
    id: "low-span",
    domains: ["span"],
    test: (m) => m.forwardSpan > 0 && m.forwardSpan <= 4,
    build: (m) => ({
      severity: "watch",
      title: "Your verbal buffer is running short",
      evidence: `Forward digit span of ${m.forwardSpan}. Typical adult span is 6 to 7 items.`,
      whatItMeans:
        "The phonological loop holds roughly two seconds of speech. A short span means information starts falling out before you can act on it — the reason a phone number evaporates between hearing and dialling.",
      fix: {
        headline: "Chunk instead of storing",
        steps: [
          "Group digits in threes. Chunking is the single highest-leverage span technique that exists.",
          "Rehearse out loud rather than silently while learning — the loop is auditory.",
          "Build up one item at a time; span responds to daily practice within about three weeks.",
        ],
        drill: "span",
        minutes: 5,
      },
    }),
  },
  {
    id: "nback-updating",
    domains: ["nback"],
    test: (m) => m.dPrime != null && m.dPrime < 1.5,
    build: (m) => ({
      severity: m.dPrime < 0.8 ? "critical" : "watch",
      title: "Updating is where you lose the thread",
      evidence: `N-back sensitivity d' = ${m.dPrime} at N=${m.n} (${m.hits} hits, ${m.misses} misses, ${m.falseAlarms} false alarms).`,
      whatItMeans:
        "The N-back is not a storage test; it is a constant discard-and-replace test. Weakness here shows up in real life as losing the thread of a multi-party conversation, and as needing to restart mental arithmetic partway through.",
      fix: {
        headline: "Practise the discard, not the hold",
        steps: [
          "Run N-back at the level where you score 70-80%. Below that you are guessing; above it you are not training.",
          "Do not rehearse the whole list — deliberately drop the oldest item as each new one arrives.",
          "Four short sessions a week beats one long one. Updating training is consolidation-limited.",
        ],
        drill: "nback",
        minutes: 6,
      },
    }),
  },
  {
    id: "spatial-span",
    domains: ["spatial"],
    test: (m) => m.spanReached != null && m.spanReached <= 6,
    build: (m) => ({
      severity: m.spanReached <= 5 ? "watch" : "note",
      title: "Your visual sketchpad fills up early",
      evidence: `Reached a spatial span of ${m.spanReached} cells (level ${m.levelReached}).`,
      whatItMeans:
        "Visuospatial memory is a separate store from verbal memory, which is why strong word recall and weak spatial recall coexist happily. A low span here means layouts, routes, and diagrams cost you more effort than they cost other people.",
      fix: {
        headline: "Convert space into shape",
        steps: [
          "Do not memorise cells individually — see the pattern as one shape or a path connecting them.",
          "Name the pattern ('an L with a dot'). Verbal labels give the sketchpad a second handle to hold.",
          "In real life, when you park, look back once and register the shape of the scene, not the number.",
        ],
        drill: "spatial",
        minutes: 5,
      },
    }),
  },
  {
    id: "load-collapse",
    domains: ["speed"],
    test: (m) => m.loadCost != null && m.loadCost > 260,
    build: (m) => ({
      severity: "watch",
      title: "You slow down sharply as the input grows",
      evidence: `Four-digit numbers cost you ${fmtMs(m.loadCost)} more than one- and two-digit ones.`,
      whatItMeans:
        "Simple decisions are fast for you, but throughput drops steeply once there is more to take in. That gap between easy and loaded conditions is usually about how much you can register in a single glance rather than about decision speed.",
      fix: {
        headline: "Widen the glance",
        steps: [
          "Read the last digit first on longer numbers — parity only ever depends on it.",
          "Practise taking in short phrases in one fixation rather than word by word.",
        ],
        drill: "speed",
        minutes: 4,
      },
    }),
  },
];

/* ------------------------------------------------------------------ *
 * Strength detection — the report should tell you what to protect, too.
 * ------------------------------------------------------------------ */

const STRENGTH_RULES = [
  {
    id: "elite-stability",
    domains: ["speed", "stroop", "inhibition", "flex"],
    test: (m) => m.cv != null && m.cv < 0.2 && m.trials >= 12,
    build: (m, key) => ({
      severity: "strength",
      title: "Unusually stable attention",
      evidence: `Reaction-time CV of ${m.cv.toFixed(2)} on ${DOMAINS[key].label} — well inside the stable range.`,
      whatItMeans:
        "Consistency at this level is rarer than raw speed and it is what makes long focused sessions possible. Protect it: it is the first thing short sleep takes away.",
    }),
  },
  {
    id: "clean-inhibition",
    domains: ["inhibition"],
    test: (m) => m.commissionRate < 8 && m.noGoTrials >= 6,
    build: (m) => ({
      severity: "strength",
      title: "A genuinely fast brake",
      evidence: `Only ${pct(m.commissionRate)} commission errors across ${m.noGoTrials} No-Go trials.`,
      whatItMeans:
        "You can cancel an action that is already underway. That is the mechanism behind not sending the reply you would regret, and it transfers directly to habit change.",
    }),
  },
  {
    id: "cheap-switching",
    domains: ["flex"],
    test: (m) => m.switchCostMs != null && m.switchCostMs < 90,
    build: (m) => ({
      severity: "strength",
      title: "Context switching is cheap for you",
      evidence: `Switch cost of only ${fmtMs(m.switchCostMs)}.`,
      whatItMeans:
        "Most people pay 200ms or more per rule change. Multi-threaded work costs you far less than it costs the average person — you can take on roles that would exhaust someone else.",
    }),
  },
  {
    id: "sharp-encoding",
    domains: ["memory"],
    test: (m) => m.dPrime != null && m.dPrime >= 2.6,
    build: (m) => ({
      severity: "strength",
      title: "Precise, high-confidence encoding",
      evidence: `Recognition sensitivity d' = ${m.dPrime} with only ${m.falseAlarms} false alarm${m.falseAlarms === 1 ? "" : "s"}.`,
      whatItMeans:
        "You separate what you actually saw from what merely feels familiar. That precision is what stops confident misremembering.",
    }),
  },
];

/* ------------------------------------------------------------------ *
 * Report assembly
 * ------------------------------------------------------------------ */

const buildFindings = (metrics, scores) => {
  /**
   * A rule can fire on several domains at once — unstable attention shows up in
   * speed, Stroop and switching together. Reporting that as three near-identical
   * cards is noise, so each rule contributes one finding, anchored to the
   * worst-affected domain, and names the others it also touched.
   */
  const byRule = new Map();

  for (const rule of [...RULES, ...STRENGTH_RULES]) {
    for (const key of rule.domains) {
      const m = metrics[key];
      if (!m) continue;
      let passes = false;
      try {
        passes = rule.test(m);
      } catch {
        passes = false;
      }
      if (!passes) continue;

      const built = rule.build(m, key);
      const existing = byRule.get(rule.id);
      const score = scores?.[key] ?? 50;

      if (!existing) {
        byRule.set(rule.id, {
          id: rule.id,
          domain: key,
          domainLabel: DOMAINS[key].label,
          anchorScore: score,
          alsoAffects: [],
          ...built,
        });
        continue;
      }

      // Anchor issues to the weakest domain and strengths to the strongest.
      const isStrength = built.severity === "strength";
      const shouldReplace = isStrength ? score > existing.anchorScore : score < existing.anchorScore;

      if (shouldReplace) {
        byRule.set(rule.id, {
          id: rule.id,
          domain: key,
          domainLabel: DOMAINS[key].label,
          anchorScore: score,
          alsoAffects: [...existing.alsoAffects, existing.domainLabel],
          ...built,
        });
      } else {
        existing.alsoAffects.push(DOMAINS[key].label);
      }
    }
  }

  return [...byRule.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
};

const buildDomainRows = (scores, metrics, age, state) => {
  return DOMAIN_KEYS.filter((key) => typeof scores[key] === "number").map((key) => {
    const score = scores[key];
    const percentile = percentileFor(score, key, age);
    const slot = state.profile[key];
    const trend = domainTrend(key, 5, state);
    const previous = slot?.history?.length >= 2 ? slot.history[slot.history.length - 2].s : null;
    return {
      key,
      ...DOMAINS[key],
      score,
      percentile,
      percentileLabel: ordinal(percentile),
      tier: tierFor(percentile),
      metrics: metrics[key] ?? null,
      trend,
      delta: previous != null ? score - previous : null,
      personalBest: slot?.best ?? score,
      sessions: slot?.sessions ?? 1,
      isPersonalBest: (slot?.best ?? 0) <= score,
    };
  });
};

const headlineFor = (index, weakest, strongest) => {
  if (!index) return "Scan complete.";
  const band =
    index.percentile >= 90
      ? "an exceptional profile"
      : index.percentile >= 70
      ? "a strong profile"
      : index.percentile >= 40
      ? "a solid, typical profile"
      : "a profile with clear room to move";
  const strong = strongest ? `${strongest.label} is carrying it` : "";
  const weak = weakest ? `${weakest.label} is the bottleneck` : "";
  return [`You have ${band}.`, strong && `${strong}.`, weak && `${weak}.`].filter(Boolean).join(" ");
};

/**
 * @param {object} rawScores raw per-domain telemetry from the scan
 * @param {object} normalizedScores 0-100 per domain
 * @param {object} [options]
 * @returns {object} the full report model
 */
export function buildReport(rawScores, normalizedScores, options = {}) {
  const state = options.state ?? getState();
  const age = options.age ?? state.prefs?.age ?? null;

  const metrics = extractMetrics(rawScores ?? {});
  const scores = normalizedScores ?? {};
  const domains = buildDomainRows(scores, metrics, age, state);
  const pillars = allPillarScores(scores, age);
  const index = cognitiveIndex(scores, age);
  const cogAge = cognitiveAge(scores, age);
  const findings = buildFindings(metrics, scores);

  const ranked = [...domains].sort((a, b) => a.percentile - b.percentile);
  const weaknesses = ranked.slice(0, Math.min(2, ranked.length));
  const strengths = [...ranked].reverse().slice(0, Math.min(2, ranked.length));

  // A domain is only a *real* weakness if it is both low absolutely and low
  // relative to your own profile — otherwise a strong all-round scan would
  // report a false problem.
  const spread = ranked.length > 1 ? ranked[ranked.length - 1].percentile - ranked[0].percentile : 0;

  const issues = findings.filter((f) => f.severity !== "strength");
  const wins = findings.filter((f) => f.severity === "strength");

  const primaryTarget = weaknesses[0] ?? null;
  const secondaryTarget = weaknesses[1] ?? null;

  return {
    generatedAt: Date.now(),
    age,
    scores,
    metrics,
    domains,
    pillars,
    index,
    cognitiveAge: cogAge,
    findings: issues,
    strengths: wins,
    topWeaknesses: weaknesses,
    topStrengths: strengths,
    spread: Math.round(spread),
    primaryTarget,
    secondaryTarget,
    headline: headlineFor(index, weaknesses[0], strengths[0]),
    criticalCount: issues.filter((f) => f.severity === "critical").length,
    domainsMeasured: domains.length,
    isPartial: domains.length < DOMAIN_KEYS.length,
    missingDomains: DOMAIN_KEYS.filter((key) => typeof scores[key] !== "number"),
  };
}

/** Compact narrative summary, used on the results screen and in shares. */
export const summarize = (report) => {
  if (!report?.index) return "Run a scan to generate your profile.";
  const lines = [];
  lines.push(report.headline);
  if (report.primaryTarget) {
    lines.push(
      `Your lowest domain is ${report.primaryTarget.label} at the ${report.primaryTarget.percentileLabel} percentile.`
    );
  }
  if (report.criticalCount > 0) {
    lines.push(
      `${report.criticalCount} finding${report.criticalCount === 1 ? "" : "s"} need attention — the report explains each one and what fixes it.`
    );
  }
  return lines.join(" ");
};

export { PILLARS };
