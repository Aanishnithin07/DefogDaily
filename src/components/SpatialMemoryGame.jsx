import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { springTap } from "../lib/motion";
import { getRandom, shuffleArray } from "../lib/random";

const GRID_SIZE = 25; // 5x5
const INITIAL_LIT = 4;
const MAX_LEVELS = 12;
const MEMORIZE_MS = 3000;

export default function SpatialMemoryGame({ onComplete, variants, initialDifficulty = 0 }) {
  const [level, setLevel] = useState(initialDifficulty > 60 ? 3 : 1);
  const [phase, setPhase] = useState("memorize"); // memorize, recall, fail, success
  const [targetCells, setTargetCells] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [levelCleared, setLevelCleared] = useState(false);
  const totalCorrectRef = useRef(0);

  const startLevel = (currentLevel) => {
    const numToLight = INITIAL_LIT + (currentLevel - 1);
    
    let newTargets = [];
    while (newTargets.length < numToLight) {
      const rand = Math.floor(getRandom() * GRID_SIZE);
      if (!newTargets.includes(rand)) {
        newTargets.push(rand);
      }
    }
    
    setTargetCells(newTargets);
    setSelectedCells([]);
    setLevelCleared(false);
    setPhase("memorize");

    const timer = setTimeout(() => {
      setPhase("recall");
    }, MEMORIZE_MS);

    return () => clearTimeout(timer);
  };

  // Start the first level on mount
  useEffect(() => {
    return startLevel(level);
  }, [level]);

  const handleCellClick = (index) => {
    if (phase !== "recall") return;
    if (selectedCells.includes(index)) return;

    if (targetCells.includes(index)) {
      // Correct pick
      const newSelected = [...selectedCells, index];
      setSelectedCells(newSelected);
      totalCorrectRef.current += 1;

      if (newSelected.length === targetCells.length) {
        // Level cleared!
        setLevelCleared(true);
        if (level >= MAX_LEVELS) {
          setPhase("success");
          setTimeout(() => finishGame(level, "completed all rounds"), 1200);
        } else {
          setTimeout(() => setLevel((l) => l + 1), 1000);
        }
      }
    } else {
      // Wrong pick
      setPhase("fail");
      setTimeout(() => finishGame(level, level), 1200);
    }
  };

  const finishGame = (reached, failedRound) => {
    onComplete("spatial", {
      score: {
        levelReached: reached,
      },
      metrics: {
        totalCellsCorrect: totalCorrectRef.current,
        failedRound: failedRound,
      }
    });
  };

  return (
    <motion.section
      variants={variants}
      initial="hidden"
      animate="show"
      exit="hidden"
      className="flex flex-col items-center w-full max-w-md mx-auto"
    >
      <div className="mb-6 flex flex-col items-center">
        <h2 className="font-display text-2xl text-text-primary">Spatial Memory</h2>
        <div className="mt-2 flex items-center h-8">
          <span className="font-mono text-lg text-text-secondary">Level {level} / {MAX_LEVELS}</span>
          <AnimatePresence>
            {levelCleared && (
              <motion.div
                initial={{ opacity: 0, scale: 0, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 8 }}
                exit={{ opacity: 0, scale: 0 }}
                className="text-success"
              >
                <Check className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-1 text-sm text-text-secondary h-5">
          {phase === "memorize" && "Memorize the pattern..."}
          {phase === "recall" && "Recall the lit cells"}
          {phase === "fail" && "Incorrect. Scan complete."}
          {phase === "success" && "Perfect run! Scan complete."}
        </p>
      </div>

      <motion.div
        animate={
          phase === "fail"
            ? { x: [-10, 10, -10, 10, 0], transition: { duration: 0.4 } }
            : levelCleared
            ? { scale: [1, 1.05, 1], transition: { duration: 0.3 } }
            : {}
        }
        className={`grid grid-cols-5 gap-2 md:gap-3 p-4 rounded-3xl-soft border border-white/10 bg-bg-card/70 backdrop-blur-xl relative overflow-hidden`}
      >
        {/* Red flash overlay on fail */}
        <AnimatePresence>
          {phase === "fail" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-danger pointer-events-none rounded-3xl-soft"
            />
          )}
        </AnimatePresence>

        {Array.from({ length: GRID_SIZE }).map((_, i) => {
          const isTarget = targetCells.includes(i);
          const isSelected = selectedCells.includes(i);
          const isLit = phase === "memorize" && isTarget;
          
          // Alternate cyan and violet for lit cells
          const isCyan = isTarget && targetCells.indexOf(i) % 2 === 0;
          
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => handleCellClick(i)}
              whileTap={phase === "recall" && !isSelected ? { scale: 0.9 } : {}}
              className={`
                h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-2xl-soft border transition-colors duration-200
                ${
                  isLit
                    ? isCyan
                      ? "bg-accent-cyan border-accent-cyan shadow-glow-cyan"
                      : "bg-accent-violet border-accent-violet shadow-glow-violet"
                    : isSelected
                    ? isCyan
                      ? "bg-accent-cyan/80 border-accent-cyan/80"
                      : "bg-accent-violet/80 border-accent-violet/80"
                    : "bg-bg-elevated border-white/5 hover:border-white/20 @media(hover:hover):hover:bg-white/5"
                }
              `}
              // We simulate the glowing pulse while lit
              animate={
                isLit
                  ? {
                      opacity: [0.8, 1, 0.8],
                      scale: [1, 1.02 + (level * 0.01), 1],
                    }
                  : {}
              }
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              disabled={phase !== "recall" || isSelected}
              aria-label={`Grid cell ${i}`}
            />
          );
        })}
      </motion.div>
    </motion.section>
  );
}
