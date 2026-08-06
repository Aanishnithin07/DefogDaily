import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Hash, Scale } from "lucide-react";
import { getRandom } from "../../lib/random";
import { cue } from "../../lib/feedback";
import GameShell, { FeedbackFlash } from "./GameShell";

/**
 * Task switching — the cost of changing your mind on purpose.
 *
 * A digit appears inside a coloured frame. Cyan means judge parity (odd/even);
 * amber means judge magnitude (low/high). The rule changes roughly half the
 * time, so the difference between switch trials and repeat trials gives a clean
 * switch cost, which is the best lab predictor of how much context-switching
 * costs you in a real day.
 *
 * Button positions stay fixed — left is always the "first" answer — so the cost
 * measured is the rule change, not a motor remapping.
 */

const TEST_DURATION_MS = 45_000;
const INPUT_LOCK_MS = 260;
const SWITCH_RATE = 0.5;

const RULES = {
  parity: {
    key: "parity",
    label: "Odd or Even?",
    accent: "cyan",
    hex: "#3ED9D5",
    icon: Hash,
    left: "Odd",
    right: "Even",
    answer: (digit) => (digit % 2 !== 0 ? "left" : "right"),
  },
  magnitude: {
    key: "magnitude",
    label: "Low or High?",
    accent: "amber",
    hex: "#FFB454",
    icon: Scale,
    left: "Low (1-4)",
    right: "High (6-9)",
    answer: (digit) => (digit < 5 ? "left" : "right"),
  },
};

// 5 is excluded — it has no low/high answer.
const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9];

