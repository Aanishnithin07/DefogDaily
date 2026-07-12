import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { animate, motion, useMotionValue, useReducedMotion, AnimatePresence } from "framer-motion";
import { Share2, Zap, Brain, Grid3X3, Copy } from "lucide-react";
import confetti from "canvas-confetti";
import { trackEvent } from "../lib/analytics";
import { normalizeScores } from "../lib/scoring";
import { defogReveal, fadeInUp, staggerContainer, useReducedMotionVariant } from "../lib/motion";

const RadarChart = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.RadarChart }))
);
const PolarGrid = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.PolarGrid }))
);
const PolarAngleAxis = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.PolarAngleAxis }))
);
const Radar = lazy(() => import("recharts").then((mod) => ({ default: mod.Radar })));
const ResponsiveContainer = lazy(() =>
  import("recharts").then((mod) => ({ default: mod.ResponsiveContainer }))
);

const ChartPlaceholder = () => (
  <div className="h-64 w-full animate-pulse rounded-full bg-white/5 md:h-80" />
);

const DomainCard = ({ title, score, icon: Icon, tier, variants }) => (
  <motion.div
    variants={variants}
    className="flex flex-col items-center rounded-3xl-soft border border-white/10 bg-bg-card/70 p-5 backdrop-blur-xl transition hover:shadow-glow-cyan"
  >
    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl-soft bg-bg-elevated shadow-glow-cyan">
      <Icon className="h-5 w-5 text-accent-cyan" aria-hidden="true" />
    </div>
    <span className="font-display text-sm text-text-secondary">{title}</span>
    <span className="mt-1 font-mono text-3xl text-text-primary">{score}</span>
    <span className="mt-1 text-xs text-text-secondary">{tier}</span>
  </motion.div>
);

export default function ResultsDashboard({ rawScores, onReset }) {
  const prefersReducedMotion = useReducedMotion();
  const scores = useMemo(() => normalizeScores(rawScores), [rawScores]);
  const [toast, setToast] = useState("");

  // Big score counter
  const scoreValue = useMotionValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const controls = animate(scoreValue, scores.aggregate, {
      duration: prefersReducedMotion ? 0 : 2,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayScore(Math.round(latest)),
    });
    return () => controls.stop();
  }, [scores.aggregate, scoreValue, prefersReducedMotion]);

  const defog = useReducedMotionVariant(prefersReducedMotion, defogReveal);
  const up = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const stagger = useMemo(() => staggerContainer(0.15, 0.4), []);

  const getTier = (score) => {
    // MOCK percentiles/tiers, pending real population data
    if (score >= 90) return "Top 10%";
    if (score >= 70) return "Above Avg";
    if (score >= 50) return "Average";
    return "Below Avg";
  };

  const chartData = [
    { subject: "Speed", A: scores.speed, fullMark: 100 },
    { subject: "Memory", A: scores.memory, fullMark: 100 },
    { subject: "Spatial", A: scores.spatial, fullMark: 100 },
  ];

  const handleShare = async () => {
    trackEvent("share_clicked");
    const text = `DefogDaily Baseline 🧠 | Overall: ${scores.aggregate}\n⚡️ Speed: ${scores.speed} | 🧩 Memory: ${scores.memory} | 🗺️ Spatial: ${scores.spatial}\nClear your fog at defogdaily.com`;

    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#3ED9D5", "#8A7BFF", "#F5F8FF"],
      disableForReducedMotion: true,
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My DefogDaily Scan",
          text: text,
        });
        return;
      } catch (e) {
        // Fallback to clipboard if user cancels or it fails
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied! Paste it anywhere.");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <motion.section
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto flex w-full max-w-4xl flex-col items-center pb-12"
    >
      {/* SVG filter for the radar neon glow */}
      <svg width="0" height="0">
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      <div className="text-center">
        <motion.h2 variants={up} className="font-display text-2xl text-text-secondary">
          Memory Wellness Score
        </motion.h2>
        <motion.div
          variants={defog}
          className="mt-2 font-mono text-8xl md:text-9xl bg-gradient-to-r from-accent-cyan to-accent-violet bg-clip-text text-transparent"
        >
          {displayScore}
        </motion.div>
      </div>

      <motion.div variants={up} className="mt-10 h-64 w-full md:h-80">
        <Suspense fallback={<ChartPlaceholder />}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#9AA7C2", fontSize: 12, fontFamily: "Inter" }}
              />
              <Radar
                name="Score"
                dataKey="A"
                stroke="#3ED9D5"
                strokeWidth={3}
                fill="#3ED9D5"
                fillOpacity={0.2}
                style={{ filter: "url(#neon-glow)" }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Suspense>
      </motion.div>

      <div className="mt-10 grid w-full grid-cols-3 gap-3 md:gap-6">
        <DomainCard
          title="Speed"
          score={scores.speed}
          icon={Zap}
          tier={getTier(scores.speed)}
          variants={up}
        />
        <DomainCard
          title="Memory"
          score={scores.memory}
          icon={Brain}
          tier={getTier(scores.memory)}
          variants={up}
        />
        <DomainCard
          title="Spatial"
          score={scores.spatial}
          icon={Grid3X3}
          tier={getTier(scores.spatial)}
          variants={up}
        />
      </div>

      <motion.div variants={up} className="mt-12 flex flex-col items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={handleShare}
            className="flex min-h-12 items-center gap-2 rounded-2xl-soft bg-accent-violet px-8 font-medium text-bg-base shadow-glow-violet transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
          >
            <Share2 className="h-5 w-5" />
            Share My Brain Stats
          </button>
          
          {/* Toast Notification */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-bg-elevated px-4 py-2 text-sm text-text-primary shadow-lg border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-accent-cyan" />
                  {toast}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => trackEvent("cta_clicked", { location: "results" })}
          className="mt-2 text-sm text-text-secondary transition hover:text-text-primary"
        >
          Create Free Account to Save Your Progress
        </button>
        
        <button
          type="button"
          onClick={onReset}
          className="mt-6 min-h-11 rounded-2xl-soft border border-white/15 px-5 py-2 text-xs text-text-primary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        >
          Start New Scan
        </button>
      </motion.div>
    </motion.section>
  );
}
