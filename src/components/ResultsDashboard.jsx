import { Suspense, lazy, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as htmlToImage from "html-to-image";
import confetti from "canvas-confetti";
import {
  ArrowRight,
  Award,
  FileText,
  Flame,
  Home,
  RotateCcw,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { trackEvent } from "../lib/analytics";
import { defogReveal, fadeInUp, staggerContainer, useReducedMotionVariant } from "../lib/motion";
import { ordinal } from "../lib/norms";
import { ACHIEVEMENT_MAP } from "../lib/achievements";
import { cue } from "../lib/feedback";
import { Button, Card, CountUp, Meter, Pill, ScoreRing, accentOf, useToast } from "./ui";
import { iconFor } from "./ui/icons";

const DomainRadar = lazy(() => import("./charts/DomainRadar"));

/**
 * The reveal. This screen has one job: land the number, then hand you straight
 * to the report that explains it. Everything diagnostic lives in ReportScreen —
 * this is the moment, not the analysis.
 */
export default function ResultsDashboard({
  report,
  result,
  sessionMeta,
  onViewReport,
  onStartPlan,
  onRescan,
  onHome,
}) {
  const prefersReducedMotion = useReducedMotion();
  const toast = useToast();
  const snapshotRef = useRef(null);
  const firedRef = useRef(false);

  const defog = useReducedMotionVariant(prefersReducedMotion, defogReveal);
  const up = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const stagger = useMemo(() => staggerContainer(0.12, 0.35), []);

  const composite = report?.index?.index ?? result?.scores?.aggregate ?? 0;
  const percentile = report?.index?.percentile ?? 50;

  const radarData = useMemo(
    () => (report?.domains ?? []).map((d) => ({ label: d.short, value: d.score })),
    [report]
  );

  const newAchievements = sessionMeta?.newAchievements ?? [];

  // Celebrate once, scaled to how well the run actually went.
  useEffect(() => {
    if (firedRef.current || prefersReducedMotion) return;
    firedRef.current = true;
    const delay = window.setTimeout(() => {
      cue("reveal");
      confetti({
        particleCount: percentile > 80 ? 130 : 70,
        spread: percentile > 80 ? 92 : 62,
        origin: { y: 0.42 },
        colors: ["#3ED9D5", "#8A7BFF", "#F5F8FF", "#3DDC97"],
        disableForReducedMotion: true,
      });
    }, 900);
    return () => window.clearTimeout(delay);
  }, [percentile, prefersReducedMotion]);

  useEffect(() => {
    if (newAchievements.length > 0) {
      const id = window.setTimeout(() => cue("achievement"), 1800);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [newAchievements.length]);

  const handleShare = async () => {
    trackEvent("share_clicked");
    const domainText = (report?.domains ?? [])
      .slice(0, 4)
      .map((d) => `${d.short} ${d.score}`)
      .join(" · ");
    const text = `DefogDaily · Cognitive Index ${composite} (${ordinal(percentile)} percentile)\n${domainText}\nFree cognitive testing and training at defogdaily.com`;

    let dataUrl = null;
    let file = null;
    try {
      if (snapshotRef.current) {
        dataUrl = await htmlToImage.toPng(snapshotRef.current, {
          backgroundColor: "#0B0E14",
          pixelRatio: 2,
        });
        const blob = await (await fetch(dataUrl)).blob();
        file = new File([blob], "defogdaily-scan.png", { type: "image/png" });
      }
    } catch (error) {
      console.error("Snapshot failed", error);
    }

    if (navigator.share && file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "My DefogDaily scan", text, files: [file] });
        return;
      } catch {
        // User cancelled — fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = "defogdaily-scan.png";
        link.href = dataUrl;
        link.click();
        toast.show("Image saved and stats copied");
      } else {
        toast.show("Stats copied to clipboard");
      }
    } catch {
      toast.show("Could not copy — try the screenshot instead");
    }
  };

  return (
    <motion.section
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-6 md:pb-16"
    >
      {/* Snapshot region — what gets captured for sharing. */}
      <div ref={snapshotRef} className="rounded-3xl-soft bg-bg-base/40 px-1 py-6">
        <div className="flex flex-col items-center text-center">
          <motion.p variants={up} className="eyebrow mb-4">
            {sessionMeta?.modeLabel ?? "Scan complete"}
          </motion.p>

          <motion.div variants={defog}>
            <ScoreRing value={percentile} size={224} stroke={12} accent="cyan" label="Cognitive index">
              <div className="text-center">
                <div className="font-mono text-6xl leading-none text-gradient-cyan md:text-7xl">
                  <CountUp value={composite} duration={prefersReducedMotion ? 0 : 1.9} />
                </div>
                <div className="mt-2 text-xs uppercase tracking-widest2 text-text-tertiary">
                  Cognitive Index
                </div>
              </div>
            </ScoreRing>
          </motion.div>

          <motion.p variants={up} className="mt-4 text-sm text-text-secondary">
            {ordinal(percentile)} percentile
            {report?.cognitiveAge ? ` · cognitive age ${report.cognitiveAge.years}` : ""}
          </motion.p>

          <motion.h1
            variants={up}
            className="mt-4 max-w-lg font-display text-xl leading-snug text-text-primary md:text-2xl"
          >
            {report?.headline}
          </motion.h1>
        </div>

        {radarData.length >= 3 && (
          <motion.div variants={up} className="mt-6">
            <Suspense fallback={<div className="skeleton mx-auto h-[260px] w-full rounded-3xl-soft" />}>
              <DomainRadar data={radarData} height={260} />
            </Suspense>
          </motion.div>
        )}

        <motion.div
          variants={up}
          className="mt-4 grid grid-cols-2 gap-2.5 px-1 sm:grid-cols-4"
        >
          {(report?.domains ?? []).map((domain) => {
            const Icon = iconFor(domain.icon);
            const a = accentOf(domain.accent);
            return (
              <div
                key={domain.key}
                className="rounded-2xl-soft border border-white/[0.07] bg-white/[0.03] p-3.5 text-center"
              >
                <Icon className={`mx-auto h-4 w-4 ${a.text}`} aria-hidden="true" />
                <div className="mt-1.5 text-2xs uppercase tracking-wider text-text-tertiary">
                  {domain.short}
                </div>
                <div className={`mt-0.5 font-mono text-2xl ${a.text}`} data-tabular>
                  {domain.score}
                </div>
                <div className="mt-1.5">
                  <Meter value={domain.percentile} accent={domain.accent} height={3} />
                </div>
                <div className="mt-1 text-2xs text-text-tertiary">{domain.tier.label}</div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Session rewards */}
      <motion.div variants={up} className="mt-5 flex flex-wrap justify-center gap-2">
        {sessionMeta?.xpGained > 0 && (
          <Pill accent="cyan" icon={Zap}>
            +{sessionMeta.xpGained} XP
          </Pill>
        )}
        {sessionMeta?.streak?.current > 0 && (
          <Pill accent="amber" icon={Flame}>
            {sessionMeta.streak.current} day streak
          </Pill>
        )}
        {(report?.domains ?? []).some((d) => d.isPersonalBest && d.sessions > 1) && (
          <Pill accent="emerald" icon={Sparkles}>
            New personal best
          </Pill>
        )}
      </motion.div>

      {/* New achievements */}
      <AnimatePresence>
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, type: "spring", stiffness: 320, damping: 26 }}
            className="mt-5"
          >
            <Card glow="cyan" className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Award className="h-4 w-4 text-accent-cyan" aria-hidden="true" />
                <span className="eyebrow">
                  {newAchievements.length} achievement{newAchievements.length === 1 ? "" : "s"} unlocked
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {newAchievements.map((id) => {
                  const achievement = ACHIEVEMENT_MAP[id];
                  if (!achievement) return null;
                  const Icon = iconFor(achievement.icon);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-xl-soft border border-accent-cyan/25 bg-accent-cyan/[0.07] px-3 py-2"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent-cyan" aria-hidden="true" />
                      <span className="text-xs text-text-primary">{achievement.name}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The hook into the report */}
      <motion.div variants={up} className="mt-5">
        <Card strong glow="violet" className="p-6">
          <p className="eyebrow mb-2">Your full report is ready</p>
          <h2 className="font-display text-xl text-text-primary">
            {report?.findings?.length
              ? `${report.findings.length} pattern${report.findings.length === 1 ? "" : "s"} found in your trial data`
              : "Every domain, every measure, explained"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {report?.findings?.length
              ? `Including ${report.findings[0].title.toLowerCase()} — with the evidence behind it and exactly what fixes it.`
              : "Percentiles, reaction-time consistency, interference cost, and a plan built from your weakest domain."}
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="primary" size="lg" magnetic iconRight={ArrowRight} onClick={onViewReport}>
              View full report
            </Button>
            <Button variant="secondary" size="lg" icon={FileText} onClick={onStartPlan}>
              Build 28-day plan
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Secondary actions */}
      <motion.div variants={up} className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button variant="secondary" size="md" icon={Share2} onClick={handleShare}>
          Share
        </Button>
        <Button variant="ghost" size="md" icon={RotateCcw} onClick={onRescan}>
          Scan again
        </Button>
        <Button variant="ghost" size="md" icon={Home} onClick={onHome}>
          Home
        </Button>
      </motion.div>

      {toast.node}
    </motion.section>
  );
}
