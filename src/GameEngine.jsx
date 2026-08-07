import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, PauseCircle, Volume2, VolumeX } from "lucide-react";
import { defogReveal, fadeIn, scaleIn, useReducedMotionVariant } from "./lib/motion";
import { trackEvent } from "./lib/analytics";
import { initializeRandomizer, selectStream } from "./lib/random";
import { normalizeScores } from "./lib/scoring";
import { DOMAINS, SCAN_MODES, estimateScanSeconds } from "./lib/domains";
import { cue, primeAudio, toggleSound } from "./lib/feedback";
import { useStore } from "./lib/storage";
import { Button, IconButton, StepDots } from "./components/ui";

import ProcessingSpeedGame from "./components/ProcessingSpeedGame";
import WorkingMemoryGame from "./components/WorkingMemoryGame";
import StroopTestGame from "./components/StroopTestGame";
import SpatialMemoryGame from "./components/SpatialMemoryGame";
import NBackGame from "./components/games/NBackGame";
import GoNoGoGame from "./components/games/GoNoGoGame";
import DigitSpanGame from "./components/games/DigitSpanGame";
import TaskSwitchGame from "./components/games/TaskSwitchGame";

/** Domain key -> game component. Adding a domain only needs an entry here. */
const GAME_COMPONENTS = {
  speed: ProcessingSpeedGame,
  memory: WorkingMemoryGame,
  stroop: StroopTestGame,
  spatial: SpatialMemoryGame,
  nback: NBackGame,
  inhibition: GoNoGoGame,
  span: DigitSpanGame,
  flex: TaskSwitchGame,
};

const COUNTDOWN = [3, 2, 1, "GO"];

class GameErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Mini-game crashed:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="glass p-6 text-center">
        <h2 className="font-display text-xl text-text-primary">This game hit an error</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          Your other results are safe. Skip this one and carry on, or restart the scan.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onSkip();
            }}
          >
            Skip this game
          </Button>
          <Button variant="secondary" onClick={this.props.onExit}>
            Exit scan
          </Button>
        </div>
      </div>
    );
  }
}

