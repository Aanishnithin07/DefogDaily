/**
 * Single source of truth for every cognitive domain DefogDaily measures.
 *
 * Each domain maps to one mini-game, one normalized 0-100 score, one pillar,
 * and the science that justifies measuring it. Adding a domain here wires it
 * into scoring, the report, the training plan, practice mode, and progress
 * charts automatically — nothing else needs a hardcoded list.
 */

export const PILLARS = {
  attention: {
    key: "attention",
    label: "Attention & Vigilance",
    blurb: "How fast and how consistently you can lock onto a signal and hold it.",
    accent: "cyan",
  },
  memory: {
    key: "memory",
    label: "Working Memory",
    blurb: "How much information you can hold online and manipulate at once.",
    accent: "violet",
  },
  executive: {
    key: "executive",
    label: "Executive Control",
    blurb: "Your ability to suppress the automatic response and switch rules on demand.",
    accent: "amber",
  },
  spatial: {
    key: "spatial",
    label: "Spatial Reasoning",
    blurb: "How well you encode and rebuild the layout of the world around you.",
    accent: "emerald",
  },
};

export const DOMAINS = {
  speed: {
    key: "speed",
    label: "Processing Speed",
    short: "Speed",
    pillar: "attention",
    icon: "Zap",
    accent: "cyan",
    game: "speed",
    duration: 30,
    tagline: "Odd or even, as fast as you can read.",
    measures: "Raw decision throughput and how steady it stays under time pressure.",
    science:
      "Adapted from digit-symbol and simple-choice reaction paradigms. Processing speed is the strongest single predictor of performance on almost every other cognitive task — it is the clock rate the rest of your mind runs on.",
    realWorld: [
      "Reading a paragraph once instead of three times",
      "Following fast conversation without lag",
      "Reacting in traffic",
    ],
  },
  memory: {
    key: "memory",
    label: "Verbal Working Memory",
    short: "Recall",
    pillar: "memory",
    icon: "Brain",
    accent: "violet",
    game: "memory",
    duration: 35,
    tagline: "Hold five words, then pick them out of a crowd.",
    measures: "Encoding strength and your ability to reject convincing lookalikes.",
    science:
      "A recognition-memory task with same-category distractors, scored with signal detection theory (d'). Same-category decoys stop you from passing on gist alone — you have to have actually encoded the items.",
    realWorld: [
      "Remembering names right after introductions",
      "Holding a verbal instruction while you act on it",
      "Recalling what you read this morning",
    ],
  },
  stroop: {
    key: "stroop",
    label: "Interference Control",
    short: "Stroop",
    pillar: "executive",
    icon: "Focus",
    accent: "amber",
    game: "stroop",
    duration: 30,
    tagline: "Name the ink colour, not the word.",
    measures: "The cost your brain pays to override an automatic habit.",
    science:
      "The Stroop task (1935) is the canonical measure of prepotent-response inhibition. The gap between congruent and incongruent trials — your interference cost — is a direct readout of prefrontal control.",
    realWorld: [
      "Ignoring a notification mid-sentence",
      "Not saying the first thing that comes to mind",
      "Sticking with a new process instead of the old habit",
    ],
  },
  spatial: {
    key: "spatial",
    label: "Spatial Memory",
    short: "Spatial",
    pillar: "spatial",
    icon: "Grid3X3",
    accent: "emerald",
    game: "spatial",
    duration: 60,
    tagline: "Memorise the pattern, then rebuild it.",
    measures: "Visuospatial encoding capacity and how it holds up as load rises.",
    science:
      "A Corsi-block-style span task on a 5x5 grid. Visuospatial sketchpad capacity is a separate store from verbal memory, which is why some people ace word recall and still get lost in a car park.",
    realWorld: [
      "Finding your car in a big lot",
      "Mentally rearranging furniture",
      "Navigating without turn-by-turn directions",
    ],
  },
  nback: {
    key: "nback",
    label: "Fluid Working Memory",
    short: "N-Back",
    pillar: "memory",
    icon: "Layers",
    accent: "violet",
    game: "nback",
    duration: 60,
    tagline: "Does this match the one from N steps ago?",
    measures: "Continuous updating — the hardest thing working memory does.",
    science:
      "The N-back is the most-studied working-memory training paradigm in cognitive science. It forces constant update-and-discard cycles, which is why it loads fluid intelligence more heavily than any static span test.",
    realWorld: [
      "Following a multi-thread meeting",
      "Mental arithmetic with carries",
      "Debugging while holding the call stack in your head",
    ],
  },
  inhibition: {
    key: "inhibition",
    label: "Response Inhibition",
    short: "Impulse",
    pillar: "executive",
    icon: "Hand",
    accent: "amber",
    game: "inhibition",
    duration: 45,
    tagline: "Tap every shape — except the one you must not.",
    measures: "Your brake. How well you stop a response already in motion.",
    science:
      "A Go/No-Go paradigm. Commission errors (tapping the No-Go) index impulsivity; omission errors index attentional lapses. The two failure modes have completely different fixes, so we score them separately.",
    realWorld: [
      "Not sending the angry reply",
      "Stopping a habit mid-action",
      "Resisting the second tab",
    ],
  },
  span: {
    key: "span",
    label: "Verbal Span",
    short: "Span",
    pillar: "memory",
    icon: "ListOrdered",
    accent: "violet",
    game: "span",
    duration: 60,
    tagline: "Repeat the digits. Sometimes backwards.",
    measures: "Raw storage capacity, then capacity plus manipulation.",
    science:
      "Digit span forward measures the phonological loop; digit span backward adds an executive manipulation load. The forward-minus-backward gap isolates storage from control — a distinction most consumer brain apps never make.",
    realWorld: [
      "Holding a phone number long enough to dial",
      "Keeping a list in your head at the shop",
      "Following multi-step spoken directions",
    ],
  },
  flex: {
    key: "flex",
    label: "Cognitive Flexibility",
    short: "Switch",
    pillar: "executive",
    icon: "Shuffle",
    accent: "amber",
    game: "flex",
    duration: 45,
    tagline: "The rule keeps changing. Keep up.",
    measures: "Switch cost — the tax you pay every time the task changes.",
    science:
      "A task-switching paradigm alternating between number and shape rules. Switch cost (switch-trial RT minus repeat-trial RT) is the cleanest lab measure of mental set-shifting, and it is the thing that degrades first under stress and poor sleep.",
    realWorld: [
      "Context-switching between projects",
      "Adapting when plans change",
      "Juggling parenting and work in the same hour",
    ],
  },
};

