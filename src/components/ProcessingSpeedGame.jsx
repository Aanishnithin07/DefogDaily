import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { fadeInUp, springTap, useReducedMotionVariant } from "../lib/motion";

const TEST_DURATION_MS = 30_000;
const INPUT_LOCK_MS = 170;

const pickDigitsForElapsed = (elapsedMs) => {
  const progress = elapsedMs / TEST_DURATION_MS;
  if (progress < 0.4) return Math.random() < 0.5 ? 1 : 2;
  if (progress < 0.8) return Math.random() < 0.35 ? 2 : 3;
  return 3;
};

const randomNumberByDigits = (digits) => {
  const min = digits === 1 ? 1 : 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const nextDistinctNumber = (previous, elapsedMs) => {
  const digits = pickDigitsForElapsed(elapsedMs);
  let candidate = randomNumberByDigits(digits);
  while (candidate === previous) {
    candidate = randomNumberByDigits(digits);
  }
  return candidate;
};

export default function ProcessingSpeedGame({ onComplete }) {
  const prefersReducedMotion = useReducedMotion();

  const [currentNumber, setCurrentNumber] = useState(null);
  const [remainingMs, setRemainingMs] = useState(TEST_DURATION_MS);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState({ key: 0, type: null });
  const [liveMessage, setLiveMessage] = useState("Processing speed test started.");

  const rafRef = useRef(null);
  const numberRenderedAtRef = useRef(null);
  const startedAtRef = useRef(null);
  const finishedRef = useRef(false);
  const lockUntilRef = useRef(0);
  const lastNumberRef = useRef(null);
  const attemptsRef = useRef([]);
  const timeoutRef = useRef(null);
  const bestStreakRef = useRef(0);
  const statRef = useRef({ correctAnswers: 0, totalAttempts: 0, streak: 0 });

  const sectionVariants = useReducedMotionVariant(prefersReducedMotion, fadeInUp);

  const progress = useMemo(() => Math.max(0, remainingMs / TEST_DURATION_MS), [remainingMs]);

  const clearDeferredNext = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const finalize = useCallback((finishedAt = performance.now()) => {
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
    const accuracy = attemptsCount === 0 ? 0 : correctCount / attemptsCount;

    onComplete(
      "speed",
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
  }, [clearDeferredNext, onComplete]);

  const mountNextNumber = useCallback((elapsedMs) => {
    const next = nextDistinctNumber(lastNumberRef.current, elapsedMs);
    lastNumberRef.current = next;
    setCurrentNumber(next);
  }, []);

  useEffect(() => {
    if (currentNumber != null) {
      // Capture the timestamp as soon as this specific stimulus is on screen.
      numberRenderedAtRef.current = performance.now();
    }
  }, [currentNumber]);

  useEffect(() => {
    startedAtRef.current = performance.now();
    mountNextNumber(0);

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
  }, [clearDeferredNext, finalize, mountNextNumber]);

  const handleAnswer = useCallback((choice, source) => {
    const now = performance.now();
    if (finishedRef.current) return;
    if (now < lockUntilRef.current) return;
    if (startedAtRef.current && now - startedAtRef.current >= TEST_DURATION_MS) {
      finalize(now);
      return;
    }
    if (currentNumber == null || numberRenderedAtRef.current == null) return;

    if (source === "touch" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
    }

    const isOdd = currentNumber % 2 !== 0;
    const isCorrect = choice === "odd" ? isOdd : !isOdd;
    const reactionMs = now - numberRenderedAtRef.current;
    const elapsedMs = now - startedAtRef.current;
    const digitLength = `${currentNumber}`.length;

    attemptsRef.current.push({
      number: currentNumber,
      choice,
      correct: isCorrect,
      reactionMs,
      digitLength,
      renderedAt: numberRenderedAtRef.current,
      respondedAt: now,
      elapsedMs,
    });

    const nextAttempts = statRef.current.totalAttempts + 1;
    const nextCorrect = isCorrect ? statRef.current.correctAnswers + 1 : statRef.current.correctAnswers;
    const nextStreak = isCorrect ? statRef.current.streak + 1 : 0;
    statRef.current = { totalAttempts: nextAttempts, correctAnswers: nextCorrect, streak: nextStreak };

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
      mountNextNumber(checkNow - startedAtRef.current);
    }, INPUT_LOCK_MS);
  }, [clearDeferredNext, currentNumber, finalize, mountNextNumber]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleAnswer("odd", "keyboard");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleAnswer("even", "keyboard");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAnswer]);

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      exit="hidden"
      className="relative overflow-hidden rounded-3xl-soft border border-white/10 bg-bg-card/70 p-5 backdrop-blur-xl md:p-7"
    >
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
          <span>Processing Speed</span>
          <span className="font-mono">{Math.max(0, remainingMs / 1000).toFixed(1)}s</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
          <motion.div
            className="h-full origin-left bg-accent-cyan"
            style={{ scaleX: progress }}
            transition={{ duration: 0 }}
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-text-secondary">
        <div>
          Streak: <span className="font-mono text-text-primary">{streak}</span>
        </div>
        <div>
          Correct:{" "}
          <span className="font-mono text-text-primary">
            {correctAnswers}/{totalAttempts}
          </span>
        </div>
      </div>

      <div className="relative mb-8 grid min-h-[180px] place-items-center md:min-h-[220px]">
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
              key={currentNumber ?? "loading"}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 1.02 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="font-mono text-6xl tracking-tight text-text-primary md:text-7xl"
            >
              {currentNumber ?? "--"}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={springTap}
          onClick={() => handleAnswer("odd", "touch")}
          className="min-h-12 rounded-2xl-soft border border-white/15 bg-bg-elevated px-4 py-3 text-left text-text-primary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
        >
          <span className="block font-display text-base">Odd</span>
          <span className="block text-xs text-text-secondary">Left Arrow</span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          transition={springTap}
          onClick={() => handleAnswer("even", "touch")}
          className="min-h-12 rounded-2xl-soft border border-white/15 bg-bg-elevated px-4 py-3 text-left text-text-primary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        >
          <span className="block font-display text-base">Even</span>
          <span className="block text-xs text-text-secondary">Right Arrow</span>
        </motion.button>
      </div>
    </motion.section>
  );
}