export default function TaskSwitchGame({ onComplete, drillConfig = null }) {
  const prefersReducedMotion = useReducedMotion();
  const duration = drillConfig?.durationMs ?? TEST_DURATION_MS;

  const [trial, setTrial] = useState(null); // { digit, rule, isSwitch, key }
  const [remainingMs, setRemainingMs] = useState(duration);
  const [feedback, setFeedback] = useState({ key: 0, type: null });
  const [stats, setStats] = useState({ correct: 0, total: 0, streak: 0 });
  const [liveMessage, setLiveMessage] = useState("Task switching started.");

  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const shownAtRef = useRef(0);
  const lockUntilRef = useRef(0);
  const finishedRef = useRef(false);
  const attemptsRef = useRef([]);
  const statsRef = useRef({ correct: 0, total: 0, streak: 0 });
  const bestStreakRef = useRef(0);
  const lastRuleRef = useRef(null);
  const timeoutRef = useRef(null);
  const trialKeyRef = useRef(0);

  const clearPending = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (finishedAt = performance.now()) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearPending();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      cue("complete");

      const attempts = attemptsRef.current;
      const correct = attempts.filter((a) => a.correct);
      const reactionTimes = attempts.map((a) => a.reactionMs);
      const avgReactionMs = reactionTimes.length
        ? reactionTimes.reduce((sum, ms) => sum + ms, 0) / reactionTimes.length
        : 0;

      const switchRts = correct.filter((a) => a.isSwitch).map((a) => a.reactionMs);
      const repeatRts = correct.filter((a) => !a.isSwitch).map((a) => a.reactionMs);
      const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
      const switchRt = avg(switchRts);
      const repeatRt = avg(repeatRts);

      onComplete(
        "flex",
        {
          accuracy: attempts.length ? (correct.length / attempts.length) * 100 : 0,
          avgReactionMs,
          switchCostMs: switchRt && repeatRt ? Math.round(switchRt - repeatRt) : null,
        },
        {
          attempts,
          totalAttempts: attempts.length,
          correctAnswers: correct.length,
          switchCostMs: switchRt && repeatRt ? Math.round(switchRt - repeatRt) : null,
          bestStreak: bestStreakRef.current,
          durationMs: Math.round(Math.min(duration, finishedAt - startedAtRef.current)),
        }
      );
    },
    [clearPending, duration, onComplete]
  );

  const nextTrial = useCallback(() => {
    const previous = lastRuleRef.current;
    const isSwitch = previous === null ? false : getRandom() < SWITCH_RATE;
    const ruleKey = previous === null
      ? (getRandom() < 0.5 ? "parity" : "magnitude")
      : isSwitch
      ? previous === "parity" ? "magnitude" : "parity"
      : previous;

    const digit = DIGITS[Math.floor(getRandom() * DIGITS.length)];
    lastRuleRef.current = ruleKey;
    trialKeyRef.current += 1;

    setTrial({ digit, rule: ruleKey, isSwitch, key: trialKeyRef.current });
    shownAtRef.current = performance.now();
  }, []);

  useEffect(() => {
    startedAtRef.current = performance.now();
    nextTrial();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - startedAtRef.current;
      setRemainingMs(Math.max(0, duration - elapsed));
      if (elapsed >= duration) {
        finish(now);
        return;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      clearPending();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [clearPending, duration, finish, nextTrial]);

  const answer = useCallback(
    (side) => {
      const now = performance.now();
      if (finishedRef.current || !trial) return;
      if (now < lockUntilRef.current) return;
      if (now - startedAtRef.current >= duration) {
        finish(now);
        return;
      }

      const rule = RULES[trial.rule];
      const correct = rule.answer(trial.digit) === side;
      const reactionMs = now - shownAtRef.current;

      attemptsRef.current.push({
        digit: trial.digit,
        rule: trial.rule,
        isSwitch: trial.isSwitch,
        choice: side,
        correct,
        reactionMs,
        elapsedMs: now - startedAtRef.current,
      });

      const next = {
        correct: statsRef.current.correct + (correct ? 1 : 0),
        total: statsRef.current.total + 1,
        streak: correct ? statsRef.current.streak + 1 : 0,
      };
      statsRef.current = next;
      bestStreakRef.current = Math.max(bestStreakRef.current, next.streak);
      setStats(next);
      setFeedback((prev) => ({ key: prev.key + 1, type: correct ? "correct" : "wrong" }));
      cue(correct ? "correct" : "wrong");
      setLiveMessage(`${correct ? "Correct" : "Incorrect"}. ${next.correct} of ${next.total}.`);

      lockUntilRef.current = now + INPUT_LOCK_MS;
      clearPending();
      timeoutRef.current = window.setTimeout(() => {
        if (finishedRef.current) return;
        if (performance.now() - startedAtRef.current >= duration) {
          finish();
          return;
        }
        nextTrial();
      }, INPUT_LOCK_MS);
    },
    [clearPending, duration, finish, nextTrial, trial]
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        answer("left");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        answer("right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer]);

  const rule = trial ? RULES[trial.rule] : RULES.parity;
  const RuleIcon = rule.icon;
  const progress = useMemo(() => Math.max(0, remainingMs / duration), [remainingMs, duration]);
  const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 100;

  return (
    <GameShell
      title="Cognitive Flexibility · Task Switch"
      subtitle="The frame colour tells you which question to answer"
      accent="amber"
      progress={progress}
      timerLabel={`${(remainingMs / 1000).toFixed(1)}s`}
      liveMessage={liveMessage}
      stats={[
        { label: "Streak", value: stats.streak },
        { label: "Accuracy", value: `${accuracy}%` },
        { label: "Trials", value: stats.total },
      ]}
    >
      <div className="relative">
        <AnimatePresence>
          <FeedbackFlash feedback={feedback} prefersReducedMotion={prefersReducedMotion} />
        </AnimatePresence>

        <div className="grid min-h-[260px] place-items-center md:min-h-[300px]">
          <AnimatePresence mode="wait">
            {trial && (
              <motion.div
                key={trial.key}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={
                    trial.isSwitch && !prefersReducedMotion
                      ? { scale: [1, 1.06, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.32 }}
                  className="mb-4 flex items-center gap-2 rounded-full border px-3.5 py-1.5"
                  style={{
                    borderColor: `${rule.hex}66`,
                    backgroundColor: `${rule.hex}14`,
                    color: rule.hex,
                  }}
                >
                  <RuleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{rule.label}</span>
                  {trial.isSwitch && (
                    <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-2xs uppercase tracking-wider text-text-primary">
                      Switch
                    </span>
                  )}
                </motion.div>

                <div
                  className="grid h-36 w-36 place-items-center rounded-3xl-soft border-[3px] md:h-44 md:w-44"
                  style={{
                    borderColor: rule.hex,
                    backgroundColor: `${rule.hex}12`,
                    boxShadow: `0 0 40px ${rule.hex}33`,
                  }}
                >
                  <span className="font-mono text-7xl text-text-primary md:text-8xl">{trial.digit}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {["left", "right"].map((side) => (
          <motion.button
            key={side}
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            onClick={() => answer(side)}
            className="min-h-14 rounded-2xl-soft border border-white/12 bg-white/[0.04] px-4 py-3 text-center transition-colors hover:bg-white/[0.09] focus-visible:outline-none"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={`${rule.key}-${side}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="block font-display text-base text-text-primary"
              >
                {side === "left" ? rule.left : rule.right}
              </motion.span>
            </AnimatePresence>
            <span className="mt-0.5 block text-2xs text-text-tertiary">
              {side === "left" ? "← Left arrow" : "Right arrow →"}
            </span>
          </motion.button>
        ))}
      </div>
    </GameShell>
  );
}
