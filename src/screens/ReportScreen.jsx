import { Suspense, lazy, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Info,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DOMAINS } from "../lib/domains";
import { NORMS_DISCLAIMER, ordinal } from "../lib/norms";
import { fadeInUp, staggerContainer } from "../lib/motion";
import {
  Button,
  Card,
  CountUp,
  Disclosure,
  Meter,
  Pill,
  ScoreRing,
  SectionTitle,
  Sparkline,
  accentOf,
} from "../components/ui";
import AiCoachPanel from "../components/AiCoachPanel";
import { useStore } from "../lib/storage";

const DomainRadar = lazy(() => import("../components/charts/DomainRadar"));

const SEVERITY = {
  critical: {
    label: "Needs attention",
    accent: "rose",
    icon: AlertTriangle,
  },
  watch: { label: "Worth watching", accent: "amber", icon: Eye },
  note: { label: "Minor", accent: "slate", icon: Info },
};

/**
 * Turns a domain's deep metrics into display rows. Every row is a number a
 * paid assessment would charge for, with a plain-English hint attached — the
 * number alone is useless if you do not know what it means.
 */
const metricRows = (key, m) => {
  if (!m) return [];
  const ms = (v) => (typeof v === "number" ? `${Math.round(v)}ms` : "—");
  const pc = (v) => (typeof v === "number" ? `${Math.round(v)}%` : "—");

  const shared = [
    m.medianRt != null && {
      label: "Median reaction",
      value: ms(m.medianRt),
      hint: "Your typical decision speed, unaffected by outliers.",
    },
    m.cv != null && {
      label: "Consistency (CV)",
      value: m.cv.toFixed(2),
      hint: "Lower is steadier. Under 0.25 is stable, over 0.34 means attention is flickering.",
    },
    m.lapses != null && {
      label: "Lapses",
      value: `${m.lapses} (${pc(m.lapseRate)})`,
      hint: "Responses over 2.5× your median — moments you were briefly off-task.",
    },
    m.fatigueMs != null && {
      label: "Fade over time",
      value: `${m.fatigueMs > 0 ? "+" : ""}${Math.round(m.fatigueMs)}ms`,
      hint: "How much slower your last third ran than your first. Positive means you faded.",
    },
  ];

  const perDomain = {
    speed: [
      m.fastestRt != null && { label: "Fastest response", value: ms(m.fastestRt), hint: "Your ceiling when everything lines up." },
      m.loadCost != null && { label: "Load cost", value: ms(m.loadCost), hint: "Extra time needed for 4-digit numbers versus short ones." },
      m.bestStreak != null && { label: "Best streak", value: m.bestStreak, hint: "Longest run without an error." },
    ],
    stroop: [
      m.interferenceMs != null && {
        label: "Interference cost",
        value: ms(m.interferenceMs),
        hint: "The Stroop effect itself — extra time when word and ink conflict. Under 150ms is strong control.",
      },
      m.congruentRt != null && { label: "Congruent trials", value: ms(m.congruentRt), hint: "Speed when nothing is fighting you." },
      m.incongruentRt != null && { label: "Incongruent trials", value: ms(m.incongruentRt), hint: "Speed when you have to override the word." },
    ],
    memory: [
      m.dPrime != null && {
        label: "Sensitivity (d')",
        value: m.dPrime,
        hint: "How cleanly you separate real memories from convincing lookalikes. Above 2.0 is sharp.",
      },
      { label: "Hits / misses", value: `${m.hits} / ${m.misses}`, hint: "Targets correctly recalled versus targets lost." },
      { label: "False alarms", value: m.falseAlarms, hint: "Decoys you claimed to have seen." },
      m.recallTimeMs != null && { label: "Decision time", value: `${(m.recallTimeMs / 1000).toFixed(1)}s`, hint: "How long you took to commit." },
    ],
    spatial: [
      { label: "Span reached", value: m.spanReached, hint: "Cells held at once. Typical adult span is 5 to 7." },
      { label: "Level reached", value: `${m.levelReached} / 12`, hint: "How far up the staircase you climbed." },
      m.encodeMsPerCell != null && { label: "Encoding time", value: ms(m.encodeMsPerCell), hint: "Study time available per cell at your peak level." },
    ],
    nback: [
      m.dPrime != null && { label: "Sensitivity (d')", value: m.dPrime, hint: "Signal detection at your N level. Above 1.5 is solid." },
      { label: "Peak level", value: `${m.peakN}-back`, hint: "The highest load you sustained." },
      { label: "Hits / misses", value: `${m.hits} / ${m.misses}`, hint: "Matches caught versus matches let through." },
      { label: "False alarms", value: m.falseAlarms, hint: "Times you called a match that was not there." },
    ],
    inhibition: [
      { label: "Impulse errors", value: `${m.commissionErrors} (${pc(m.commissionRate)})`, hint: "Tapped a square. Under 15% is good control." },
      { label: "Missed signals", value: `${m.omissionErrors} (${pc(m.omissionRate)})`, hint: "Let a circle pass. This is inattention, not impulsivity." },
      m.dPrime != null && { label: "Sensitivity (d')", value: m.dPrime, hint: "Overall separation of go from no-go." },
    ],
    span: [
      { label: "Forward span", value: m.forwardSpan, hint: "Raw storage. Typical adult span is 6 to 7 digits." },
      { label: "Backward span", value: m.backwardSpan, hint: "Storage plus manipulation. Usually one to two below forward." },
      { label: "Manipulation cost", value: m.manipulationCost, hint: "Forward minus backward. A gap over 2 points at executive load, not capacity." },
    ],
    flex: [
      m.switchCostMs != null && { label: "Switch cost", value: ms(m.switchCostMs), hint: "Extra time per rule change. Under 150ms is cheap; over 300ms is expensive." },
      m.switchRt != null && { label: "Switch trials", value: ms(m.switchRt), hint: "Speed when the rule just changed." },
      m.repeatRt != null && { label: "Repeat trials", value: ms(m.repeatRt), hint: "Speed when the rule stayed the same." },
      m.switchAccuracy != null && { label: "Switch accuracy", value: pc(m.switchAccuracy), hint: "Accuracy on the harder trial type." },
    ],
  };

  return [...(perDomain[key] ?? []), ...shared].filter(Boolean);
};

