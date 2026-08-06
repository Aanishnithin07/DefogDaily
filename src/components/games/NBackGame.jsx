import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { getRandom } from "../../lib/random";
import { cue } from "../../lib/feedback";
import GameShell, { FeedbackFlash } from "./GameShell";
import { Button } from "../ui";

/**
 * Spatial N-Back — the most-studied working-memory training paradigm there is.
 *
 * A square lights up somewhere on a 3x3 grid every 2.5 seconds. You press MATCH
 * when the current position is the same as the one N steps back. That forces a
 * constant update-and-discard cycle, which is exactly why it loads fluid
 * intelligence harder than any static span test.
 *
 * Two blocks with adaptation in between: clear the first block and N rises,
 * struggle and it falls, so everyone trains at their own edge.
 */

const GRID = 9;
const STIM_MS = 700;
const ISI_MS = 1800;
const TRIAL_MS = STIM_MS + ISI_MS;
const BLOCK_TRIALS = 12;
const BLOCKS = 2;
const TARGET_RATE = 0.32;

const startingN = (difficulty = 0) => {
  if (difficulty >= 88) return 4;
  if (difficulty >= 68) return 3;
  return 2;
};

/**
 * Builds a position sequence with a controlled proportion of true N-back
 * matches. Non-target positions are forced to differ from the N-back item so
 * the target rate stays honest.
 */
const buildSequence = (length, n) => {
  const seq = [];
  for (let i = 0; i < length; i += 1) {
    if (i >= n && getRandom() < TARGET_RATE) {
      seq.push(seq[i - n]);
    } else {
      let candidate = Math.floor(getRandom() * GRID);
      if (i >= n && candidate === seq[i - n]) {
        candidate = (candidate + 1 + Math.floor(getRandom() * (GRID - 1))) % GRID;
      }
      seq.push(candidate);
    }
  }
  return seq;
};

