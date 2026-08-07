import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { getRandom } from "../lib/random";
import { cue } from "../lib/feedback";
import GameShell from "./games/GameShell";

/**
 * Corsi-style spatial span on a 5x5 grid.
 *
 * Cells light up, you memorise the pattern, then rebuild it. Each level adds a
 * cell, and the memorisation window shrinks slightly as the load rises so the
 * task keeps measuring encoding capacity rather than rehearsal time.
 */

const GRID_SIZE = 25;
const INITIAL_LIT = 4;
const MAX_LEVELS = 12;
const BASE_MEMORIZE_MS = 2800;

/** Slightly more time per extra cell, but less per cell overall. */
const memorizeMsFor = (level) => BASE_MEMORIZE_MS + (level - 1) * 240;

export default function SpatialMemoryGame({
  onComplete,
  variants,
  initialDifficulty = 0,
  adaptive = false,
}) {
  const prefersReducedMotion = useReducedMotion();
  /**
   * The score is a pure function of the level reached, so starting higher used
   * to hand out free points: a user who began at level 3 and failed instantly
   * still scored 25, while a level-1 starter who failed instantly scored 14.
   * A scan therefore always begins at level 1; only drills skip ahead.
   */
  const startLevel = adaptive ? (initialDifficulty > 68 ? 3 : initialDifficulty > 45 ? 2 : 1) : 1;

  const [level, setLevel] = useState(startLevel);
  const [phase, setPhase] = useState("memorize");
  const [targetCells, setTargetCells] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [wrongCell, setWrongCell] = useState(null);
  const [levelCleared, setLevelCleared] = useState(false);
  const [remainingMs, setRemainingMs] = useState(memorizeMsFor(startLevel));
  const [liveMessage, setLiveMessage] = useState("Memorise the lit cells.");

  const totalCorrectRef = useRef(0);
  const finishedRef = useRef(false);
  const recallStartRef = useRef(0);
  const startedAtRef = useRef(performance.now());
  const encodeMsRef = useRef([]);
  const timersRef = useRef([]);
  const rafRef = useRef(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const finishGame = useCallback(
    (reached, failedRound) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearTimers();

      const cellsShown = encodeMsRef.current.reduce((sum, e) => sum + e.cells, 0);
      const msShown = encodeMsRef.current.reduce((sum, e) => sum + e.ms, 0);

      onComplete(
        "spatial",
        { levelReached: reached },
        {
          levelReached: reached,
          totalCellsCorrect: totalCorrectRef.current,
          failedRound,
          perfect: reached >= MAX_LEVELS,
          encodeMsPerCell: cellsShown ? Math.round(msShown / cellsShown) : null,
          durationMs: Math.round(performance.now() - startedAtRef.current),
        }
      );
    },
    [clearTimers, onComplete]
  );

  /* Start each level: pick cells, show them, then open recall. */
  useEffect(() => {
    if (finishedRef.current) return undefined;

    const numToLight = INITIAL_LIT + (level - 1);
    const targets = [];
    while (targets.length < numToLight) {
      const candidate = Math.floor(getRandom() * GRID_SIZE);
      if (!targets.includes(candidate)) targets.push(candidate);
    }

    const windowMs = memorizeMsFor(level);
    encodeMsRef.current.push({ cells: numToLight, ms: windowMs });

    setTargetCells(targets);
    setSelectedCells([]);
    setWrongCell(null);
    setLevelCleared(false);
    setPhase("memorize");
    setRemainingMs(windowMs);
    setLiveMessage(`Level ${level}. Memorise ${numToLight} cells.`);
    cue("tick");

    const startedAt = performance.now();
    const tick = () => {
      const left = Math.max(0, windowMs - (performance.now() - startedAt));
      setRemainingMs(left);
      if (left > 0) rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    const id = window.setTimeout(() => {
      setPhase("recall");
      recallStartRef.current = performance.now();
      setLiveMessage("Now select the cells you saw.");
    }, windowMs);
    timersRef.current.push(id);

    return () => {
      window.clearTimeout(id);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [level]);

  const handleCellClick = (index) => {
    if (phase !== "recall" || selectedCells.includes(index)) return;

    if (targetCells.includes(index)) {
      const nextSelected = [...selectedCells, index];
      setSelectedCells(nextSelected);
      totalCorrectRef.current += 1;
      cue("tap");

      if (nextSelected.length === targetCells.length) {
        setLevelCleared(true);
        cue("levelUp");
        setLiveMessage(`Level ${level} cleared.`);
        if (level >= MAX_LEVELS) {
          setPhase("success");
          timersRef.current.push(window.setTimeout(() => finishGame(level, null), 1200));
        } else {
          // Lock the grid immediately. The cells used to stay live through the
          // 900ms celebration, so one overshooting tap — routine on a phone —
          // registered as a wrong answer and ended the entire run, scoring it
          // as a failure at the level the player had just cleared.
          setPhase("cleared");
          timersRef.current.push(window.setTimeout(() => setLevel((l) => l + 1), 900));
        }
      }
    } else {
      setWrongCell(index);
      setPhase("fail");
      cue("fail");
      setLiveMessage(`Incorrect. You reached level ${level}.`);
      timersRef.current.push(window.setTimeout(() => finishGame(level, level), 1300));
    }
  };

  const memorizeProgress = phase === "memorize" ? remainingMs / memorizeMsFor(level) : 1;

  return (
    <GameShell
      title="Spatial Memory · Pattern Span"
      subtitle={
        phase === "memorize"
          ? "Memorise the lit cells"
          : phase === "recall"
          ? "Rebuild the pattern"
          : phase === "cleared"
          ? "Level cleared — next pattern coming"
          : phase === "fail"
          ? "Scan complete"
          : "Perfect run"
      }
      accent="emerald"
      progress={phase === "memorize" ? memorizeProgress : level / MAX_LEVELS}
      timerLabel={
        phase === "memorize" ? `${(remainingMs / 1000).toFixed(1)}s` : `Level ${level}/${MAX_LEVELS}`
      }
      liveMessage={liveMessage}
      stats={[
        { label: "Span", value: INITIAL_LIT + (level - 1) },
        { label: "Found", value: `${selectedCells.length}/${targetCells.length}` },
      ]}
      className={variants ? "" : ""}
    >
      <div className="flex flex-col items-center">
        <motion.div
          animate={
            phase === "fail" && !prefersReducedMotion
              ? { x: [-9, 9, -7, 7, 0], transition: { duration: 0.38 } }
              : levelCleared && !prefersReducedMotion
              ? { scale: [1, 1.03, 1], transition: { duration: 0.3 } }
              : {}
          }
          className="relative grid grid-cols-5 gap-2 overflow-hidden rounded-3xl-soft border border-white/[0.07] bg-white/[0.02] p-3 md:gap-2.5 md:p-4"
        >
          <AnimatePresence>
            {phase === "fail" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.22 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 rounded-3xl-soft bg-danger"
              />
            )}
            {phase === "success" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 rounded-3xl-soft bg-success"
              />
            )}
          </AnimatePresence>

          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isTarget = targetCells.includes(i);
            const isSelected = selectedCells.includes(i);
            const isLit = phase === "memorize" && isTarget;
            const isWrong = wrongCell === i;
            // Reveal what was missed once the run ends — feedback teaches.
            const isMissed = phase === "fail" && isTarget && !isSelected;

            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => handleCellClick(i)}
                whileTap={phase === "recall" && !isSelected ? { scale: 0.9 } : undefined}
                animate={
                  isLit && !prefersReducedMotion
                    ? { opacity: [0.85, 1, 0.85], scale: [1, 1.03, 1] }
                    : { opacity: 1, scale: 1 }
                }
                transition={isLit ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.15 }}
                /**
                 * aria-disabled rather than disabled: a real `disabled` on the
                 * cell you just activated removes it from the tab order while
                 * it still holds focus, so the browser drops focus to <body>
                 * and a keyboard user restarts the tab order mid-trial. The
                 * click guard in handleCellClick does the actual blocking.
                 */
                aria-disabled={phase !== "recall" || isSelected}
                aria-label={`Grid cell ${i + 1}${isSelected ? ", selected" : ""}`}
                className={`h-[3.1rem] w-[3.1rem] rounded-xl-soft border transition-colors duration-150 sm:h-14 sm:w-14 md:h-16 md:w-16 ${
                  isLit
                    ? "border-accent-emerald bg-accent-emerald shadow-glow-emerald"
                    : isWrong
                    ? "border-danger bg-danger/70"
                    : isMissed
                    ? "border-accent-emerald/60 bg-accent-emerald/25"
                    : isSelected
                    ? "border-accent-cyan bg-accent-cyan/75"
                    : "border-white/[0.06] bg-white/[0.03] hover:border-white/20"
                }`}
              />
            );
          })}
        </motion.div>

        <div className="mt-4 flex h-6 items-center gap-2">
          <AnimatePresence>
            {levelCleared && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex items-center gap-1.5 text-sm text-success"
              >
                <Check className="h-4 w-4" />
                Level cleared
              </motion.div>
            )}
          </AnimatePresence>
          {phase === "fail" && (
            <span className="text-sm text-text-secondary">Missed cells shown in green</span>
          )}
        </div>
      </div>
    </GameShell>
  );
}
