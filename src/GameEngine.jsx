import { Component, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  defogReveal,
  fadeIn,
  fadeInUp,
  scaleIn,
  springTap,
  useReducedMotionVariant,
} from "./lib/motion";
import { trackEvent } from "./lib/analytics";
import { GAME_ACTIONS, GAME_PHASES, GameProvider, useGame } from "./context/GameContext";
import ProcessingSpeedGame from "./components/ProcessingSpeedGame";
import WorkingMemoryGame from "./components/WorkingMemoryGame";
import StroopTestGame from "./components/StroopTestGame";
import SpatialMemoryGame from "./components/SpatialMemoryGame";
import ResultsDashboard from "./components/ResultsDashboard";
import { initializeRandomizer } from "./lib/random";

const SEQUENCE = [3, 2, 1, "GO!"];
const GAME_STEPS = [
  GAME_PHASES.PROCESSING_SPEED,
  GAME_PHASES.WORKING_MEMORY,
  GAME_PHASES.STROOP_TEST,
  GAME_PHASES.SPATIAL_MEMORY,
];

const PHASE_ANNOUNCEMENTS = {
  [GAME_PHASES.INTRO]: "Baseline Brain Scan intro",
  [GAME_PHASES.COUNTDOWN]: "Get ready. Countdown starting.",
  [GAME_PHASES.PROCESSING_SPEED]: "Game 1 of 4: Processing Speed",
  [GAME_PHASES.WORKING_MEMORY]: "Game 2 of 4: Working Memory",
  [GAME_PHASES.STROOP_TEST]: "Game 3 of 4: Interference Control",
  [GAME_PHASES.SPATIAL_MEMORY]: "Game 4 of 4: Spatial Memory",
  [GAME_PHASES.RESULTS]: "Scan complete. Results ready.",
};

class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Surface a clear log so game-level crashes remain debuggable.
    // eslint-disable-next-line no-console
    console.error("Mini-game crashed in GameEngine boundary:", error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    const { hasError } = this.state;
    const { children, onReset } = this.props;
    if (!hasError) return children;

    return (
      <div className="rounded-3xl-soft border border-white/10 bg-bg-elevated/80 p-6 text-center">
        <h2 className="font-display text-xl text-text-primary">Game paused due to an error</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This scan is still safe to retry. Reset and continue.
        </p>
        <button
          type="button"
          onClick={() => {
            this.reset();
            onReset();
          }}
          className="mt-4 min-h-11 rounded-2xl-soft bg-accent-cyan px-5 py-2 font-medium text-bg-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        >
          Reset Scan
        </button>
      </div>
    );
  }
}

const IntroPanel = ({ onStart, variants }) => (
  <motion.section variants={variants} initial="hidden" animate="show" exit="hidden" className="space-y-6">
    <h1 className="font-display text-4xl text-text-primary md:text-5xl">Baseline Brain Scan</h1>
    <p className="max-w-xl text-text-secondary">
      Run a precise 4-step check across processing speed, working memory, interference control, and spatial
      load.
    </p>
    <button
      type="button"
      onClick={onStart}
      className="min-h-11 rounded-2xl-soft bg-accent-cyan px-6 py-3 font-medium text-bg-base shadow-glow-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
    >
      Begin 4-Minute Scan
    </button>
  </motion.section>
);

