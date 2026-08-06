import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRandom } from "../lib/random";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { springTap } from "../lib/motion";
import { cue } from "../lib/feedback";
import GameShell from "./games/GameShell";

const TEST_DURATION_MS = 30_000;
const INPUT_LOCK_MS = 300; 

const COLORS = [
  { id: "red", hex: "#FF5C5C", label: "Red" },
  { id: "blue", hex: "#5C94FF", label: "Blue" },
  { id: "green", hex: "#5CFF9D", label: "Green" },
  { id: "yellow", hex: "#FFD05C", label: "Yellow" },
];

function randomElement(arr) {
  return arr[Math.floor(getRandom() * arr.length)];
}

export default function StroopTestGame({ onComplete }) {
  const prefersReducedMotion = useReducedMotion();

  const [currentWord, setCurrentWord] = useState(null);
  const [remainingMs, setRemainingMs] = useState(TEST_DURATION_MS);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState({ key: 0, type: null });
  const [liveMessage, setLiveMessage] = useState("Interference Control test started.");

  const rafRef = useRef(null);
  const wordRenderedAtRef = useRef(null);
  const startedAtRef = useRef(null);
  const finishedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const attemptsRef = useRef([]);
  const timeoutRef = useRef(null);
  const bestStreakRef = useRef(0);
  const statRef = useRef({ correctAnswers: 0, totalAttempts: 0, streak: 0 });

  const progress = useMemo(() => Math.max(0, remainingMs / TEST_DURATION_MS), [remainingMs]);

  const clearDeferredNext = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finalize = useCallback(
    (finishedAt = performance.now()) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearDeferredNext();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const attempts = attemptsRef.current;
      const attemptsCount = attempts.length;
      const correctCount = attempts.reduce((sum, attempt) => sum + (attempt.correct ? 1 : 0), 0);
      const reactionTimes = attempts.map((attempt) => attempt.reactionMs);
      const avgReactionMs =
        reactionTimes.length === 0
          ? 0
          : reactionTimes.reduce((sum, ms) => sum + ms, 0) / reactionTimes.length;
      
      const accuracy = attemptsCount === 0 ? 0 : (correctCount / attemptsCount) * 100;

      onComplete(
        "stroop",
        {
          accuracy,
          avgReactionMs,
        },
        {
          totalAttempts: attemptsCount,
          correctAnswers: correctCount,
          incorrectAnswers: attemptsCount - correctCount,
          reactionTimes,
          attempts,
          bestStreak: bestStreakRef.current,
          startedAt: startedAtRef.current,
          finishedAt,
          durationMs: Math.round(Math.min(TEST_DURATION_MS, finishedAt - startedAtRef.current)),
        }
      );
    },
    [clearDeferredNext, onComplete]
  );

  const mountNextWord = useCallback(() => {
    const isCongruent = getRandom() > 0.7;
    const wordObj = randomElement(COLORS);
    
    let colorObj = wordObj;
    if (!isCongruent) {
      const otherColors = COLORS.filter(c => c.id !== wordObj.id);
      colorObj = randomElement(otherColors);
    }
    
    setCurrentWord({
      text: wordObj.label,
      colorId: colorObj.id,
      hex: colorObj.hex,
      // Recorded per trial so the report can compute interference cost —
      // the gap between congruent and incongruent trials is the whole point
      // of the Stroop task, and it is invisible without this flag.
      congruent: isCongruent,
    });
  }, []);

  useEffect(() => {
    if (currentWord != null) {
      wordRenderedAtRef.current = performance.now();
    }
  }, [currentWord]);

  useEffect(() => {
    startedAtRef.current = performance.now();
    mountNextWord();

    const tick = () => {
      const now = performance.now();
      const elapsedMs = now - startedAtRef.current;
      const nextRemaining = Math.max(0, TEST_DURATION_MS - elapsedMs);
      setRemainingMs(nextRemaining);

      if (elapsedMs >= TEST_DURATION_MS) {
        finalize(now);
        return;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      clearDeferredNext();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [clearDeferredNext, finalize, mountNextWord]);

  const handleAnswer = useCallback(
    (colorId, source) => {
      const now = performance.now();
      if (finishedRef.current) return;
      if (now < lockUntilRef.current) return;
      if (startedAtRef.current && now - startedAtRef.current >= TEST_DURATION_MS) {
        finalize(now);
        return;
      }
      if (currentWord == null || wordRenderedAtRef.current == null) return;

      if (
        source === "touch" &&
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(10);
      }

      const isCorrect = colorId === currentWord.colorId;
      const reactionMs = now - wordRenderedAtRef.current;
      const elapsedMs = now - startedAtRef.current;

      attemptsRef.current.push({
        word: currentWord.text,
        colorId: currentWord.colorId,
        congruent: currentWord.congruent,
        choice: colorId,
        correct: isCorrect,
        reactionMs,
        renderedAt: wordRenderedAtRef.current,
        respondedAt: now,
        elapsedMs,
      });

      cue(isCorrect ? "correct" : "wrong");

      const nextAttempts = statRef.current.totalAttempts + 1;
      const nextCorrect = isCorrect
        ? statRef.current.correctAnswers + 1
        : statRef.current.correctAnswers;
      const nextStreak = isCorrect ? statRef.current.streak + 1 : 0;
      statRef.current = {
        totalAttempts: nextAttempts,
        correctAnswers: nextCorrect,
        streak: nextStreak,
      };

      if (nextStreak > bestStreakRef.current) {
        bestStreakRef.current = nextStreak;
      }

      setTotalAttempts(nextAttempts);
      setCorrectAnswers(nextCorrect);
      setStreak(nextStreak);
      setFeedback((prev) => ({ key: prev.key + 1, type: isCorrect ? "correct" : "wrong" }));
      setLiveMessage(`Score ${nextCorrect} out of ${nextAttempts}. Current streak ${nextStreak}.`);

      lockUntilRef.current = now + INPUT_LOCK_MS;
      clearDeferredNext();
      timeoutRef.current = window.setTimeout(() => {
        const checkNow = performance.now();
        if (finishedRef.current) return;
        if (checkNow - startedAtRef.current >= TEST_DURATION_MS) {
          finalize(checkNow);
          return;
        }
        mountNextWord();
      }, INPUT_LOCK_MS);
    },
    [clearDeferredNext, currentWord, finalize, mountNextWord]
  );

  return (
    <GameShell
      title="Interference Control · Stroop"
      subtitle="Name the ink colour, not the word"
      accent="amber"
      progress={progress}
      timerLabel={`${Math.max(0, remainingMs / 1000).toFixed(1)}s`}
      liveMessage={liveMessage}
      stats={[
        { label: "Streak", value: streak },
        { label: "Correct", value: `${correctAnswers}/${totalAttempts}` },
      ]}
    >
      <div className="relative mb-8 flex min-h-[180px] flex-col items-center justify-center md:min-h-[220px]">
        <AnimatePresence>
          {feedback.type === "correct" && !prefersReducedMotion && (
            <>
              <motion.div
                key={`flash-${feedback.key}`}
                initial={{ opacity: 0.22 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 rounded-3xl-soft bg-success/20"
              />
              <motion.span
                key={`particle-${feedback.key}`}
                initial={{ opacity: 0.8, y: 12, scale: 0.8 }}
                animate={{ opacity: 0, y: -36, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className="pointer-events-none absolute h-2 w-2 rounded-full bg-success shadow-glow-cyan"
              />
            </>
          )}
        </AnimatePresence>

        <p className="mb-2 text-xs text-text-secondary uppercase tracking-wider">Select the ink color</p>

        <motion.div
          key={`num-wrap-${feedback.key}`}
          animate={
            feedback.type === "wrong" && !prefersReducedMotion
              ? { x: [0, -10, 9, -6, 6, 0] }
              : { x: 0 }
          }
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord ? currentWord.text + currentWord.hex : "loading"}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 1.02 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="font-display text-5xl tracking-tight md:text-7xl uppercase font-bold"
              style={{ color: currentWord?.hex || "#FFF" }}
            >
              {currentWord?.text ?? "--"}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COLORS.map((color) => (
          <motion.button
            key={color.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={springTap}
            onClick={() => handleAnswer(color.id, "touch")}
            className="flex min-h-12 items-center justify-center rounded-2xl-soft border border-white/15 bg-bg-elevated px-4 py-3 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
            style={{ 
              color: color.hex, 
            }}
          >
            <span className="block font-display text-sm md:text-base">{color.label}</span>
          </motion.button>
        ))}
      </div>
    </GameShell>
  );
}