export const DOMAIN_KEYS = Object.keys(DOMAINS);

/** The original quick scan — under four minutes, run it daily. */
export const CORE_SCAN = ["speed", "memory", "stroop", "spatial"];

/** The full battery — every domain, roughly eight minutes. */
export const DEEP_SCAN = ["speed", "memory", "stroop", "spatial", "nback", "inhibition", "span", "flex"];

export const SCAN_MODES = {
  daily: {
    key: "daily",
    label: "Daily Scan",
    domains: CORE_SCAN,
    seeded: true,
    blurb: "Same puzzles for everyone today. ~3 minutes.",
  },
  practice: {
    key: "practice",
    label: "Free Scan",
    domains: CORE_SCAN,
    seeded: false,
    blurb: "Fresh randomised puzzles. ~3 minutes.",
  },
  deep: {
    key: "deep",
    label: "Deep Scan",
    domains: DEEP_SCAN,
    seeded: false,
    blurb: "All eight domains for a full cognitive profile. ~8 minutes.",
  },
};

export const getDomain = (key) => DOMAINS[key] ?? null;

export const domainsForPillar = (pillarKey) =>
  DOMAIN_KEYS.filter((key) => DOMAINS[key].pillar === pillarKey);

export const estimateScanSeconds = (domainKeys) =>
  domainKeys.reduce((sum, key) => sum + (DOMAINS[key]?.duration ?? 45), 0) + 12;
