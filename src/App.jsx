import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Dumbbell, FileText, Home, Target } from "lucide-react";
import Landing from "./Landing";
import GameEngine from "./GameEngine";
import ResultsDashboard from "./components/ResultsDashboard";
import ReportScreen from "./screens/ReportScreen";
import TrainScreen from "./screens/TrainScreen";
import PracticeScreen from "./screens/PracticeScreen";
import ProgressScreen from "./screens/ProgressScreen";
import Aurora from "./components/ui/Aurora";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Button } from "./components/ui";
import { SCAN_MODES, DOMAINS } from "./lib/domains";
import { buildReport } from "./lib/report";
import { extractMetrics } from "./lib/metrics";
import { newlyEarned } from "./lib/achievements";
import { getState, markPlanTask, recordSession, unlockAchievements, useStore } from "./lib/storage";
import { saveScore } from "./lib/firestore";
import { primeAudio } from "./lib/feedback";

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Root error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center font-body text-text-primary">
        <div className="glass max-w-md p-8">
          <h1 className="font-display text-2xl text-text-primary">Something broke</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            Your saved progress is safe — it lives in this browser, not in the page. Reload to carry
            on.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

const TABS = [
  { key: "landing", label: "Home", icon: Home },
  { key: "report", label: "Report", icon: FileText },
  { key: "train", label: "Train", icon: Target },
  { key: "practice", label: "Practise", icon: Dumbbell },
  { key: "progress", label: "Progress", icon: BarChart3 },
];

