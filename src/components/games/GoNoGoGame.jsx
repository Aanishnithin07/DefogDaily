import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getRandom } from "../../lib/random";
import { cue } from "../../lib/feedback";
import GameShell, { FeedbackFlash } from "./GameShell";

/**
 * Go/No-Go — a direct measure of your brake.
 *
 * Tap every circle. Never tap a square. Because circles come up three times out
 * of four, the tapping response becomes prepotent, and the squares then measure
 * how well you can cancel an action that has already started.
 *
 * The two ways to fail are graded separately and mean different things:
 *   commission (tapped a square) = impulsivity
 *   omission   (missed a circle) = inattention
 */

const STIM_MS = 720;
const ISI_MS = 560;
const GRACE_MS = 220;
const NO_GO_RATE = 0.26;

export default function GoNoGoGame({ onComplete, drillConfig = null }) {
  const prefersReducedMotion = useReducedMotion();

  const totalTrials = drillConfig?.trials ?? 34;
  const [trialIndex, setTrialIndex] = useState(-1);
  const [stimulus, setStimulus] = useState(null); // { isGo }
  const [feedback, setFeedback] = useState({ key: 0, type: null });
  const [tally, setTally] = useState({ correct: 0, commission: 0, omission: 0 });
  const [liveMessage, setLiveMessage] = useState("Go / No-Go starting. Tap circles, never squares.");
  const [streak, setStreak] = useState(0);

  const respondedRef = useRef(false);
  const stimAtRef = useRef(0);
  const startedAtRef = useRef(performance.now());
  const attemptsRef = useRef([]);
  const tallyRef = useRef({ correct: 0, commission: 0, omission: 0 });
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const goCountRef = useRef(0);
  const noGoCountRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef([]);
  const currentRef = useRef(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    cue("complete");

    const attempts = attemptsRef.current;
    const goHits = attempts.filter((a) => a.isGo && a.responded);
    const reactionTimes = goHits.map((a) => a.reactionMs).filter(Boolean);
    const avgReactionMs = reactionTimes.length
      ? reactionTimes.reduce((sum, ms) => sum + ms, 0) / reactionTimes.length
      : 0;

    const goTrials = goCountRef.current;
    const noGoTrials = noGoCountRef.current;
    const correctTrials = attempts.filter((a) => a.correct).length;

    onComplete(
      "inhibition",
      {
        accuracy: attempts.length ? (correctTrials / attempts.length) * 100 : 0,
        avgReactionMs,
      },
      {
        goTrials,
        noGoTrials,
        commissionErrors: tallyRef.current.commission,
        omissionErrors: tallyRef.current.omission,
        bestStreak: bestStreakRef.current,
        attempts,
        durationMs: Math.round(performance.now() - startedAtRef.current),
      }
    );
  }, [clearTimers, onComplete]);

  /** Grade the trial once its response window closes. */
  const closeTrial = useCallback(
    (index, isGo) => {
      const didRespond = respondedRef.current;
      const next = { ...tallyRef.current };
      let correct;

      if (isGo && didRespond) {
        correct = true;
        next.correct += 1;
      } else if (isGo && !didRespond) {
        correct = false;
        next.omission += 1;
        setFeedback((prev) => ({ key: prev.key + 1, type: "wrong" }));
        cue("wrong");
      } else if (!isGo && !didRespond) {
        correct = true;
        next.correct += 1;
      } else {
        // Already recorded as a commission error at response time.
        correct = false;
      }

      if (!didRespond) {
        attemptsRef.current.push({
          trial: index,
          isGo,
          responded: false,
          correct,
          reactionMs: null,
          elapsedMs: performance.now() - startedAtRef.current,
        });
        streakRef.current = correct ? streakRef.current + 1 : 0;
        bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
        setStreak(streakRef.current);
      }

      tallyRef.current = next;
      setTally(next);

      if (index + 1 >= totalTrials) {
        timersRef.current.push(window.setTimeout(finish, 420));
        return;
      }
      setTrialIndex(index + 1);
    },
    [finish, totalTrials]
  );

  /* Trial driver. */
  useEffect(() => {
    if (trialIndex < 0 || finishedRef.current) return undefined;

    // Never allow three No-Go trials in a row — prepotency needs Go pressure.
    const recent = attemptsRef.current.slice(-2);
    const forceGo = recent.length === 2 && recent.every((a) => !a.isGo);
    const isGo = forceGo || getRandom() > NO_GO_RATE;

    if (isGo) goCountRef.current += 1;
    else noGoCountRef.current += 1;

    respondedRef.current = false;
    currentRef.current = { isGo, index: trialIndex };
    setStimulus({ isGo, key: trialIndex });
    stimAtRef.current = performance.now();

    const hideId = window.setTimeout(() => setStimulus(null), STIM_MS);
    const gradeId = window.setTimeout(() => closeTrial(trialIndex, isGo), STIM_MS + GRACE_MS + ISI_MS * 0.5);
    timersRef.current.push(hideId, gradeId);

    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(gradeId);
    };
  }, [trialIndex, closeTrial]);

  useEffect(() => {
    const id = window.setTimeout(() => setTrialIndex(0), 1500);
    timersRef.current.push(id);
    return () => window.clearTimeout(id);
  }, []);

  const respond = useCallback(() => {
    const current = currentRef.current;
    if (!current || respondedRef.current || finishedRef.current) return;
    const elapsed = performance.now() - stimAtRef.current;
    // Ignore taps in the blank gap — they belong to no trial.
    if (elapsed > STIM_MS + GRACE_MS) return;

    respondedRef.current = true;
    const { isGo, index } = current;
    const correct = isGo;

    attemptsRef.current.push({
      trial: index,
      isGo,
      responded: true,
      correct,
      reactionMs: elapsed,
      elapsedMs: performance.now() - startedAtRef.current,
    });

    if (!isGo) {
      const next = { ...tallyRef.current, commission: tallyRef.current.commission + 1 };
      tallyRef.current = next;
      setTally(next);
      streakRef.current = 0;
      setStreak(0);
      setFeedback((prev) => ({ key: prev.key + 1, type: "wrong" }));
      cue("wrong");
      setLiveMessage("That was a square. Hold next time.");
    } else {
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      setStreak(streakRef.current);
      setFeedback((prev) => ({ key: prev.key + 1, type: "correct" }));
      cue("correct");
      setLiveMessage("Go.");
    }
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return;
      if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        respond();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond]);

  const progress = 1 - Math.max(0, trialIndex) / totalTrials;

  return (
    <GameShell
      title="Response Inhibition · Go / No-Go"
      subtitle="Tap every circle. Never tap a square."
      accent="amber"
      progress={progress}
      timerLabel={`${Math.max(0, totalTrials - Math.max(0, trialIndex))} left`}
      liveMessage={liveMessage}
      stats={[
        { label: "Streak", value: streak },
        { label: "Impulse errors", value: tally.commission },
        { label: "Missed", value: tally.omission },
      ]}
    >
      <div className="relative">
        <AnimatePresence>
          <FeedbackFlash feedback={feedback} prefersReducedMotion={prefersReducedMotion} />
        </AnimatePresence>

        <button
          type="button"
          onPointerDown={respond}
          aria-label="Respond"
          className="grid min-h-[300px] w-full place-items-center rounded-3xl-soft border border-white/[0.06] bg-white/[0.02] transition-colors focus-visible:outline-none active:bg-white/[0.05] md:min-h-[340px]"
        >
          <AnimatePresence mode="wait">
            {stimulus ? (
              <motion.div
                key={stimulus.key}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className={
                  stimulus.isGo
                    ? "h-36 w-36 rounded-full bg-accent-cyan shadow-glow-cyan md:h-44 md:w-44"
                    : "h-36 w-36 rounded-3xl-soft bg-accent-rose shadow-glow-rose md:h-44 md:w-44"
                }
              />
            ) : (
              <motion.div
                key="blank"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-36 w-36 rounded-full border border-dashed border-white/[0.07] md:h-44 md:w-44"
              />
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-6 text-xs text-text-tertiary">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-accent-cyan" aria-hidden="true" />
          Circle — tap
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px] bg-accent-rose" aria-hidden="true" />
          Square — hold
        </span>
      </div>
      <p className="mt-2 text-center text-2xs text-text-tertiary">
        Tap anywhere in the panel, or press Space
      </p>
    </GameShell>
  );
}