function HeroBlock({ report }) {
  const index = report.index;
  const cogAge = report.cognitiveAge;

  return (
    <Card strong className="overflow-hidden p-6 md:p-8">
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-10">
        <ScoreRing
          value={index?.percentile ?? 0}
          size={188}
          stroke={11}
          accent="cyan"
          label={`Composite index ${index?.index ?? 0}`}
        >
          <div className="text-center">
            <div className="eyebrow mb-0.5">Index</div>
            <div className="font-mono text-5xl text-text-primary" data-tabular>
              <CountUp value={index?.index ?? 0} />
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              {ordinal(index?.percentile ?? 50)} percentile
            </div>
          </div>
        </ScoreRing>

        <div className="min-w-0 flex-1 text-center md:text-left">
          <p className="eyebrow mb-2">Cognitive Report</p>
          <h1 className="font-display text-2xl leading-snug text-text-primary md:text-3xl">
            {report.headline}
          </h1>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl-soft border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="text-2xs uppercase tracking-wider text-text-tertiary">Cognitive age</div>
              <div className="mt-1 font-mono text-2xl text-text-primary" data-tabular>
                {cogAge?.years ?? "—"}
              </div>
              {cogAge?.delta != null && (
                <div
                  className={`text-2xs ${cogAge.delta <= 0 ? "text-success" : "text-warning"}`}
                >
                  {cogAge.delta <= 0 ? `${Math.abs(cogAge.delta)}y younger` : `${cogAge.delta}y older`}
                </div>
              )}
            </div>
            <div className="rounded-2xl-soft border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="text-2xs uppercase tracking-wider text-text-tertiary">Domains</div>
              <div className="mt-1 font-mono text-2xl text-text-primary" data-tabular>
                {report.domainsMeasured}/8
              </div>
              <div className="text-2xs text-text-tertiary">
                {report.isPartial ? "Run a Deep Scan" : "Complete profile"}
              </div>
            </div>
            <div className="col-span-2 rounded-2xl-soft border border-white/[0.07] bg-white/[0.03] p-3 sm:col-span-1">
              <div className="text-2xs uppercase tracking-wider text-text-tertiary">Spread</div>
              <div className="mt-1 font-mono text-2xl text-text-primary" data-tabular>
                {report.spread}
              </div>
              <div className="text-2xs text-text-tertiary">
                {report.spread > 40 ? "Very uneven" : report.spread > 22 ? "Uneven" : "Balanced"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DomainRow({ domain, history }) {
  const a = accentOf(domain.accent);
  const rows = metricRows(domain.key, domain.metrics);
  const trendUp = typeof domain.trend === "number" && domain.trend > 1;
  const trendDown = typeof domain.trend === "number" && domain.trend < -1;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base text-text-primary">{domain.label}</h3>
            <Pill accent={domain.tier.tone === "slate" ? "slate" : domain.tier.tone}>
              {domain.tier.label}
            </Pill>
            {domain.isPersonalBest && domain.sessions > 1 && (
              <Pill accent="emerald">Personal best</Pill>
            )}
          </div>
          <p className="mt-1 text-xs text-text-tertiary">{domain.measures}</p>
        </div>

        <div className="flex items-center gap-4">
          {history?.length > 2 && (
            <Sparkline points={history} accent={domain.accent} width={72} height={26} />
          )}
          <div className="text-right">
            <div className={`font-mono text-3xl ${a.text}`} data-tabular>
              {domain.score}
            </div>
            <div className="flex items-center justify-end gap-1 text-2xs text-text-tertiary">
              {trendUp && <TrendingUp className="h-3 w-3 text-success" />}
              {trendDown && <TrendingDown className="h-3 w-3 text-danger" />}
              {domain.percentileLabel} pct
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Meter value={domain.percentile} accent={domain.accent} marker={50} height={7} />
        <div className="mt-1.5 flex justify-between text-2xs text-text-tertiary">
          <span>Lower 10%</span>
          <span>Average</span>
          <span>Top 10%</span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-4">
          <Disclosure summary={`Deep metrics · ${rows.length} measures`} accent={domain.accent}>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="rounded-xl-soft border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xs uppercase tracking-wider text-text-tertiary">
                      {row.label}
                    </span>
                    <span className="font-mono text-sm text-text-primary" data-tabular>
                      {row.value}
                    </span>
                  </div>
                  <p className="mt-1 text-2xs leading-relaxed text-text-tertiary">{row.hint}</p>
                </div>
              ))}
            </div>
          </Disclosure>
        </div>
      )}
    </Card>
  );
}