/** Persistent bottom navigation. Hidden during a scan so nothing steals focus. */
function TabBar({ view, onNavigate, visible }) {
  if (!visible) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-bg-void/80 pb-safe backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? "page" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 focus-visible:outline-none"
            >
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent-cyan"
                />
              )}
              <Icon
                className={`h-[18px] w-[18px] transition-colors ${
                  active ? "text-accent-cyan" : "text-text-tertiary"
                }`}
                aria-hidden="true"
              />
              <span
                className={`truncate text-[10px] transition-colors ${
                  active ? "text-text-primary" : "text-text-tertiary"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop side rail — same destinations, more room to breathe. */
function SideRail({ view, onNavigate, visible }) {
  if (!visible) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 border border-white/[0.07] bg-bg-void/70 p-2 backdrop-blur-2xl md:flex"
      style={{ borderRadius: "0 1.1rem 1.1rem 0", borderLeft: "none" }}
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`group relative grid h-11 w-11 place-items-center rounded-xl-soft transition-colors focus-visible:outline-none ${
              active
                ? "bg-accent-cyan/12 text-accent-cyan"
                : "text-text-tertiary hover:bg-white/[0.06] hover:text-text-primary"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg border border-white/10 bg-bg-raised px-2 py-1 text-2xs text-text-primary opacity-0 shadow-lift transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function AppInner() {
  const [view, setView] = useState("landing");
  const [scanConfig, setScanConfig] = useState({ mode: "daily", domains: null, planTask: null });
  const [result, setResult] = useState(null);
  const [sessionMeta, setSessionMeta] = useState(null);
  const { currentUser } = useAuth();

  const lastScan = useStore((s) => s.lastScan);
  const plan = useStore((s) => s.plan);

  /** Live report: the run just finished, or the last one rebuilt from storage. */
  const report = useMemo(() => {
    const source = result ?? lastScan;
    if (!source?.rawScores) return null;
    try {
      return buildReport(source.rawScores, source.scores);
    } catch (error) {
      console.error("Report build failed", error);
      return null;
    }
  }, [result, lastScan]);

  const navigate = useCallback((next) => {
    primeAudio();
    setView(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const startScan = useCallback((mode = "daily") => {
    setScanConfig({ mode, domains: null, planTask: null });
    setResult(null);
    navigate("scan");
  }, [navigate]);

  const startDrill = useCallback(
    (domainKey, planTask = null) => {
      if (!DOMAINS[domainKey]) return;
      setScanConfig({ mode: "practice", domains: [domainKey], planTask });
      setResult(null);
      navigate("scan");
    },
    [navigate]
  );

  /** Everything that happens when a scan or drill finishes. */
  const handleFinish = useCallback(
    (finished) => {
      const isDrill = (finished.domains?.length ?? 0) === 1 && scanConfig.domains;

      // Store compact metrics rather than every trial — raw arrays would fill
      // the quota within a couple of hundred sessions.
      const metrics = extractMetrics(finished.rawScores);

      const { xpGained, streak } = recordSession({
        mode: finished.mode,
        kind: isDrill ? "drill" : "scan",
        domains: finished.domains,
        scores: finished.scores,
        composite: finished.scores.aggregate,
        metrics,
        rawScores: finished.rawScores,
        durationMs: finished.durationMs,
        finishedAt: Date.now(),
      });

      const fresh = newlyEarned(getState());
      if (fresh.length) unlockAchievements(fresh);

      // Tick off the plan task that sent us here.
      if (scanConfig.planTask) {
        markPlanTask(scanConfig.planTask.planDay, scanConfig.planTask.taskId, true);
      }

      if (currentUser) {
        saveScore(currentUser.uid, metrics, finished.scores).catch(() => {});
      }

      setResult(finished);
      setSessionMeta({
        xpGained,
        streak,
        newAchievements: fresh,
        modeLabel: isDrill
          ? `${DOMAINS[finished.domains[0]].label} drill`
          : SCAN_MODES[finished.mode]?.label ?? "Scan complete",
      });
      navigate("results");
    },
    [currentUser, navigate, scanConfig.domains, scanConfig.planTask]
  );

  // Keyboard shortcuts for the impatient — 1-5 jump between sections.
  useEffect(() => {
    const onKey = (event) => {
      if (view === "scan") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && /input|textarea|select/i.test(target.tagName)) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < TABS.length) navigate(TABS[index].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, view]);

  const chromeVisible = view !== "scan" && view !== "results";
  const auroraTone =
    view === "train" ? "focus" : view === "results" ? "success" : view === "report" ? "alert" : "default";

  const screens = {
    landing: <Landing onStartScan={startScan} onNavigate={navigate} />,
    scan: (
      <GameEngine
        mode={scanConfig.mode}
        domains={scanConfig.domains}
        onFinish={handleFinish}
        onExit={() => navigate("landing")}
      />
    ),
    results: (
      <ResultsDashboard
        report={report}
        result={result}
        sessionMeta={sessionMeta}
        onViewReport={() => navigate("report")}
        onStartPlan={() => navigate("train")}
        onRescan={() => startScan(scanConfig.mode)}
        onHome={() => navigate("landing")}
      />
    ),
    report: (
      <ReportScreen
        report={report}
        hasPlan={!!plan}
        onBack={() => navigate(result ? "results" : "landing")}
        onStartPlan={() => navigate("train")}
        onPractice={(domainKey) => startDrill(domainKey)}
      />
    ),
    train: (
      <TrainScreen
        latestReport={report}
        onBack={() => navigate("landing")}
        onStartDrill={startDrill}
        onStartScan={startScan}
      />
    ),
    practice: <PracticeScreen onBack={() => navigate("landing")} onStartDrill={startDrill} />,
    progress: <ProgressScreen onBack={() => navigate("landing")} />,
  };

  // The report tab is only meaningful once something has been measured.
  const activeScreen =
    view === "report" && !report ? screens.landing : screens[view] ?? screens.landing;

  return (
    <>
      <Aurora tone={auroraTone} />
      <div className="min-h-screen font-body text-text-primary md:pl-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeScreen}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar view={view} onNavigate={navigate} visible={chromeVisible} />
      <SideRail view={view} onNavigate={navigate} visible={chromeVisible} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootErrorBoundary>
        <AppInner />
      </RootErrorBoundary>
    </AuthProvider>
  );
}