export default function NBackGame({ onComplete, initialDifficulty = 0, drillConfig = null }) {
  const prefersReducedMotion = useReducedMotion();

  const [n, setN] = useState(() => drillConfig?.n ?? startingN(initialDifficulty));
  const [block, setBlock] = useState(0);
  const [trialIndex, setTrialIndex] = useState(-1);
  const [active, setActive] = useState(null);
  const [responded, setResponded] = useState(false);
  const [feedback, setFeedback] = useState({ key: 0, type: null });
  const [tally, setTally] = useState({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 });
  const [liveMessage, setLiveMessage] = useState("N-back starting.");
  const [interBlock, setInterBlock] = useState(false);

  const totalBlocks = drillConfig?.blocks ?? BLOCKS;
  const sequenceRef = useRef(buildSequence(BLOCK_TRIALS + n, n));
  const nRef = useRef(n);
  const respondedRef = useRef(false);
  const stimAtRef = useRef(0);
  const attemptsRef = useRef([]);
  const tallyRef = useRef({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 });
  const peakNRef = useRef(n);
  const finishedRef = useRef(false);
  const timersRef = useRef([]);
  const startedAtRef = useRef(performance.now());

  const schedule = useCallback((fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

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

    const t = tallyRef.current;
    const attempts = attemptsRef.current;
    const reactionTimes = attempts.filter((a) => a.reactionMs).map((a) => a.reactionMs);
    const avgReactionMs = reactionTimes.length
      ? reactionTimes.reduce((sum, ms) => sum + ms, 0) / reactionTimes.length
      : 0;
    const scored = t.hits + t.misses + t.falseAlarms + t.correctRejections;

    onComplete(
      "nback",
      {
        accuracy: scored ? ((t.hits + t.correctRejections) / scored) * 100 : 0,
        avgReactionMs,
      },
      {
        n: nRef.current,
        peakN: peakNRef.current,
        hits: t.hits,
        misses: t.misses,
        falseAlarms: t.falseAlarms,
        correctRejections: t.correctRejections,
        attempts,
        blocks: totalBlocks,
        durationMs: Math.round(performance.now() - startedAtRef.current),
      }
    );
  }, [clearTimers, onComplete, totalBlocks]);

  /** Grade the trial that just ended, then advance or finish. */
  const closeTrial = useCallback(
    (index, position) => {
      const currentN = nRef.current;
      const seq = sequenceRef.current;
      const isTarget = index >= currentN && seq[index - currentN] === position;
      const didRespond = respondedRef.current;

      const next = { ...tallyRef.current };
      if (isTarget && didRespond) next.hits += 1;
      else if (isTarget && !didRespond) next.misses += 1;
      else if (!isTarget && didRespond) next.falseAlarms += 1;
      else next.correctRejections += 1;

      tallyRef.current = next;
      setTally(next);

      // Misses are silent in the moment but recorded — flagging them mid-run
      // would turn this into a reaction task instead of a memory task.
      if (isTarget && !didRespond && index >= currentN) {
        setFeedback((prev) => ({ key: prev.key + 1, type: "wrong" }));
      }

      const isLastOfBlock = index >= seq.length - 1;
      if (!isLastOfBlock) {
        setTrialIndex(index + 1);
        return;
      }

      if (block + 1 >= totalBlocks) {
        schedule(finish, 500);
        return;
      }

      // Adapt: clearing a block moves you up, struggling moves you down.
      const blockScored = next.hits + next.misses + next.falseAlarms + next.correctRejections;
      const blockAccuracy = blockScored ? (next.hits + next.correctRejections) / blockScored : 0;
      let nextN = currentN;
      if (blockAccuracy >= 0.85 && next.hits > 0) nextN = Math.min(5, currentN + 1);
      else if (blockAccuracy < 0.6) nextN = Math.max(1, currentN - 1);

      nRef.current = nextN;
      peakNRef.current = Math.max(peakNRef.current, nextN);
      sequenceRef.current = buildSequence(BLOCK_TRIALS + nextN, nextN);

      setInterBlock(true);
      setActive(null);
      setLiveMessage(
        nextN > currentN
          ? `Block cleared. Moving up to ${nextN}-back.`
          : nextN < currentN
          ? `Stepping down to ${nextN}-back.`
          : `Next block at ${nextN}-back.`
      );
      if (nextN > currentN) cue("levelUp");

      schedule(() => {
        setN(nextN);
        setBlock((b) => b + 1);
        setInterBlock(false);
        setTrialIndex(0);
      }, 2600);
    },
    [block, finish, schedule, totalBlocks]
  );

  /* Trial driver: show the stimulus, hide it, then grade. */
  useEffect(() => {
    if (trialIndex < 0 || interBlock || finishedRef.current) return undefined;
    const position = sequenceRef.current[trialIndex];
    if (position == null) return undefined;

    respondedRef.current = false;
    setResponded(false);
    setActive(position);
    stimAtRef.current = performance.now();
    cue("tick");

    const hideId = window.setTimeout(() => setActive(null), STIM_MS);
    const gradeId = window.setTimeout(() => closeTrial(trialIndex, position), TRIAL_MS);
    timersRef.current.push(hideId, gradeId);

    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(gradeId);
    };
  }, [trialIndex, interBlock, closeTrial]);

  // Kick off after a short beat so the instructions are readable first.
  useEffect(() => {
    const id = schedule(() => setTrialIndex(0), 1400);
    return () => window.clearTimeout(id);
  }, [schedule]);

  const handleMatch = useCallback(() => {
    if (respondedRef.current || trialIndex < 0 || interBlock || finishedRef.current) return;
    respondedRef.current = true;
    setResponded(true);

    const currentN = nRef.current;
    const seq = sequenceRef.current;
    const position = seq[trialIndex];
    const isTarget = trialIndex >= currentN && seq[trialIndex - currentN] === position;
    const reactionMs = performance.now() - stimAtRef.current;

    attemptsRef.current.push({
      trial: trialIndex,
      n: currentN,
      isTarget,
      correct: isTarget,
      reactionMs,
      elapsedMs: performance.now() - startedAtRef.current,
    });

    setFeedback((prev) => ({ key: prev.key + 1, type: isTarget ? "correct" : "wrong" }));
    cue(isTarget ? "correct" : "wrong");
    setLiveMessage(isTarget ? "Match." : "Not a match.");
  }, [trialIndex, interBlock]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return;
      if (event.code === "Space" || event.key === "Enter" || event.key === "m") {
        event.preventDefault();
        handleMatch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMatch]);

  const totalTrials = totalBlocks * (BLOCK_TRIALS + n);
  const doneTrials = block * (BLOCK_TRIALS + n) + Math.max(0, trialIndex);
  const progress = 1 - doneTrials / Math.max(1, totalTrials);

  return (
    <GameShell
      title={`${n}-Back · Fluid Working Memory`}
      subtitle={`Press MATCH when the square repeats the position from ${n} step${n === 1 ? "" : "s"} ago`}
      accent="violet"
      progress={progress}
      timerLabel={`Block ${Math.min(block + 1, totalBlocks)}/${totalBlocks}`}
      liveMessage={liveMessage}
      stats={[
        { label: "Hits", value: tally.hits },
        { label: "Missed", value: tally.misses },
        { label: "False", value: tally.falseAlarms },
      ]}
    >
      <div className="relative">
        <AnimatePresence>
          <FeedbackFlash feedback={feedback} prefersReducedMotion={prefersReducedMotion} />
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {interBlock ? (
            <motion.div
              key="interblock"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid min-h-[300px] place-items-center text-center"
            >
              <div>
                <div className="font-display text-4xl text-gradient-cyan">{nRef.current}-Back</div>
                <p className="mt-3 text-sm text-text-secondary">{liveMessage}</p>
                <p className="mt-1 text-xs text-text-tertiary">Next block starting…</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto grid w-fit grid-cols-3 gap-2.5 md:gap-3"
            >
              {Array.from({ length: GRID }).map((_, i) => {
                const lit = active === i;
                return (
                  <motion.div
                    key={i}
                    animate={
                      lit && !prefersReducedMotion
                        ? { scale: [0.94, 1.04, 1], opacity: 1 }
                        : { scale: 1, opacity: 1 }
                    }
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className={`h-[4.5rem] w-[4.5rem] rounded-2xl-soft border transition-colors duration-150 sm:h-20 sm:w-20 md:h-[5.5rem] md:w-[5.5rem] ${
                      lit
                        ? "border-accent-violet bg-accent-violet shadow-glow-violet"
                        : "border-white/[0.07] bg-white/[0.03]"
                    }`}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-7">
        <Button
          variant={responded ? "secondary" : "violet"}
          size="lg"
          className="w-full"
          onClick={handleMatch}
          disabled={responded || interBlock || trialIndex < 0}
          sound={null}
          icon={responded ? Check : undefined}
        >
          {responded ? "Locked in" : "MATCH"}
        </Button>
        <p className="mt-2.5 text-center text-2xs text-text-tertiary">
          Space or Enter also works · Do nothing when it is not a match
        </p>
      </div>

      <AnimatePresence>
        {feedback.type && !prefersReducedMotion && (
          <motion.div
            key={`badge-${feedback.key}`}
            initial={{ opacity: 1, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-1/2 grid place-items-center"
          >
            {feedback.type === "correct" ? (
              <Check className="h-16 w-16 text-success" />
            ) : (
              <X className="h-16 w-16 text-danger" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  );
}
