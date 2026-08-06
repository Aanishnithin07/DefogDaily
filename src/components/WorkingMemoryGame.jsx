import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { fadeIn, fadeInUp, springTap, useReducedMotionVariant } from "../lib/motion";
import { cue } from "../lib/feedback";
import { getRandom, shuffleArray } from "../lib/random";

const MEMORIZE_DURATION_MS = 5_000;
const MAX_SELECTIONS = 5;

const WORD_CATEGORIES = {
  household: [
    "chair",
    "table",
    "lamp",
    "pillow",
    "blanket",
    "drawer",
    "mirror",
    "basket",
    "shelf",
    "curtain",
    "hanger",
    "bucket",
  ],
  kitchen: [
    "spoon",
    "plate",
    "mug",
    "fork",
    "bowl",
    "knife",
    "pan",
    "kettle",
    "ladle",
    "fridge",
    "toaster",
    "napkin",
  ],
  outdoors: [
    "river",
    "forest",
    "meadow",
    "cloud",
    "pebble",
    "branch",
    "valley",
    "island",
    "canyon",
    "dune",
    "harbor",
    "breeze",
  ],
};

const createRound = () => {
  const categories = Object.keys(WORD_CATEGORIES);
  const category = categories[Math.floor(getRandom() * categories.length)];
  const words = shuffleArray(WORD_CATEGORIES[category]);
  const targets = words.slice(0, 5);
  const decoys = words.slice(5, 12);
  return {
    category,
    targets,
    decoys,
    recallWords: shuffleArray([...targets, ...decoys]),
  };
};