function Countdown({ onComplete, label, hint, step, total }) {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);
  const isGo = COUNTDOWN[index] === "GO";

  useEffect(() => {
    cue(isGo ? "go" : "countdown");
  }, [index, isGo]);

  useEffect(() => {
    if (index >= COUNTDOWN.length - 1) {
      const id = window.setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete();
        }
      }, 700);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setIndex((v) => v + 1), 620);
    return () => window.clearTimeout(id);
  }, [index, onComplete]);

  return (
    <section className="grid min-h-[380px] place-items-center text-center">
      <div>
        {step && total > 1 && (
          <p className="mb-2 font-mono text-xs text-text-tertiary">
            Game {step} of {total}
          </p>
        )}
        <p className="eyebrow mb-2">{label}</p>
        {hint && <p className="mb-6 max-w-xs text-sm text-text-secondary">{hint}</p>}
        <AnimatePresence mode="wait">
          <motion.div
            key={String(COUNTDOWN[index])}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.2, y: -12 }}
            transition={{ type: "spring", stiffness: 460, damping: 26 }}
            className="font-display text-8xl text-text-primary md:text-9xl"
          >
            <span className={isGo ? "text-gradient-cyan" : ""}>{COUNTDOWN[index]}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function ScanIntro({ modeConfig, domains, onStart, focusArea, variants }) {
  const seconds = estimateScanSeconds(domains);
  const minutes = Math.round(seconds / 60);

  return (
    <motion.section variants={variants} initial="hidden" animate="show" exit="hidden">
      <p className="eyebrow mb-3">{modeConfig.label}</p>
      <h1 className="font-display text-3xl leading-tight text-text-primary md:text-5xl">
        {domains.length === 1 ? DOMAINS[domains[0]].label : "Cognitive Baseline Scan"}
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-text-secondary">
        {domains.length === 1
          ? DOMAINS[domains[0]].measures
          : `A precise ${domains.length}-part measurement across ${domains
              .slice(0, 3)
              .map((key) => DOMAINS[key].short.toLowerCase())
              .join(", ")} and more. Roughly ${minutes} minute${minutes === 1 ? "" : "s"}.`}
      </p>

      {focusArea && (
        <div className="mt-6 rounded-2xl-soft border border-accent-violet/25 bg-accent-violet/[0.07] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-violet">
            Your current focus
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            {focusArea} was your weakest domain last time. This run will show whether it has moved.
          </p>
        </div>
      )}

      <ol className="mt-7 space-y-2">
        {domains.map((key, i) => {
          const domain = DOMAINS[key];
          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-2xl-soft border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mono text-xs text-text-secondary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">{domain.label}</span>
                <span className="block truncate text-xs text-text-tertiary">{domain.tagline}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">~{domain.duration}s</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 rounded-2xl-soft border border-white/[0.06] bg-white/[0.02] p-4 text-xs leading-relaxed text-text-tertiary">
        For a clean reading: sit somewhere quiet, put the phone down, and do the whole thing in one
        go. Results only mean something if the conditions are repeatable.
      </div>

      <Button
        variant="primary"
        size="lg"
        magnetic
        className="mt-7 w-full sm:w-auto"
        onClick={() => {
          primeAudio();
          onStart();
        }}
      >
        Begin {modeConfig.label}
      </Button>
    </motion.section>
  );
}

export default function GameEngine({
  mode = "practice",
  domains: domainsOverride = null,
  drillConfig = null,
  onFinish,
  onExit,
  onAbandon,
}) {
  const prefersReducedMotion = useReducedMotion();
  const profile = useStore((s) => s.profile);
  const soundOn = useStore((s) => s.prefs.sound !== false);

  const modeConfig = SCAN_MODES[mode] ?? SCAN_MODES.practice;
  const domains = useMemo(
    () => domainsOverride ?? modeConfig.domains,
    [domainsOverride, modeConfig.domains]
  );
  /** A single-domain run launched from Practice or the protocol is a drill. */
  const isDrill = (domainsOverride?.length ?? 0) === 1;

  const [phase, setPhase] = useState("intro"); // intro | countdown | playing | wrapping
  const [stepIndex, setStepIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("Scan intro");
  const [interrupted, setInterrupted] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const redoRef = useRef(null);
  const scoresRef = useRef({});
  const startedAtRef = useRef(null);
  const interruptedRef = useRef(false);

  const introVariant = useReducedMotionVariant(prefersReducedMotion, scaleIn);
  const wrapVariant = useReducedMotionVariant(prefersReducedMotion, defogReveal);

  useEffect(() => {
    initializeRandomizer(modeConfig.seeded ? "daily" : "practice");
  }, [modeConfig.seeded]);

  // Warn before an accidental refresh mid-scan wipes an unsaved run.
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  /**
   * Every game is timed against performance.now(), but browsers freeze
   * requestAnimationFrame and throttle timers in a background tab. Leaving
   * mid-game therefore both corrupts reaction times and can make the elapsed
   * check fire the moment you return. Rather than silently record a bad
   * reading, we discard the interrupted game and offer to redo it — a
   * compromised measurement is worse than no measurement.
   */
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      interruptedRef.current = true;
      setInterrupted(true);
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onHidden);
    };
  }, [phase]);

  /** Weakest domain by rolling average, used for the "focus" nudge. */
  const focusArea = useMemo(() => {
    const rated = domains
      .map((key) => ({ key, ema: profile[key]?.ema }))
      .filter((d) => typeof d.ema === "number");
    if (rated.length < domains.length || rated.length === 0) return null;
    rated.sort((a, b) => a.ema - b.ema);
    return DOMAINS[rated[0].key].label;
  }, [domains, profile]);

  const startScan = () => {
    trackEvent("scan_started", { mode, domains: domains.length });
    startedAtRef.current = performance.now();
    scoresRef.current = {};
    setStepIndex(0);
    setPhase("countdown");
  };

  const finishScan = useCallback(() => {
    const rawScores = scoresRef.current;
    const scores = normalizeScores(rawScores);
    /**
     * Report only the domains that actually produced data. Skipped and
     * interrupted games used to be counted as measured, which awarded XP for
     * them, unlocked the eight-domain "Full Spectrum" achievement for a run
     * where nothing was answered, and wrote zeroes into the profile.
     */
    const measured = domains.filter((key) => typeof scores[key] === "number");
    const durationMs = startedAtRef.current
      ? Math.round(performance.now() - startedAtRef.current)
      : null;

    trackEvent("scan_finished", { mode, composite: scores.aggregate, measured: measured.length });
    setPhase("wrapping");

    if (measured.length === 0) {
      // Nothing was measured, so there is nothing to record. Bail out rather
      // than saving an empty session that pollutes history and streaks.
      onAbandon?.();
      return;
    }
    onFinish?.({ rawScores, scores, durationMs, mode, domains: measured });
  }, [domains, mode, onAbandon, onFinish]);

  /** Advance to the next game, or finish. Shared by completion and skip. */
  const advance = useCallback(() => {
    setStepIndex((current) => {
      const next = current + 1;
      if (next >= domains.length) {
        // Defer so this state update commits before the parent swaps screens.
        window.setTimeout(finishScan, 0);
        return current;
      }
      // Every game gets its own countdown, so the timer and first stimulus are
      // never live before the player has read what the game asks of them.
      setPhase("countdown");
      return next;
    });
  }, [domains.length, finishScan]);

  const handleGameComplete = useCallback(
    (domainKey, score, metrics = {}) => {
      // An interrupted game keeps running underneath the overlay. Drop whatever
      // it reports — those timings were taken against a frozen clock.
      if (interruptedRef.current) return;

      scoresRef.current = {
        ...scoresRef.current,
        [domainKey]: { ...score, raw: { ...(score.raw ?? {}), ...metrics } },
      };
      trackEvent("game_completed", { domain: domainKey });
      advance();
    },
    [advance]
  );

  const skipCurrent = useCallback(() => {
    interruptedRef.current = false;
    setInterrupted(false);
    advance();
  }, [advance]);

  const currentDomain = domains[stepIndex];

  useEffect(() => {
    if (phase === "playing" && currentDomain) {
      setAnnouncement(
        `Game ${stepIndex + 1} of ${domains.length}: ${DOMAINS[currentDomain].label}`
      );
    }
  }, [currentDomain, domains.length, phase, stepIndex]);

  const renderGame = () => {
    const GameComponent = GAME_COMPONENTS[currentDomain];
    if (!GameComponent) return null;
    // Point the seeded generator at this game's own stream before it mounts and
    // draws its first item, so a daily puzzle is identical for everyone.
    selectStream(currentDomain, attemptKey);
    return (
      <GameComponent
        // Bumping attemptKey remounts the game, discarding an interrupted run.
        key={`${currentDomain}-${attemptKey}`}
        onComplete={handleGameComplete}
        /**
         * A scan is a measurement, so it must be the SAME test every time —
         * identical starting difficulty for every user on every run. Seeding
         * difficulty from stored history made scores non-comparable: getting
         * better raised the difficulty, which lowered the score, so improvement
         * showed up as decline. Drills are training, not measurement, so they
         * keep adapting to you.
         */
        initialDifficulty={isDrill ? profile[currentDomain]?.ema ?? 0 : 0}
        adaptive={isDrill}
        drillConfig={drillConfig}
      />
    );
  };

  const resumeAfterInterruption = () => {
    interruptedRef.current = false;
    setInterrupted(false);
    setAttemptKey((k) => k + 1);
  };

  // Move focus into the interruption dialog so keyboard and screen-reader users
  // land on it rather than on whatever was focused in the discarded game.
  useEffect(() => {
    if (interrupted) redoRef.current?.focus();
  }, [interrupted]);

  const requestExit = () => {
    const answered = Object.keys(scoresRef.current).length;
    if (phase === "playing" && answered > 0) {
      setConfirmExit(true);
      return;
    }
    onExit?.();
  };

  return (
    <div className="min-h-screen px-4 pb-24 pt-5 font-body text-text-primary md:px-8 md:pb-16 md:pt-8">
      <div className="mx-auto max-w-2xl">
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <header className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={requestExit}
            className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {phase === "intro" ? "Back" : "Exit"}
          </button>

          {phase === "playing" && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-tertiary" data-tabular>
                {stepIndex + 1}/{domains.length}
              </span>
              <StepDots total={domains.length} current={stepIndex} />
            </div>
          )}

          <IconButton
            icon={soundOn ? Volume2 : VolumeX}
            label={soundOn ? "Mute sound" : "Unmute sound"}
            active={soundOn}
            onClick={toggleSound}
          />
        </header>

        {/**
         * Leaving mid-scan used to bin every completed game without a word.
         * Offer to keep what has already been measured instead — a partial
         * report is still a real report.
         */}
        <AnimatePresence>
          {confirmExit && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="exit-title"
              className="glass-strong mb-4 p-5"
            >
              <h3 id="exit-title" className="font-display text-lg text-text-primary">
                Leave the scan?
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                You have completed {Object.keys(scoresRef.current).length} of {domains.length}{" "}
                {domains.length === 1 ? "game" : "games"}. You can save what you have measured so
                far, or discard the whole run.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setConfirmExit(false);
                    finishScan();
                  }}
                >
                  Save partial results
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmExit(false)}>
                  Keep scanning
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setConfirmExit(false);
                    onExit?.();
                  }}
                >
                  Discard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <GameErrorBoundary onSkip={skipCurrent} onExit={requestExit}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase === "playing" ? `game-${currentDomain}` : phase}
              variants={fadeIn}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              {phase === "intro" && (
                <ScanIntro
                  modeConfig={modeConfig}
                  domains={domains}
                  onStart={startScan}
                  focusArea={focusArea}
                  variants={introVariant}
                />
              )}
              {phase === "countdown" && (
                <Countdown
                  // The current game, not always the first — games 2..N used to
                  // announce game 1's name.
                  label={DOMAINS[currentDomain]?.label ?? "Get ready"}
                  hint={DOMAINS[currentDomain]?.tagline}
                  step={stepIndex + 1}
                  total={domains.length}
                  onComplete={() => setPhase("playing")}
                />
              )}
              {phase === "playing" && (
                <div className="relative">
                  {/**
                   * Unmount the game entirely while interrupted. Leaving it
                   * mounted under the overlay kept its window key handlers live
                   * and its controls in the tab order, so the "modal" could be
                   * typed straight through. The run is discarded either way.
                   */}
                  {!interrupted && renderGame()}

                  <AnimatePresence>
                    {interrupted && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="interrupted-title"
                        className="glass-strong grid min-h-[320px] place-items-center p-6 text-center"
                      >
                        <div className="max-w-sm">
                          <PauseCircle
                            className="mx-auto h-8 w-8 text-accent-amber"
                            aria-hidden="true"
                          />
                          <h3
                            id="interrupted-title"
                            className="mt-4 font-display text-xl text-text-primary"
                          >
                            This reading was interrupted
                          </h3>
                          <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
                            Your browser pauses timers in a background tab, so anything measured
                            while you were away would be wrong. We have discarded this game rather
                            than score it badly.
                          </p>
                          <Button
                            ref={redoRef}
                            variant="primary"
                            size="md"
                            className="mt-5"
                            onClick={resumeAfterInterruption}
                          >
                            Redo {DOMAINS[currentDomain]?.short ?? "this game"}
                          </Button>
                          <button
                            type="button"
                            onClick={skipCurrent}
                            className="mt-3 block w-full text-xs text-text-tertiary transition-colors hover:text-text-secondary"
                          >
                            Skip it instead
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {phase === "wrapping" && (
                <motion.div
                  variants={wrapVariant}
                  initial="hidden"
                  animate="show"
                  className="grid min-h-[320px] place-items-center text-center"
                >
                  <div>
                    <div className="mx-auto mb-5 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-accent-cyan" />
                    <h2 className="font-display text-2xl text-text-primary">Building your report</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Scoring every trial and comparing against your history.
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </GameErrorBoundary>
      </div>
    </div>
  );
}
