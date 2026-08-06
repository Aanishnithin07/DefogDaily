/**
 * The 28-day training protocol generator.
 *
 * Built from your own report, not a template: the primary target is your
 * weakest domain, the secondary rotates through what supports it, and every
 * day pairs a drill with a real-world transfer habit — because lab gains that
 * never leave the lab are the standard criticism of brain training, and the
 * habits are how you dodge it.
 *
 * Progression follows a 3-weeks-on / 1-week-consolidate shape, with a re-scan
 * checkpoint every seventh day so you can see whether it is actually working.
 */

import { DOMAINS } from "./domains";
import { dayKey } from "./storage";

const DAY_MS = 86_400_000;

const WEEK_THEMES = [
  {
    index: 1,
    theme: "Establish",
    goal: "Build the habit and set an honest floor.",
    detail:
      "Short daily reps at a difficulty you can actually complete. The point of week one is showing up, not scoring.",
    intensity: 0.85,
  },
  {
    index: 2,
    theme: "Load",
    goal: "Push into the zone where you fail about a third of the time.",
    detail:
      "Difficulty steps up. Aim for 65-80% success — that band is where adaptation happens. Comfortable means you are not training.",
    intensity: 1.0,
  },
  {
    index: 3,
    theme: "Stress",
    goal: "Hold performance when conditions are worse.",
    detail:
      "Longest and hardest week. Drill when you are slightly tired or slightly rushed — that is where the transfer to real life lives.",
    intensity: 1.15,
  },
  {
    index: 4,
    theme: "Consolidate",
    goal: "Lock the gains in and re-measure clean.",
    detail:
      "Volume drops, quality rises. Sleep and consistency matter more than effort this week. Finish with a full Deep Scan.",
    intensity: 0.9,
  },
];

/** Real-world transfer habits. This is the half most apps skip entirely. */
const HABITS = {
  speed: [
    { label: "Two-minute sprint", detail: "Pick one routine task — email, tidying, a form — and set a 2-minute timer. Move deliberately faster than comfortable." },
    { label: "One-glance reading", detail: "Read a paragraph taking in phrases rather than single words. Do not re-read. Then summarise it in one sentence." },
    { label: "Decide in ten", detail: "For any low-stakes choice today (lunch, which task next), decide within 10 seconds. Speed is trainable on cheap decisions." },
  ],
  memory: [
    { label: "Name and use", detail: "Next person you meet, use their name in your very next sentence. Encoding at exposure beats effort at recall." },
    { label: "Hold the list", detail: "When you need a short list, keep it in your head for 10 minutes before writing it down." },
    { label: "Evening rewind", detail: "Before sleep, recall the day in five events, in order. This is retrieval practice on your own life." },
  ],
  stroop: [
    { label: "Count, don't read", detail: "Take a headline and count its words instead of reading its meaning. You are forcing an override of a hard-wired habit." },
    { label: "One-window hour", detail: "One hour today with a single window open and the phone in another room. Remove the interference rather than resisting it." },
    { label: "Name the pull", detail: "Each time you feel pulled to switch, say what pulled you out loud. Naming recruits the same control system you are training." },
  ],
  spatial: [
    { label: "Blind point", detail: "Walk into a room, close your eyes, and point at three objects you just saw. Check yourself." },
    { label: "Draw the route", detail: "Sketch the route you walked today from memory. Do not check a map until you are done." },
    { label: "Park by shape", detail: "When you park or leave your bag, register the shape of the scene rather than a number." },
  ],
  nback: [
    { label: "Running total", detail: "Add up prices in your head while you shop. No phone. The carries are the training." },
    { label: "Three-thread listening", detail: "In your next meeting, track three people's positions at once and summarise all three at the end." },
    { label: "Backwards alphabet", detail: "Recite the alphabet backwards once. Then every third letter forwards. Two minutes, pure updating." },
  ],
  inhibition: [
    { label: "Ten-second gate", detail: "Anything written in irritation waits 10 seconds before you send it. Every time, no exceptions." },
    { label: "Skip the first urge", detail: "Once today, notice an automatic reach — phone, snack, tab — and simply do not complete it. Just once." },
    { label: "Full stop", detail: "Finish one task completely before opening anything else. Completion is inhibition training in disguise." },
  ],
  span: [
    { label: "Chunk the number", detail: "Memorise a phone number in groups of three, then recall it 5 minutes later." },
    { label: "Order out loud", detail: "Order for the table from memory. No notes." },
    { label: "Reverse it", detail: "Take today's date or a 5-digit number and say it backwards. Twice." },
  ],
  flex: [
    { label: "Batch by kind", detail: "Group today's work by type, not urgency. Two hours of one kind beats four alternating hours." },
    { label: "Landing note", detail: "Before switching away from anything, write the single next action. Re-entry should be free." },
    { label: "Other hand", detail: "Brush your teeth or use the mouse with your other hand. Cheap, direct set-shifting practice." },
  ],
};