export default function WorkingMemoryGame({ onComplete }) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState("memorize");
  const [memorizeRemainingMs, setMemorizeRemainingMs] = useState(MEMORIZE_DURATION_MS);
  const [selectedWords, setSelectedWords] = useState([]);
  const [liveMessage, setLiveMessage] = useState("Memorize the five words.");
  const round = useMemo(createRound, []);

  const memorizeStartedAtRef = useRef(null);
  const recallStartedAtRef = useRef(null);
  const completedRef = useRef(false);
  const rafRef = useRef(null);
  const submitTimeoutRef = useRef(null);

  const sectionVariants = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const transitionVariants = useReducedMotionVariant(prefersReducedMotion, fadeInUp, fadeIn);

  const clearSubmitTimeout = useCallback(() => {
    if (submitTimeoutRef.current) {
      window.clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearSubmitTimeout();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [clearSubmitTimeout]
  );

  useEffect(() => {
    if (phase !== "memorize") return undefined;
    memorizeStartedAtRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - memorizeStartedAtRef.current;
      const remaining = Math.max(0, MEMORIZE_DURATION_MS - elapsed);
      setMemorizeRemainingMs(remaining);

      if (elapsed >= MEMORIZE_DURATION_MS) {
        setPhase("recall");
        recallStartedAtRef.current = performance.now();
        setLiveMessage("Select the words you remember.");
        return;
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [phase]);

  const toggleWordSelection = (word) => {
    if (phase !== "recall") return;
    cue("tap");
    setSelectedWords((current) => {
      if (current.includes(word)) {
        const next = current.filter((item) => item !== word);
        setLiveMessage(`${next.length} of 5 words selected.`);
        return next;
      }
      if (current.length >= MAX_SELECTIONS) {
        setLiveMessage("Maximum of 5 selections reached.");
        return current;
      }
      const next = [...current, word];
      setLiveMessage(`${next.length} of 5 words selected.`);
      return next;
    });
  };

  const submitRecall = () => {
    if (phase !== "recall" || selectedWords.length === 0 || completedRef.current) return;

    const submittedAt = performance.now();
    const timeTakenMs = Math.round(
      recallStartedAtRef.current ? submittedAt - recallStartedAtRef.current : 0
    );

    const correctlyRecalled = selectedWords.filter((word) => round.targets.includes(word));
    const falselySelected = selectedWords.filter((word) => !round.targets.includes(word));
    const missedTargets = round.targets.filter((word) => !selectedWords.includes(word));

    const correctSelections = correctlyRecalled.length;
    const decoySelections = falselySelected.length;

    /**
     * Scoring formula:
     * rawScore = max(0, correctSelections - (0.5 * decoySelections))
     * accuracy = (rawScore / 5) * 100
     */
    const rawScore = Math.max(0, correctSelections - 0.5 * decoySelections);
    const accuracy = (rawScore / 5) * 100;

    setPhase("submitted");
    setLiveMessage(`Submitted. Accuracy ${accuracy.toFixed(0)} percent.`);

    clearSubmitTimeout();
    submitTimeoutRef.current = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(
        "memory",
        {
          accuracy,
          timeTakenMs,
        },
        {
          category: round.category,
          targetWords: round.targets,
          decoyWords: round.decoys,
          selectedWords,
          correctlyRecalled,
          missedTargets,
          falselySelected,
          correctSelections,
          decoySelections,
          rawScore,
          memorizationDurationMs: MEMORIZE_DURATION_MS,
          timeTakenMs,
          recallStartedAt: recallStartedAtRef.current,
          submittedAt,
        }
      );
    }, 280);
  };

  const selectionCount = selectedWords.length;
  const memorizeProgress = Math.max(0, memorizeRemainingMs / MEMORIZE_DURATION_MS);

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="show"
      exit="hidden"
      className="rounded-3xl-soft border border-white/10 bg-bg-card/70 p-5 backdrop-blur-xl md:p-7"
    >
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <LayoutGroup>
        <AnimatePresence mode="wait">
          {phase === "memorize" && (
            <motion.div
              key="memorize"
              variants={transitionVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
                  <span>Memorize these 5 words</span>
                  <span className="font-mono">{Math.ceil(memorizeRemainingMs / 1000)}s</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                  <motion.div
                    className="h-full origin-left bg-accent-violet"
                    style={{ scaleX: memorizeProgress }}
                    transition={{ duration: 0 }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {round.targets.map((word) => (
                  <motion.div
                    key={`memorize-${word}`}
                    layoutId={`word-${word}`}
                    className="rounded-2xl-soft border border-white/10 bg-white/5 px-4 py-4 text-center font-display text-lg text-text-primary"
                  >
                    {word}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "recall" && (
            <motion.div
              key="recall"
              variants={transitionVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl text-text-primary">Select the 5 target words</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Category context is consistent to keep memory, not obviousness, under test.
                  </p>
                </div>
                <div className="rounded-2xl-soft border border-white/10 bg-bg-elevated px-3 py-2 text-sm text-text-primary">
                  <span className="font-mono">{selectionCount}/5</span> selected
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                {round.recallWords.map((word) => {
                  const selected = selectedWords.includes(word);
                  const isTarget = round.targets.includes(word);
                  return (
                    <motion.button
                      key={`recall-${word}`}
                      layout
                      layoutId={isTarget ? `word-${word}` : undefined}
                      type="button"
                      onClick={() => toggleWordSelection(word)}
                      whileTap={{ scale: 0.96 }}
                      animate={selected ? { scale: 1.02 } : { scale: 1 }}
                      transition={springTap}
                      className={`min-h-12 rounded-2xl-soft border px-3 py-3 text-center font-display text-base transition focus-visible:outline-none focus-visible:ring-2 ${
                        selected
                          ? "border-accent-cyan bg-accent-cyan/15 text-text-primary shadow-glow-cyan focus-visible:ring-accent-cyan"
                          : "border-white/10 bg-white/5 text-text-primary hover:bg-white/10 focus-visible:ring-accent-violet"
                      }`}
                    >
                      {word}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <motion.button
                  type="button"
                  onClick={submitRecall}
                  whileTap={{ scale: 0.98 }}
                  transition={springTap}
                  disabled={selectionCount === 0}
                  className="min-h-11 rounded-2xl-soft bg-accent-cyan px-6 py-3 font-medium text-bg-base shadow-glow-cyan disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
                >
                  Submit
                </motion.button>
              </div>
            </motion.div>
          )}

          {phase === "submitted" && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="grid min-h-[220px] place-items-center"
            >
              <div className="text-center">
                <h3 className="font-display text-2xl text-text-primary">Evaluating recall…</h3>
                <p className="mt-2 text-sm text-text-secondary">Locking in your memory score.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </motion.section>
  );
}
