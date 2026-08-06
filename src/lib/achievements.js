/**
 * Achievements. Free, local, and tuned to reward the behaviour that actually
 * produces gains — consistency and honest difficulty — rather than raw score.
 */

import { DOMAIN_KEYS, DOMAINS } from "./domains";

export const ACHIEVEMENTS = [
  {
    id: "first-light",
    name: "First Light",
    icon: "Sunrise",
    tier: "bronze",
    detail: "Complete your first scan.",
    test: (s) => s.sessions.length >= 1,
  },
  {
    id: "full-spectrum",
    name: "Full Spectrum",
    icon: "Layers",
    tier: "silver",
    detail: "Complete a Deep Scan across all eight domains.",
    test: (s) => s.sessions.some((session) => session.domains?.length >= 8),
  },
  {
    id: "streak-3",
    name: "Momentum",
    icon: "Flame",
    tier: "bronze",
    detail: "Scan three days in a row.",
    test: (s) => s.streak.longest >= 3,
  },
  {
    id: "streak-7",
    name: "Week Clear",
    icon: "Flame",
    tier: "silver",
    detail: "Scan seven days in a row.",
    test: (s) => s.streak.longest >= 7,
  },
  {
    id: "streak-30",
    name: "Fog Lifted",
    icon: "Flame",
    tier: "gold",
    detail: "Scan thirty days in a row.",
    test: (s) => s.streak.longest >= 30,
  },
  {
    id: "century",
    name: "Centurion",
    icon: "Trophy",
    tier: "gold",
    detail: "Complete one hundred sessions.",
    test: (s) => s.sessions.length >= 100,
  },
  {
    id: "sharp-90",
    name: "Sharp",
    icon: "Sparkles",
    tier: "silver",
    detail: "Score 90 or higher in any domain.",
    test: (s) => DOMAIN_KEYS.some((key) => (s.profile[key]?.best ?? 0) >= 90),
  },
  {
    id: "polymath",
    name: "Polymath",
    icon: "Brain",
    tier: "gold",
    detail: "Score 75 or higher in every one of the eight domains.",
    test: (s) => DOMAIN_KEYS.every((key) => (s.profile[key]?.best ?? 0) >= 75),
  },
  {
    id: "balanced",
    name: "Balanced Mind",
    icon: "Scale",
    tier: "silver",
    detail: "Finish a scan with under 15 points between your best and worst domain.",
    test: (s) =>
      s.sessions.some((session) => {
        const values = Object.entries(session.scores ?? {})
          .filter(([k]) => DOMAIN_KEYS.includes(k))
          .map(([, v]) => v);
        return values.length >= 4 && Math.max(...values) - Math.min(...values) < 15;
      }),
  },
  {
    id: "plan-started",
    name: "Committed",
    icon: "Target",
    tier: "bronze",
    detail: "Start a 28-day training protocol.",
    test: (s) => !!s.plan,
  },
  {
    id: "plan-week",
    name: "Seven Days In",
    icon: "CalendarCheck",
    tier: "silver",
    detail: "Complete every task in the first week of a protocol.",
    test: (s) => {
      if (!s.plan) return false;
      return s.plan.days.slice(0, 7).every((day) => {
        const done = new Set(s.plan.progress?.[day.index] ?? []);
        return day.tasks.every((t) => done.has(t.id));
      });
    },
  },
  {
    id: "plan-complete",
    name: "Protocol Complete",
    icon: "Award",
    tier: "gold",
    detail: "Finish all 28 days of a training protocol.",
    test: (s) => {
      if (!s.plan) return false;
      const completedDays = s.plan.days.filter((day) => {
        const done = new Set(s.plan.progress?.[day.index] ?? []);
        return day.tasks.every((t) => done.has(t.id));
      });
      return completedDays.length >= 28;
    },
  },
  {
    id: "grinder",
    name: "Grinder",
    icon: "Dumbbell",
    tier: "silver",
    detail: "Complete 25 practice drills.",
    test: (s) => s.sessions.filter((session) => session.kind === "drill").length >= 25,
  },
  {
    id: "night-owl",
    name: "Night Owl",
    icon: "Moon",
    tier: "bronze",
    detail: "Complete a scan after midnight.",
    test: (s) =>
      s.sessions.some((session) => {
        const hour = new Date(session.t).getHours();
        return hour >= 0 && hour < 5;
      }),
  },
  {
    id: "early-bird",
    name: "Early Bird",
    icon: "Sun",
    tier: "bronze",
    detail: "Complete a scan before 7am.",
    test: (s) =>
      s.sessions.some((session) => {
        const hour = new Date(session.t).getHours();
        return hour >= 4 && hour < 7;
      }),
  },
  {
    id: "comeback",
    name: "Comeback",
    icon: "TrendingUp",
    tier: "silver",
    detail: "Beat a personal best after a gap of a week or more.",
    test: (s) => {
      const sessions = s.sessions;
      for (let i = 1; i < sessions.length; i += 1) {
        const gapDays = (sessions[i].t - sessions[i - 1].t) / 86_400_000;
        if (gapDays < 7) continue;
        const priorBest = Math.max(...sessions.slice(0, i).map((x) => x.composite ?? 0));
        if ((sessions[i].composite ?? 0) > priorBest) return true;
      }
      return false;
    },
  },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const TIER_STYLES = {
  bronze: { ring: "border-amber-500/40", glow: "shadow-[0_0_28px_-8px_rgba(217,119,6,0.55)]", text: "text-amber-400" },
  silver: { ring: "border-slate-300/40", glow: "shadow-[0_0_28px_-8px_rgba(203,213,225,0.5)]", text: "text-slate-200" },
  gold: { ring: "border-accent-cyan/50", glow: "shadow-glow-cyan", text: "text-accent-cyan" },
};

/** Returns the ids that should be unlocked given the current store state. */
export const evaluateAchievements = (state) => {
  const earned = [];
  for (const achievement of ACHIEVEMENTS) {
    try {
      if (achievement.test(state)) earned.push(achievement.id);
    } catch {
      /* a broken rule must never block a session from saving */
    }
  }
  return earned;
};

/** Achievements earned now that were not earned before. */
export const newlyEarned = (state) =>
  evaluateAchievements(state).filter((id) => !state.achievements[id]);

export const domainMasteryLabel = (score) => {
  if (score >= 90) return "Mastered";
  if (score >= 75) return "Strong";
  if (score >= 55) return "Developing";
  if (score > 0) return "Building";
  return "Untested";
};

export { DOMAINS };
