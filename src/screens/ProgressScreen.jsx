import { lazy, useEffect, useMemo, useRef, useState } from "react";
import ChartBoundary from "../components/ChartBoundary";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CloudUpload,
  Download,
  Flame,
  Lock,
  LogOut,
  Keyboard,
  Trash2,
  Trophy,
  Volume2,
  Vibrate,
} from "lucide-react";
import { DEEP_SCAN, DOMAINS } from "../lib/domains";
import { ACHIEVEMENTS, TIER_STYLES, evaluateAchievements } from "../lib/achievements";
import { percentileFor, ordinal } from "../lib/norms";
import {
  clearAllData,
  exportData,
  levelForXp,
  liveStreak,
  setPrefs,
  useStore,
} from "../lib/storage";
import { fadeInUp, staggerContainer } from "../lib/motion";
import { useAuth } from "../context/AuthContext";
import { saveScore } from "../lib/firestore";
import {
  Button,
  Card,
  EmptyState,
  Meter,
  ScoreRing,
  SectionTitle,
  Sparkline,
  accentOf,
  useToast,
} from "../components/ui";
import { iconFor } from "../components/ui/icons";

const TrendChart = lazy(() => import("../components/charts/TrendChart"));

export default function ProgressScreen({ onBack, onDataCleared }) {
  const state = useStore();
  const { currentUser, signInWithGoogle, logout, isConfigured } = useAuth();
  const toast = useToast();
  const [series, setSeries] = useState(["speed", "memory", "stroop", "spatial"]);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => () => {
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
  }, []);

  const level = levelForXp(state.xp.total);
  // A stored streak keeps its last value forever, so read it through
  // liveStreak — a run three weeks ago is not a live streak.
  const currentStreak = liveStreak(state.streak);
  // sessions[] is capped at 200 for quota reasons; totalSessions is the truth.
  const totalSessions = state.totalSessions ?? state.sessions.length;
  const unlockedIds = useMemo(() => new Set(Object.keys(state.achievements)), [state.achievements]);
  const earnedNow = useMemo(() => new Set(evaluateAchievements(state)), [state]);

  const scanSessions = useMemo(
    () => state.sessions.filter((s) => s.kind !== "drill"),
    [state.sessions]
  );

  const trendData = useMemo(
    () =>
      scanSessions.slice(-30).map((session, i) => ({
        label: new Date(session.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        index: i,
        ...DEEP_SCAN.reduce((acc, key) => {
          acc[key] = session.scores?.[key] ?? null;
          return acc;
        }, {}),
      })),
    [scanSessions]
  );

  const records = useMemo(
    () =>
      DEEP_SCAN.map((key) => {
        const slot = state.profile[key];
        return {
          key,
          domain: DOMAINS[key],
          best: slot?.best ?? 0,
          current: slot?.ema ?? null,
          sessions: slot?.sessions ?? 0,
          history: (slot?.history ?? []).slice(-12).map((h) => h.s),
        };
      }).filter((r) => r.sessions > 0),
    [state.profile]
  );

  const toggleSeries = (key) =>
    setSeries((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defogdaily-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.show("Your data has been downloaded");
  };

  const handleCloudSync = async () => {
    if (!isConfigured) {
      toast.show("Cloud sync needs Firebase keys in .env — everything else still works");
      return;
    }
    try {
      if (!currentUser) {
        await signInWithGoogle();
        toast.show("Signed in. Future scans will sync.");
        return;
      }
      const latest = state.sessions[state.sessions.length - 1];
      if (latest) {
        await saveScore(currentUser.uid, latest.metrics ?? {}, latest.scores ?? {});
        toast.show("Latest scan backed up");
      }
    } catch (error) {
      console.error("Cloud sync failed", error);
      toast.show("Sync failed — your local data is untouched");
    }
  };

  return (
    <motion.div
      variants={staggerContainer(0.05, 0.03)}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
    >
      <header className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </header>

      {/* Level + streak */}
      <motion.div variants={fadeInUp}>
        <Card strong className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ScoreRing
              value={level.progress * 100}
              size={124}
              stroke={9}
              accent="cyan"
              label={`Level ${level.level}`}
            >
              <div className="text-center">
                <div className="text-2xs uppercase tracking-wider text-text-tertiary">Level</div>
                <div className="font-mono text-3xl text-text-primary" data-tabular>
                  {level.level}
                </div>
              </div>
            </ScoreRing>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="eyebrow mb-1.5">Your record</p>
              <h1 className="font-display text-2xl text-text-primary">
                {totalSessions} session{totalSessions === 1 ? "" : "s"} logged
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                {level.isMax
                  ? "Maximum level reached"
                  : `${level.remaining} XP to level ${level.level + 1}`}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl-soft border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-2xs text-text-tertiary">
                    <Flame className="h-3 w-3 text-accent-amber" /> Streak
                  </div>
                  <div className="mt-0.5 font-mono text-xl text-text-primary" data-tabular>
                    {currentStreak}
                  </div>
                </div>
                <div className="rounded-xl-soft border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
                  <div className="text-2xs text-text-tertiary">Longest</div>
                  <div className="mt-0.5 font-mono text-xl text-text-primary" data-tabular>
                    {state.streak.longest}
                  </div>
                </div>
                <div className="rounded-xl-soft border border-white/[0.07] bg-white/[0.03] p-2.5 text-center">
                  <div className="text-2xs text-text-tertiary">Total XP</div>
                  <div className="mt-0.5 font-mono text-xl text-text-primary" data-tabular>
                    {state.xp.total}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Meter value={level.progress * 100} accent="cyan" height={5} />
          </div>
        </Card>
      </motion.div>

      {/* Trends */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle eyebrow="Over time" title="Performance trends" />
        {trendData.length < 2 ? (
          <EmptyState
            icon={Trophy}
            title="Not enough history yet"
            body="Two or more scans will plot a trend here. Consistency is what makes the line meaningful — try to scan at the same time of day."
          />
        ) : (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {DEEP_SCAN.filter((key) => (state.profile[key]?.sessions ?? 0) > 0).map((key) => {
                const on = series.includes(key);
                const a = accentOf(DOMAINS[key].accent);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSeries(key)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-2xs uppercase tracking-wider transition-colors ${
                      on
                        ? `${a.border} ${a.soft} ${a.text}`
                        : "border-white/[0.08] text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    {DOMAINS[key].short}
                  </button>
                );
              })}
            </div>
            <ChartBoundary height={300} label="trend chart">
              <TrendChart data={trendData} series={series} height={300} />
            </ChartBoundary>
          </Card>
        )}
      </motion.section>

      {/* Records */}
      {records.length > 0 && (
        <motion.section variants={fadeInUp} className="mt-8">
          <SectionTitle eyebrow="Bests" title="Personal records" />
          <Card className="divide-y divide-white/[0.06] p-0">
            {records.map(({ key, domain, best, current, sessions, history }) => {
              const Icon = iconFor(domain.icon);
              const a = accentOf(domain.accent);
              return (
                <div key={key} className="flex items-center gap-3 p-4">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl-soft ${a.soft}`}>
                    <Icon className={`h-4 w-4 ${a.text}`} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-text-primary">{domain.label}</div>
                    <div className="text-2xs text-text-tertiary">
                      {sessions} session{sessions === 1 ? "" : "s"}
                      {current != null && ` · now ${Math.round(current)} · ${ordinal(percentileFor(current, key, state.prefs.age))} pct`}
                    </div>
                  </div>
                  {history.length > 2 && (
                    <Sparkline points={history} accent={domain.accent} width={60} height={22} />
                  )}
                  <div className="w-14 text-right">
                    <div className={`font-mono text-xl ${a.text}`} data-tabular>
                      {Math.round(best)}
                    </div>
                    <div className="text-2xs text-text-tertiary">best</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </motion.section>
      )}

      {/* Achievements */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle
          eyebrow="Milestones"
          title="Achievements"
          action={
            <span className="font-mono text-xs text-text-tertiary" data-tabular>
              {earnedNow.size}/{ACHIEVEMENTS.length}
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {ACHIEVEMENTS.map((achievement) => {
            const earned = earnedNow.has(achievement.id) || unlockedIds.has(achievement.id);
            const Icon = earned ? iconFor(achievement.icon) : Lock;
            const style = TIER_STYLES[achievement.tier];
            return (
              <div
                key={achievement.id}
                className={`rounded-2xl-soft border p-3.5 text-center transition-all ${
                  earned
                    ? `${style.ring} bg-white/[0.04] ${style.glow}`
                    : "border-white/[0.06] bg-white/[0.015]"
                }`}
              >
                <Icon
                  className={`mx-auto h-5 w-5 ${earned ? style.text : "text-text-tertiary/50"}`}
                  aria-hidden="true"
                />
                <div
                  className={`mt-2 font-display text-xs ${earned ? "text-text-primary" : "text-text-tertiary"}`}
                >
                  {achievement.name}
                </div>
                <p className="mt-1 text-2xs leading-snug text-text-tertiary">{achievement.detail}</p>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Settings */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle eyebrow="Settings" title="Your data, your device" />
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-text-primary">Age (optional)</div>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Enables age-referenced percentiles. Stored only on this device.
              </p>
            </div>
            <input
              type="number"
              min="14"
              max="100"
              value={state.prefs.age ?? ""}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setPrefs({ age: value === "" ? null : Number(value) });
              }}
              aria-label="Your age"
              className="w-20 rounded-xl-soft border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-center font-mono text-sm text-text-primary"
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-2 text-sm text-text-primary">
              <Volume2 className="h-4 w-4 text-text-tertiary" /> Sound
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.prefs.sound !== false}
              onClick={() => setPrefs({ sound: state.prefs.sound === false })}
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                state.prefs.sound !== false ? "bg-accent-cyan" : "bg-white/15"
              }`}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={`block h-5 w-5 rounded-full bg-bg-void ${
                  state.prefs.sound !== false ? "ml-5" : "ml-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-2 text-sm text-text-primary">
              <Vibrate className="h-4 w-4 text-text-tertiary" /> Haptics
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.prefs.haptics !== false}
              onClick={() => setPrefs({ haptics: state.prefs.haptics === false })}
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${
                state.prefs.haptics !== false ? "bg-accent-cyan" : "bg-white/15"
              }`}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={`block h-5 w-5 rounded-full bg-bg-void ${
                  state.prefs.haptics !== false ? "ml-5" : "ml-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <Keyboard className="h-4 w-4 text-text-tertiary" /> Number-key shortcuts
              </div>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Press 1-5 to jump between sections. Turn off if you use speech input.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.prefs.shortcuts !== false}
              aria-label="Number-key shortcuts"
              onClick={() => setPrefs({ shortcuts: state.prefs.shortcuts === false })}
              className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                state.prefs.shortcuts !== false ? "bg-accent-cyan" : "bg-white/15"
              }`}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className={`block h-5 w-5 rounded-full bg-bg-void ${
                  state.prefs.shortcuts !== false ? "ml-5" : "ml-0"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
              Export my data
            </Button>
            <Button variant="secondary" size="sm" icon={CloudUpload} onClick={handleCloudSync}>
              {currentUser ? "Back up to cloud" : "Sign in to sync"}
            </Button>
            {currentUser && (
              <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>
                Sign out
              </Button>
            )}
            <Button
              variant={confirmClear ? "danger" : "ghost"}
              size="sm"
              icon={Trash2}
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
                  confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 4000);
                  return;
                }
                if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
                clearAllData();
                // The store is wiped, but App still holds the finished run in
                // memory — without this the Report tab keeps rendering the
                // report the user just asked to delete.
                onDataCleared?.();
                setConfirmClear(false);
                toast.show("All local data cleared");
              }}
            >
              {confirmClear ? "Tap again to erase everything" : "Clear my data"}
            </Button>
          </div>

          <p className="border-t border-white/[0.06] pt-4 text-2xs leading-relaxed text-text-tertiary">
            Everything lives in this browser by default — no account, no server, nothing sold. Cloud
            sync is optional and only exists so you can move between devices.
          </p>
        </Card>
      </motion.section>

      {toast.node}
    </motion.div>
  );
}
