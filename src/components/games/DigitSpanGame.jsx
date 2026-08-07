import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Delete, ArrowRight } from "lucide-react";
import { getRandom } from "../../lib/random";
import { cue } from "../../lib/feedback";
import GameShell from "./GameShell";
import { Button } from "../ui";

/**
 * Digit Span, forward and backward.
 *
 * Forward span measures the phonological loop — raw storage. Backward span adds
 * a manipulation load on top of the same storage. The gap between the two is
 * the interesting number: it separates "small buffer" from "buffer is fine but
 * working on its contents is expensive", which need completely different fixes.
 *
 * Staircase: two trials per length, one correct advances you, two failures end
 * that direction.
 */

const DIGIT_ON_MS = 780;
const DIGIT_OFF_MS = 260;
const MAX_LENGTH = 9;
const TRIALS_PER_LENGTH = 2;

const makeSequence = (length) =>
  Array.from({ length }, () => Math.floor(getRandom() * 10));

export default function DigitSpanGame({ onComplete, drillConfig = null }) {
  const prefersReducedMotion = useReducedMotion();

  const [direction, setDirection] = useState(drillConfig?.direction ?? "forward");
  const [length, setLength] = useState(drillConfig?.startLength ?? 3);
  const [phase, setPhase] = useState("brief"); // brief | present | recall | judge
  const [shown, setShown] = useState(null);
  const [showIndex, setShowIndex] = useState(-1);
  const [entry, setEntry] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [liveMessage, setLiveMessage] = useState("Digit span. Watch the digits.");

  const sequenceRef = useRef([]);
  const attemptAtLengthRef = useRef(0);
  const correctAtLengthRef = useRef(0);
  const forwardSpanRef = useRef(0);
  const backwardSpanRef = useRef(0);
  const totalCorrectRef = useRef(0);
  const totalTrialsRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef([]);
  const startedAtRef = useRef(performance.now());
  const recallStartRef = useRef(0);
  const trialsRef = useRef([]);
  const onlyDirection = !!drillConfig?.direction;

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

    onComplete(
      "span",
      { accuracy: totalTrialsRef.current ? (totalCorrectRef.current / totalTrialsRef.current) * 100 : 0 },
      {
        forwardSpan: forwardSpanRef.current,
        backwardSpan: backwardSpanRef.current,
        totalCorrect: totalCorrectRef.current,
        totalTrials: totalTrialsRef.current,
        trials: trialsRef.current,
        durationMs: Math.round(performance.now() - startedAtRef.current),
      }
    );
  }, [clearTimers, onComplete]);

  /** Present one sequence digit by digit, then open the keypad. */
  const runPresentation = useCallback((sequence) => {
    setPhase("present");
    setEntry([]);
    setShowIndex(-1);

    sequence.forEach((digit, i) => {
      const onId = window.setTimeout(() => {
        setShown(digit);
        setShowIndex(i);
        cue("tick");
      }, i * (DIGIT_ON_MS + DIGIT_OFF_MS));
      const offId = window.setTimeout(
        () => setShown(null),
        i * (DIGIT_ON_MS + DIGIT_OFF_MS) + DIGIT_ON_MS
      );
      timersRef.current.push(onId, offId);
    });

    const doneId = window.setTimeout(() => {
      setPhase("recall");
      recallStartRef.current = performance.now();
      setLiveMessage("Enter the digits.");
    }, sequence.length * (DIGIT_ON_MS + DIGIT_OFF_MS) + 200);
    timersRef.current.push(doneId);
  }, []);

  const startTrial = useCallback(
    (len, dir) => {
      const sequence = makeSequence(len);
      sequenceRef.current = sequence;
      setLastResult(null);
      setLiveMessage(
        dir === "forward"
          ? `${len} digits. Repeat them in order.`
          : `${len} digits. Repeat them backwards.`
      );
      runPresentation(sequence);
    },
    [runPresentation]
  );

  // Start the first trial after a brief instruction beat.
  useEffect(() => {
    const id = window.setTimeout(() => startTrial(length, direction), 1600);
    timersRef.current.push(id);
    return () => window.clearTimeout(id);
    // Intentionally runs once — subsequent trials are driven by submit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(
    (wasCorrect) => {
      const currentLength = length;
      const currentDirection = direction;

      attemptAtLengthRef.current += 1;
      if (wasCorrect) correctAtLengthRef.current += 1;

      const spanRef = currentDirection === "forward" ? forwardSpanRef : backwardSpanRef;
      if (wasCorrect) spanRef.current = Math.max(spanRef.current, currentLength);

      const exhausted = attemptAtLengthRef.current >= TRIALS_PER_LENGTH;
      const passed = correctAtLengthRef.current > 0;

      // Move up as soon as one trial at this length is correct.
      if (wasCorrect || (exhausted && passed)) {
        attemptAtLengthRef.current = 0;
        correctAtLengthRef.current = 0;
        const nextLength = currentLength + 1;
        if (nextLength > MAX_LENGTH) {
          if (currentDirection === "forward" && !onlyDirection) {
            setDirection("backward");
            setLength(2);
            timersRef.current.push(window.setTimeout(() => startTrial(2, "backward"), 1800));
            return;
          }
          finish();
          return;
        }
        setLength(nextLength);
        timersRef.current.push(
          window.setTimeout(() => startTrial(nextLength, currentDirection), 1500)
        );
        return;
      }

      // Failed twice at this length — this direction is done.
      if (exhausted && !passed) {
        /**
         * Record the floor rather than leaving the span at 0. Failing both
         * opening trials — one mistyped digit is enough — used to report
         * forwardSpan 0, which is not a measurement anyone can produce: it
         * means "below the shortest length we tested", not "no capacity". A
         * literal 0 dragged the combined span score to the floor and made the
         * report accuse a merely distracted user of a severe deficit.
         */
        spanRef.current = Math.max(spanRef.current, currentLength - 1);
        attemptAtLengthRef.current = 0;
        correctAtLengthRef.current = 0;
        if (currentDirection === "forward" && !onlyDirection) {
          setDirection("backward");
          setLength(2);
          timersRef.current.push(window.setTimeout(() => startTrial(2, "backward"), 1900));
          return;
        }
        finish();
        return;
      }

      // One failure — retry the same length.
      timersRef.current.push(
        window.setTimeout(() => startTrial(currentLength, currentDirection), 1500)
      );
    },
    [direction, length, finish, onlyDirection, startTrial]
  );

  const submit = useCallback(() => {
    if (phase !== "recall" || entry.length === 0) return;

    const target =
      direction === "forward" ? sequenceRef.current : [...sequenceRef.current].reverse();
    const correct =
      entry.length === target.length && entry.every((digit, i) => digit === target[i]);

    totalTrialsRef.current += 1;
    if (correct) totalCorrectRef.current += 1;

    trialsRef.current.push({
      direction,
      length: sequenceRef.current.length,
      sequence: sequenceRef.current,
      entry,
      correct,
      recallMs: Math.round(performance.now() - recallStartRef.current),
    });

    setPhase("judge");
    setLastResult({ correct, target });
    cue(correct ? "levelUp" : "wrong");
    setLiveMessage(correct ? "Correct." : `Incorrect. The answer was ${target.join(" ")}.`);

    timersRef.current.push(window.setTimeout(() => advance(correct), 1500));
  }, [advance, direction, entry, phase]);

  const pressDigit = useCallback(
    (digit) => {
      if (phase !== "recall") return;
      if (entry.length >= sequenceRef.current.length) return;
      cue("tap");
      setEntry((current) => [...current, digit]);
    },
    [entry.length, phase]
  );

  const backspace = useCallback(() => {
    if (phase !== "recall") return;
    cue("tap");
    setEntry((current) => current.slice(0, -1));
  }, [phase]);

  useEffect(() => {
    const onKey = (event) => {
      if (phase !== "recall") return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pressDigit(Number(event.key));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
      } else if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backspace, phase, pressDigit, submit]);

  const targetLength = sequenceRef.current.length || length;
  const isFull = entry.length === targetLength;
  // Progress is a rough completion estimate across both directions.
  const progress =
    1 -
    (direction === "forward" ? (length - 3) / 12 : 0.5 + (length - 2) / 14);

  return (
    <GameShell
      title={`Verbal Span · ${direction === "forward" ? "Forward" : "Backward"}`}
      subtitle={
        direction === "forward"
          ? "Repeat the digits in the order they appear"
          : "Repeat the digits in reverse order"
      }
      accent="violet"
      progress={Math.max(0.04, Math.min(1, progress))}
      timerLabel={`${targetLength} digits`}
      liveMessage={liveMessage}
      stats={[
        { label: "Forward", value: forwardSpanRef.current || "—" },
        { label: "Backward", value: backwardSpanRef.current || "—" },
      ]}
    >
      <div className="grid min-h-[168px] place-items-center">
        <AnimatePresence mode="wait">
          {phase === "brief" && (
            <motion.p
              key="brief"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-sm text-text-secondary"
            >
              Digits will appear one at a time. Watch them all, then type them back.
            </motion.p>
          )}

          {phase === "present" && (
            <motion.div key="present" className="text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${showIndex}-${shown}`}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 8 }}
                  animate={{ opacity: shown === null ? 0 : 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  className="font-mono text-8xl text-text-primary md:text-9xl"
                >
                  {shown ?? ""}
                </motion.div>
              </AnimatePresence>
              <div className="mt-4 flex justify-center gap-1.5">
                {Array.from({ length: targetLength }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-4 rounded-full transition-colors ${
                      i <= showIndex ? "bg-accent-violet" : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {(phase === "recall" || phase === "judge") && (
            <motion.div
              key="recall"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center"
            >
              <div className="mb-2 text-2xs uppercase tracking-wider text-text-tertiary">
                {direction === "forward" ? "In order" : "Reversed"}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: targetLength }).map((_, i) => {
                  const value = entry[i];
                  const isWrong =
                    lastResult && !lastResult.correct && value !== lastResult.target[i];
                  return (
                    <motion.div
                      key={i}
                      animate={{ scale: value != null ? 1 : 0.96 }}
                      className={`grid h-12 w-10 place-items-center rounded-xl-soft border font-mono text-2xl md:h-14 md:w-12 ${
                        lastResult
                          ? isWrong
                            ? "border-danger/50 bg-danger/10 text-danger"
                            : "border-success/50 bg-success/10 text-success"
                          : value != null
                          ? "border-accent-violet/50 bg-accent-violet/10 text-text-primary"
                          : "border-white/[0.08] bg-white/[0.02] text-text-tertiary"
                      }`}
                    >
                      {value ?? "·"}
                    </motion.div>
                  );
                })}
              </div>
              {lastResult && !lastResult.correct && (
                <p className="mt-3 text-xs text-text-secondary">
                  Answer:{" "}
                  <span className="font-mono text-text-primary">{lastResult.target.join(" ")}</span>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "recall" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-6 grid w-full max-w-xs grid-cols-3 gap-2"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => pressDigit(digit)}
              disabled={isFull}
              className="min-h-12 rounded-xl-soft border border-white/[0.09] bg-white/[0.03] font-mono text-xl text-text-primary transition-colors hover:bg-white/[0.08] active:bg-white/[0.12] disabled:opacity-35"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={backspace}
            disabled={entry.length === 0}
            aria-label="Delete last digit"
            className="grid min-h-12 place-items-center rounded-xl-soft border border-white/[0.09] bg-white/[0.03] text-text-secondary transition-colors hover:bg-white/[0.08] disabled:opacity-35"
          >
            <Delete className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => pressDigit(0)}
            disabled={isFull}
            className="min-h-12 rounded-xl-soft border border-white/[0.09] bg-white/[0.03] font-mono text-xl text-text-primary transition-colors hover:bg-white/[0.08] disabled:opacity-35"
          >
            0
          </button>
          <Button
            variant={isFull ? "violet" : "secondary"}
            size="md"
            onClick={submit}
            disabled={entry.length === 0}
            iconRight={ArrowRight}
            sound={null}
            className="min-h-12"
          >
            Go
          </Button>
        </motion.div>
      )}
    </GameShell>
  );
}