const Countdown = ({ onComplete }) => {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const completedRef = useRef(false);
  const isGo = SEQUENCE[index] === "GO!";

  const numberVariant = {
    initial: { opacity: 0, scale: 0.7, y: 10 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: "spring", stiffness: 460, damping: 26 },
    },
    exit: {
      opacity: 0,
      scale: 1.18,
      y: -10,
      transition: { duration: 0.18, ease: "easeOut" },
    },
  };

  const reducedGo = useReducedMotionVariant(prefersReducedMotion, defogReveal, fadeIn);
  const goVariant = {
    initial: reducedGo.hidden,
    animate: reducedGo.show,
    exit: {
      opacity: 0,
      scale: 1.06,
      transition: { duration: 0.18, ease: "easeOut" },
    },
  };

  useEffect(() => {
    if (index >= SEQUENCE.length - 1) {
      const doneTimeout = window.setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }, 760);
      return () => window.clearTimeout(doneTimeout);
    }
    const timeout = window.setTimeout(() => setIndex((value) => value + 1), 520);
    return () => window.clearTimeout(timeout);
  }, [index, onComplete]);

  return (
    <section className="grid min-h-[280px] place-items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={SEQUENCE[index]}
          variants={isGo ? goVariant : numberVariant}
          initial="initial"
          animate="animate"
          exit="exit"
          className="font-display text-7xl text-text-primary md:text-8xl"
        >
          <span
            className={
              isGo ? "bg-gradient-to-r from-accent-cyan to-accent-violet bg-clip-text text-transparent" : ""
            }
          >
            {SEQUENCE[index]}
          </span>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

// SpatialMemoryGame imported from components

const ProgressIndicator = ({ phase }) => {
  const activeIndex = GAME_STEPS.indexOf(phase);
  const completedCount = phase === GAME_PHASES.RESULTS ? GAME_STEPS.length : Math.max(0, activeIndex + 1);

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
        <span>Baseline Scan Progress</span>
        <span className="font-mono">
          {completedCount} / {GAME_STEPS.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {GAME_STEPS.map((step, index) => {
          const complete = activeIndex > index || phase === GAME_PHASES.RESULTS;
          const active = activeIndex === index;
          return (
            <div
              key={step}
              className={`h-1.5 rounded-full transition ${
                complete ? "bg-accent-cyan shadow-glow-cyan" : active ? "bg-accent-violet shadow-glow-violet" : "bg-bg-elevated"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

// ResultsPanel replaced by ResultsDashboard

const GameEngineInner = ({ onResetToLanding, onViewHistory }) => {
  const { state, dispatch } = useGame();
  const prefersReducedMotion = useReducedMotion();
  const [announcement, setAnnouncement] = useState(PHASE_ANNOUNCEMENTS[GAME_PHASES.INTRO]);
  const phaseStartRef = useRef({});
  const phaseEndRef = useRef({});
  const previousPhaseRef = useRef(state.phase);

  const panelVariant = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const introVariant = useReducedMotionVariant(prefersReducedMotion, scaleIn);

  useEffect(() => {
    const now = performance.now();
    if (!phaseStartRef.current[state.phase]) {
      phaseStartRef.current[state.phase] = now;
    }

    const previous = previousPhaseRef.current;
    if (previous !== state.phase && !phaseEndRef.current[previous]) {
      phaseEndRef.current[previous] = now;
    }
    if (state.phase === GAME_PHASES.RESULTS && previous !== GAME_PHASES.RESULTS) {
      trackEvent("scan_finished", { finalScores: state.scores });
    }

    previousPhaseRef.current = state.phase;
    setAnnouncement(PHASE_ANNOUNCEMENTS[state.phase]);
  }, [state.phase, state.scores]);

  const startScan = () => {
    trackEvent("scan_started");
    const startedAt = performance.now();
    dispatch({
      type: GAME_ACTIONS.START_SCAN,
      payload: { startedAt },
    });
  };

  const onCountdownComplete = () => {
    dispatch({ type: GAME_ACTIONS.COUNTDOWN_COMPLETE });
  };

  /**
   * Records the completed game payload, then advances to the next phase.
   * The reducer decides whether we move to the next game or to final results.
   */
  const handleGameComplete = (gameName, score, metrics = {}) => {
    const completedAt = performance.now();
    const phaseStartedAt = phaseStartRef.current[gameName] ?? completedAt;
    const phaseElapsedMs = Math.round(completedAt - phaseStartedAt);

    phaseEndRef.current[gameName] = completedAt;
    
    trackEvent("game_completed", { gameName, score });

    dispatch({
      type: GAME_ACTIONS.GAME_COMPLETE,
      payload: {
        gameName,
        score: {
          ...score,
          raw: {
            ...(score.raw ?? {}),
            ...metrics,
            phaseElapsedMs,
            completedAt,
          },
        },
      },
    });
  };

  const resetScan = () => {
    phaseStartRef.current = {};
    phaseEndRef.current = {};
    previousPhaseRef.current = GAME_PHASES.INTRO;
    dispatch({ type: GAME_ACTIONS.RESET });
  };

  let renderedPhase;
  if (state.phase === GAME_PHASES.INTRO) {
    renderedPhase = <IntroPanel onStart={startScan} variants={introVariant} />;
  } else if (state.phase === GAME_PHASES.COUNTDOWN) {
    renderedPhase = <Countdown onComplete={onCountdownComplete} />;
  } else if (state.phase === GAME_PHASES.PROCESSING_SPEED) {
    renderedPhase = (
      <ProcessingSpeedGame
        onComplete={(gameName, score, metrics) => {
          if (gameName !== "speed") {
            throw new Error(`ProcessingSpeedGame returned unexpected gameName: ${gameName}`);
          }
          handleGameComplete(GAME_PHASES.PROCESSING_SPEED, score, metrics);
        }}
      />
    );
  } else if (state.phase === GAME_PHASES.WORKING_MEMORY) {
    renderedPhase = (
      <WorkingMemoryGame
        onComplete={(gameName, score, metrics) => {
          if (gameName !== "memory") {
            throw new Error(`WorkingMemoryGame returned unexpected gameName: ${gameName}`);
          }
          handleGameComplete(GAME_PHASES.WORKING_MEMORY, score, metrics);
        }}
      />
    );
  } else if (state.phase === GAME_PHASES.STROOP_TEST) {
    renderedPhase = (
      <StroopTestGame
        onComplete={(gameName, score, metrics) => {
          if (gameName !== "stroop") {
            throw new Error(`StroopTestGame returned unexpected gameName: ${gameName}`);
          }
          handleGameComplete(GAME_PHASES.STROOP_TEST, score, metrics);
        }}
      />
    );
  } else if (state.phase === GAME_PHASES.SPATIAL_MEMORY) {
    renderedPhase = (
      <SpatialMemoryGame
        variants={panelVariant}
        onComplete={(gameName, score, metrics) => {
          if (gameName !== "spatial") {
            throw new Error(`SpatialMemoryGame returned unexpected gameName: ${gameName}`);
          }
          handleGameComplete(GAME_PHASES.SPATIAL_MEMORY, score.score, score.metrics);
        }}
      />
    );
  } else {
    renderedPhase = (
      <ResultsDashboard
        rawScores={state.scores}
        onReset={onResetToLanding}
        onViewHistory={onViewHistory}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-base px-5 py-8 font-body text-text-primary md:px-8">
      <div className="mx-auto max-w-3xl">
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <ProgressIndicator phase={state.phase} />

        <GameErrorBoundary onReset={resetScan}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={state.phase} variants={fadeIn} initial="hidden" animate="show" exit="hidden">
              {renderedPhase}
            </motion.div>
          </AnimatePresence>
        </GameErrorBoundary>
      </div>
    </div>
  );
};

export default function GameEngine({ mode, onResetToLanding, onViewHistory }) {
  useEffect(() => {
    initializeRandomizer(mode);
  }, [mode]);

  return (
    <GameProvider>
      <GameEngineInner onResetToLanding={onResetToLanding} onViewHistory={onViewHistory} />
    </GameProvider>
  );
}