/** Which domains reinforce which. Used to pick a sensible secondary drill. */
const SUPPORTS = {
  speed: ["inhibition", "flex"],
  memory: ["span", "nback"],
  stroop: ["inhibition", "flex"],
  spatial: ["nback", "memory"],
  nback: ["span", "memory"],
  inhibition: ["stroop", "speed"],
  span: ["memory", "nback"],
  flex: ["stroop", "inhibition"],
};

const pick = (arr, i) => arr[i % arr.length];

/**
 * @param {object} report output of buildReport()
 * @param {object} [options]
 * @returns {object} a persistable plan
 */
export function buildPlan(report, options = {}) {
  const startedAt = options.startedAt ?? Date.now();
  const primary = report?.primaryTarget?.key ?? "nback";
  // Prefer your second-weakest domain, but only if it actually reinforces the
  // primary. Otherwise pick a domain that shares the same machinery, so the two
  // drills compound instead of competing for the same limited practice time.
  const supportsPrimary = SUPPORTS[primary] ?? ["nback"];
  const secondWeakest = report?.secondaryTarget?.key;
  const secondaryIsSupport =
    secondWeakest && secondWeakest !== primary && supportsPrimary.includes(secondWeakest);
  const secondary =
    secondaryIsSupport
      ? secondWeakest
      : supportsPrimary.find((key) => key !== primary) ?? secondWeakest ?? "nback";

  const support = SUPPORTS[primary] ?? [];
  const rotation = [primary, secondary, ...support.filter((k) => k !== secondary)].filter(
    (k, i, a) => a.indexOf(k) === i
  );

  const days = [];
  for (let index = 0; index < 28; index += 1) {
    const weekIndex = Math.floor(index / 7);
    const week = WEEK_THEMES[weekIndex];
    const dayInWeek = index % 7;
    const isCheckpoint = dayInWeek === 6;
    const isRest = dayInWeek === 3 && weekIndex === 3;

    const tasks = [];

    if (isCheckpoint) {
      tasks.push({
        id: `d${index}-checkpoint`,
        type: "scan",
        label: weekIndex === 3 ? "Final Deep Scan" : "Checkpoint Scan",
        detail:
          weekIndex === 3
            ? "Run the full eight-domain Deep Scan and compare against the profile you started with."
            : "Run a Daily Scan under the same conditions as week one — same time of day if you can.",
        mode: weekIndex === 3 ? "deep" : "practice",
        minutes: weekIndex === 3 ? 8 : 3,
      });
    } else if (isRest) {
      tasks.push({
        id: `d${index}-rest`,
        type: "habit",
        label: "Deliberate rest",
        detail:
          "No drills today. Consolidation happens off the task — a full night's sleep does more for next week's score than another session would.",
        minutes: 0,
      });
    } else {
      const primaryMinutes = Math.round(5 * week.intensity);
      tasks.push({
        id: `d${index}-primary`,
        type: "drill",
        domain: primary,
        label: `${DOMAINS[primary].short} drill`,
        detail: `${DOMAINS[primary].tagline} ${
          weekIndex === 0
            ? "Settle into the mechanics — accuracy before speed."
            : weekIndex === 1
            ? "Push until you are missing roughly one in four."
            : weekIndex === 2
            ? "Hold accuracy even when it stops feeling easy."
            : "Clean, unhurried reps. Quality over volume."
        }`,
        minutes: primaryMinutes,
        difficulty: week.intensity,
      });

      // Every other day, add a supporting drill so the primary does not stale.
      if (dayInWeek % 2 === 1) {
        const supportDomain = pick(rotation.slice(1), Math.floor(index / 2));
        if (supportDomain) {
          tasks.push({
            id: `d${index}-support`,
            type: "drill",
            domain: supportDomain,
            label: `${DOMAINS[supportDomain].short} support`,
            detail: DOMAINS[supportDomain].tagline,
            minutes: 3,
            difficulty: week.intensity * 0.9,
          });
        }
      }
    }

    if (!isCheckpoint) {
      const habitPool = HABITS[primary] ?? HABITS.speed;
      const habit = pick(habitPool, index);
      tasks.push({
        id: `d${index}-habit`,
        type: "habit",
        domain: primary,
        label: habit.label,
        detail: habit.detail,
        minutes: 2,
      });
    }

    days.push({
      index,
      week: weekIndex + 1,
      dayInWeek,
      dateKey: dayKey(startedAt + index * DAY_MS),
      isCheckpoint,
      isRest,
      tasks,
    });
  }

  return {
    id: `plan-${startedAt}`,
    createdAt: startedAt,
    startedAt,
    version: 1,
    primary,
    secondary,
    targets: [primary, secondary],
    title: `28 days on ${DOMAINS[primary].label}`,
    rationale: report?.primaryTarget
      ? `${DOMAINS[primary].label} came out at the ${report.primaryTarget.percentileLabel} percentile — your lowest domain and the one holding the composite down. ${
          DOMAINS[secondary].label
        } is the secondary target because ${
          secondaryIsSupport
            ? "it is also among your weakest and it shares the underlying machinery"
            : "it trains the same underlying system, so the two drills compound"
        }.`
      : `Starting with ${DOMAINS[primary].label}, the highest-leverage domain to train before you have a full profile.`,
    weeks: WEEK_THEMES,
    days,
    progress: {},
    baseline: report
      ? {
          index: report.index?.index ?? null,
          scores: report.scores,
          at: report.generatedAt,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * Plan progress helpers
 * ------------------------------------------------------------------ */

/** Which day of the plan is "today", clamped to the plan length. */
export const currentDayIndex = (plan, now = Date.now()) => {
  if (!plan) return 0;
  const elapsed = Math.floor((now - plan.startedAt) / DAY_MS);
  return Math.max(0, Math.min(27, elapsed));
};

export const planStats = (plan) => {
  if (!plan) return null;
  const today = currentDayIndex(plan);
  let totalTasks = 0;
  let doneTasks = 0;
  let daysComplete = 0;

  for (const day of plan.days) {
    const done = new Set(plan.progress?.[day.index] ?? []);
    if (day.index <= today) {
      totalTasks += day.tasks.length;
      doneTasks += day.tasks.filter((t) => done.has(t.id)).length;
      if (day.tasks.every((t) => done.has(t.id))) daysComplete += 1;
    }
  }

  return {
    today,
    dayNumber: today + 1,
    week: Math.floor(today / 7) + 1,
    totalTasks,
    doneTasks,
    daysComplete,
    adherence: totalTasks ? doneTasks / totalTasks : 0,
    daysRemaining: 28 - (today + 1),
    isComplete: today >= 27 && (plan.progress?.[27] ?? []).length >= plan.days[27].tasks.length,
  };
};

export const dayTasksDone = (plan, dayIndex) => new Set(plan?.progress?.[dayIndex] ?? []);

export { HABITS, WEEK_THEMES };