function FindingCard({ finding, onPractice }) {
  const meta = SEVERITY[finding.severity] ?? SEVERITY.note;
  const Icon = meta.icon;
  const a = accentOf(meta.accent);

  return (
    <motion.div variants={fadeInUp}>
      <Card className={`border-l-2 p-5 ${a.border}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl-soft ${a.soft}`}>
            <Icon className={`h-4 w-4 ${a.text}`} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base text-text-primary">{finding.title}</h3>
              <Pill accent={meta.accent}>{meta.label}</Pill>
              <span className="text-2xs uppercase tracking-wider text-text-tertiary">
                {finding.domainLabel}
              </span>
            </div>

            <p className="mt-2.5 rounded-xl-soft border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-xs leading-relaxed text-text-secondary">
              {finding.evidence}
            </p>

            {finding.alsoAffects?.length > 0 && (
              <p className="mt-2 text-2xs text-text-tertiary">
                Same pattern also appeared in {finding.alsoAffects.join(", ")} — which makes it a
                trait rather than a one-off.
              </p>
            )}

            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{finding.whatItMeans}</p>

            {finding.fix && (
              <div className="mt-4 rounded-2xl-soft border border-accent-cyan/20 bg-accent-cyan/[0.05] p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-accent-cyan" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent-cyan">
                    {finding.fix.headline}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {finding.fix.steps.map((step) => (
                    <li key={step} className="flex gap-2 text-sm leading-relaxed text-text-secondary">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
                      {step}
                    </li>
                  ))}
                </ul>
                {finding.fix.drill && DOMAINS[finding.fix.drill] && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3.5"
                    iconRight={ArrowRight}
                    onClick={() => onPractice?.(finding.fix.drill)}
                  >
                    Practise {DOMAINS[finding.fix.drill].short} now · {finding.fix.minutes} min
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function ReportScreen({ report, onBack, onStartPlan, onPractice, hasPlan }) {
  const profile = useStore((s) => s.profile);

  const radarData = useMemo(
    () =>
      report.domains.map((d) => ({
        label: d.short,
        value: d.score,
        baseline: Math.round(profile[d.key]?.ema ?? d.score),
      })),
    [report.domains, profile]
  );

  const hasBaseline = report.domains.some((d) => (profile[d.key]?.sessions ?? 0) > 1);

  if (!report?.index) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-text-secondary">No report available yet. Run a scan first.</p>
        <Button variant="secondary" className="mt-6" onClick={onBack} icon={ArrowLeft}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer(0.06, 0.04)}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Button variant="ghost" size="sm" icon={Download} onClick={() => window.print()}>
          Save as PDF
        </Button>
      </header>

      <motion.div variants={fadeInUp}>
        <HeroBlock report={report} />
      </motion.div>

      {/* Profile shape */}
      <motion.div variants={fadeInUp} className="mt-4">
        <Card className="p-5 md:p-6">
          <SectionTitle
            eyebrow="Profile shape"
            title="Where your strength sits"
            action={
              hasBaseline ? (
                <span className="hidden text-2xs text-text-tertiary sm:flex sm:items-center sm:gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded bg-accent-cyan" /> This scan
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded bg-accent-violet" /> Your average
                  </span>
                </span>
              ) : null
            }
          />
          <Suspense fallback={<div className="skeleton h-[300px] w-full rounded-3xl-soft" />}>
            <DomainRadar data={radarData} showBaseline={hasBaseline} height={300} />
          </Suspense>
        </Card>
      </motion.div>

      {/* Pillars */}
      {report.pillars.length > 0 && (
        <motion.section variants={fadeInUp} className="mt-8">
          <SectionTitle eyebrow="Systems" title="The four systems behind the score" />
          <div className="grid gap-3 sm:grid-cols-2">
            {report.pillars.map((pillar) => {
              const a = accentOf(pillar.accent);
              return (
                <Card key={pillar.key} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-base text-text-primary">{pillar.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{pillar.blurb}</p>
                    </div>
                    <span className={`shrink-0 font-mono text-2xl ${a.text}`} data-tabular>
                      {pillar.score}
                    </span>
                  </div>
                  <div className="mt-3.5">
                    <Meter value={pillar.percentile} accent={pillar.accent} marker={50} height={6} />
                  </div>
                  <p className="mt-2 text-2xs text-text-tertiary">
                    {ordinal(pillar.percentile)} percentile ·{" "}
                    {pillar.domains.map((d) => d.label).join(", ")}
                  </p>
                </Card>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Findings — the actual diagnosis */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle
          eyebrow="Diagnosis"
          title={
            report.findings.length
              ? `What is holding you back (${report.findings.length})`
              : "Nothing is holding you back"
          }
        />
        {report.findings.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  No failure patterns crossed threshold in this scan. Your errors are not clustering
                  into impulsivity, drift, fatigue, or a capacity ceiling — which usually means the
                  next gains come from raising difficulty rather than fixing a weakness.
                </p>
                {report.isPartial && (
                  <p className="mt-2.5 text-sm text-text-secondary">
                    You have only measured {report.domainsMeasured} of 8 domains. A Deep Scan may
                    surface something the quick scan cannot see.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {report.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onPractice={onPractice} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <motion.section variants={fadeInUp} className="mt-8">
          <SectionTitle eyebrow="Assets" title="What is working" />
          <div className="space-y-3">
            {report.strengths.map((strength) => (
              <Card key={strength.id} className="border-l-2 border-accent-emerald/40 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl-soft bg-accent-emerald/10">
                    <Sparkles className="h-4 w-4 text-accent-emerald" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base text-text-primary">{strength.title}</h3>
                      <span className="text-2xs uppercase tracking-wider text-text-tertiary">
                        {strength.domainLabel}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-text-secondary">{strength.evidence}</p>
                    {strength.alsoAffects?.length > 0 && (
                      <p className="mt-1.5 text-2xs text-text-tertiary">
                        Also true of {strength.alsoAffects.join(", ")}.
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                      {strength.whatItMeans}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* Domain detail */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle eyebrow="Detail" title="Every domain, every measure" />
        <div className="space-y-3">
          {report.domains.map((domain) => (
            <DomainRow
              key={domain.key}
              domain={domain}
              history={(profile[domain.key]?.history ?? []).slice(-12).map((h) => h.s)}
            />
          ))}
        </div>
      </motion.section>

      {/* AI coach */}
      <motion.section variants={fadeInUp} className="mt-8">
        <AiCoachPanel report={report} />
      </motion.section>

      {/* The plan CTA */}
      <motion.section variants={fadeInUp} className="mt-8">
        <Card strong glow="violet" className="p-6 md:p-7">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-violet" aria-hidden="true" />
            <span className="eyebrow">Your next 28 days</span>
          </div>
          <h2 className="mt-2.5 font-display text-2xl text-text-primary">
            {report.primaryTarget
              ? `Train ${report.primaryTarget.label} first`
              : "Build your training protocol"}
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
            {report.primaryTarget
              ? `${report.primaryTarget.label} came out at the ${report.primaryTarget.percentileLabel} percentile — your lowest domain, and the one dragging the composite down. A 28-day protocol targets it directly with progressive drills and daily transfer habits, then re-measures.`
              : "A four-week protocol built from your own results, with progressive drills and real-world habits."}
          </p>
          <Button
            variant="violet"
            size="lg"
            magnetic
            className="mt-6 w-full sm:w-auto"
            iconRight={ArrowRight}
            onClick={onStartPlan}
          >
            {hasPlan ? "Open my protocol" : "Build my 28-day protocol"}
          </Button>
          <p className="mt-3 text-2xs text-text-tertiary">
            Free, forever. No account needed — it saves on this device.
          </p>
        </Card>
      </motion.section>

      <motion.p variants={fadeInUp} className="mt-8 px-1 text-2xs leading-relaxed text-text-tertiary">
        <Info className="mr-1 inline h-3 w-3" aria-hidden="true" />
        {NORMS_DISCLAIMER}
      </motion.p>
    </motion.div>
  );
}
