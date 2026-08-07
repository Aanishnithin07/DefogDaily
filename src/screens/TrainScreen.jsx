import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Dumbbell,
  Flame,
  Lightbulb,
  RefreshCw,
  Target,
  Trophy,
} from "lucide-react";
import { DOMAINS } from "../lib/domains";
import { buildPlan, currentDayIndex, dayTasksDone, planStats } from "../lib/trainingPlan";
import { liveStreak, markPlanTask, savePlan, useStore } from "../lib/storage";
import { fadeInUp, staggerContainer } from "../lib/motion";
import { cue } from "../lib/feedback";
import {
  Button,
  Card,
  EmptyState,
  Meter,
  Pill,
  ScoreRing,
  SectionTitle,
  accentOf,
  useToast,
} from "../components/ui";

const TASK_ICON = { drill: Dumbbell, habit: Lightbulb, scan: Target };

function TaskRow({ task, done, onToggle, onStart }) {
  const Icon = TASK_ICON[task.type] ?? Check;
  const domain = task.domain ? DOMAINS[task.domain] : null;
  const a = accentOf(domain?.accent ?? "cyan");

  return (
    <motion.div variants={fadeInUp} layout>
      <div
        className={`rounded-2xl-soft border p-4 transition-colors ${
          done ? "border-success/25 bg-success/[0.05]" : "border-white/[0.07] bg-white/[0.02]"
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={done}
            aria-label={done ? `Mark ${task.label} incomplete` : `Mark ${task.label} complete`}
            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition-colors ${
              done
                ? "border-success bg-success text-bg-void"
                : "border-white/20 bg-white/[0.03] hover:border-white/40"
            }`}
          >
            <AnimatePresence>
              {done && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className={`h-3.5 w-3.5 ${a.text}`} aria-hidden="true" />
              <span
                className={`font-display text-sm ${done ? "text-text-tertiary line-through" : "text-text-primary"}`}
              >
                {task.label}
              </span>
              {task.minutes > 0 && (
                <span className="font-mono text-2xs text-text-tertiary">{task.minutes} min</span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{task.detail}</p>

            {(task.type === "drill" || task.type === "scan") && !done && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                iconRight={ArrowRight}
                onClick={() => onStart(task)}
              >
                {task.type === "scan" ? "Run scan" : "Start drill"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DayCell({ day, done, isToday, isPast, onSelect, selected }) {
  const complete = day.tasks.length > 0 && done >= day.tasks.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Day ${day.index + 1}`}
      aria-current={isToday ? "date" : undefined}
      className={`relative grid aspect-square place-items-center rounded-xl-soft border text-xs transition-all ${
        selected
          ? "border-accent-cyan bg-accent-cyan/15 text-text-primary"
          : complete
          ? "border-success/40 bg-success/15 text-success"
          : isToday
          ? "border-accent-cyan/50 bg-accent-cyan/[0.07] text-text-primary"
          : isPast
          ? "border-white/[0.06] bg-white/[0.02] text-text-tertiary"
          : "border-white/[0.05] bg-transparent text-text-tertiary/60"
      }`}
    >
      <span className="font-mono" data-tabular>
        {day.index + 1}
      </span>
      {day.isCheckpoint && (
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent-violet"
          aria-hidden="true"
        />
      )}
      {complete && (
        <Check className="absolute bottom-0.5 h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
      )}
    </button>
  );
}

export default function TrainScreen({ onBack, onStartDrill, onStartScan, latestReport }) {
  const plan = useStore((s) => s.plan);
  const streak = useStore((s) => s.streak);
  const toast = useToast();
  const [selectedDay, setSelectedDay] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const stats = useMemo(() => planStats(plan), [plan]);
  const today = plan ? currentDayIndex(plan) : 0;
  const viewDay = selectedDay ?? today;
  const day = plan?.days?.[viewDay];
  const done = plan ? dayTasksDone(plan, viewDay) : new Set();

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8">
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

        <EmptyState
          icon={Target}
          title="No protocol yet"
          body={
            latestReport
              ? `Build a 28-day protocol targeting ${
                  latestReport.primaryTarget?.label ?? "your weakest domain"
                }. Progressive drills, daily transfer habits, and a re-scan every seventh day so you can see whether it worked.`
              : "Run a scan first. The protocol is generated from your own results — targeting your weakest domain, not a generic curriculum."
          }
          action={
            latestReport ? (
              <Button
                variant="violet"
                size="lg"
                magnetic
                iconRight={ArrowRight}
                onClick={() => {
                  savePlan(buildPlan(latestReport));
                  cue("achievement");
                  toast.show("28-day protocol created");
                }}
              >
                Build my protocol
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={() => onStartScan?.("practice")}>
                Run a scan
              </Button>
            )
          }
        />
        {toast.node}
      </div>
    );
  }

  const primary = DOMAINS[plan.primary];
  const week = plan.weeks[Math.floor(viewDay / 7)];
  const a = accentOf(primary?.accent ?? "violet");

  return (
    <motion.div
      variants={staggerContainer(0.06, 0.03)}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:px-6 md:pb-16 md:pt-8"
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={() => setConfirmReset((v) => !v)}
        >
          Rebuild
        </Button>
      </header>

      <AnimatePresence>
        {confirmReset && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <Card className="border-danger/25 p-4">
              <p className="text-sm text-text-secondary">
                Rebuilding starts a fresh 28 days from your latest scan and discards this protocol's
                progress.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!latestReport}
                  onClick={() => {
                    if (!latestReport) return;
                    savePlan(buildPlan(latestReport));
                    setConfirmReset(false);
                    setSelectedDay(null);
                    toast.show("Protocol rebuilt from your latest scan");
                  }}
                >
                  Rebuild protocol
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview */}
      <motion.div variants={fadeInUp}>
        <Card strong className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreRing
              value={stats.adherence * 100}
              size={132}
              stroke={9}
              accent={primary?.accent ?? "violet"}
              label={`Adherence ${Math.round(stats.adherence * 100)} percent`}
            >
              <div className="text-center">
                <div className="font-mono text-2xl text-text-primary" data-tabular>
                  {Math.round(stats.adherence * 100)}%
                </div>
                <div className="text-2xs text-text-tertiary">adherence</div>
              </div>
            </ScoreRing>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="eyebrow mb-1.5">Active protocol</p>
              <h1 className="font-display text-2xl text-text-primary">{plan.title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{plan.rationale}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Pill accent={primary?.accent ?? "violet"} icon={Target}>
                  Day {stats.dayNumber} of 28
                </Pill>
                <Pill accent="cyan">Week {stats.week} · {week?.theme}</Pill>
                {liveStreak(streak) > 0 && (
                  <Pill accent="amber" icon={Flame}>
                    {liveStreak(streak)} day streak
                  </Pill>
                )}
                <Pill accent="emerald" icon={Trophy}>
                  {stats.daysComplete} days cleared
                </Pill>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-1.5 flex justify-between text-2xs text-text-tertiary">
              <span>Protocol progress</span>
              <span className="font-mono">{stats.dayNumber}/28 days</span>
            </div>
            <Meter value={(stats.dayNumber / 28) * 100} accent={primary?.accent ?? "violet"} height={6} />
          </div>
        </Card>
      </motion.div>

      {/* This week's intent */}
      {week && (
        <motion.div variants={fadeInUp} className="mt-4">
          <Card className={`border-l-2 p-5 ${a.border}`}>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Week {week.index}</span>
              <span className={`font-display text-sm ${a.text}`}>{week.theme}</span>
            </div>
            <p className="mt-2 font-display text-base text-text-primary">{week.goal}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{week.detail}</p>
          </Card>
        </motion.div>
      )}

      {/* Selected day */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle
          eyebrow={viewDay === today ? "Today" : `Day ${viewDay + 1}`}
          title={
            day?.isCheckpoint
              ? "Checkpoint — re-measure"
              : day?.isRest
              ? "Rest day"
              : `Day ${viewDay + 1} session`
          }
          action={
            selectedDay != null &&
            selectedDay !== today && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                Jump to today
              </Button>
            )
          }
        />

        <motion.div variants={staggerContainer(0.05)} className="space-y-2.5">
          {day?.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              done={done.has(task.id)}
              onToggle={() => {
                const next = !done.has(task.id);
                markPlanTask(viewDay, task.id, next);
                if (next) cue("correct");
              }}
              onStart={(t) => {
                // Pass the plan task through so finishing the checkpoint ticks
                // it off. Without this the checkbox stayed unticked forever and
                // the protocol could never reach 100%.
                if (t.type === "scan")
                  onStartScan?.(t.mode ?? "practice", { planDay: viewDay, taskId: t.id });
                else onStartDrill?.(t.domain, { planDay: viewDay, taskId: t.id });
              }}
            />
          ))}
        </motion.div>

        {viewDay > today && (
          <p className="mt-3 text-xs text-text-tertiary">
            This day is still ahead. You can look, but do not skip forward — spacing is what makes
            this work.
          </p>
        )}
      </motion.section>

      {/* Calendar */}
      <motion.section variants={fadeInUp} className="mt-8">
        <SectionTitle
          eyebrow="Schedule"
          title="28 days"
          action={
            <span className="flex items-center gap-1.5 text-2xs text-text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
              Checkpoint
            </span>
          }
        />
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {plan.days.map((d) => (
              <DayCell
                key={d.index}
                day={d}
                done={(plan.progress?.[d.index] ?? []).length}
                isToday={d.index === today}
                isPast={d.index < today}
                selected={d.index === viewDay}
                onSelect={() => setSelectedDay(d.index)}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-2xs text-text-tertiary">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            Every seventh day is a re-scan so you can see the change, not just feel it.
          </div>
        </Card>
      </motion.section>

      {/* Baseline comparison */}
      {plan.baseline?.index != null && latestReport?.index && (
        <motion.section variants={fadeInUp} className="mt-8">
          <SectionTitle eyebrow="Movement" title="Since you started" />
          <Card className="p-5">
            <div className="grid grid-cols-3 items-center gap-4 text-center">
              <div>
                <div className="text-2xs uppercase tracking-wider text-text-tertiary">Baseline</div>
                <div className="mt-1 font-mono text-3xl text-text-secondary" data-tabular>
                  {plan.baseline.index}
                </div>
              </div>
              <ArrowRight className="mx-auto h-5 w-5 text-text-tertiary" aria-hidden="true" />
              <div>
                <div className="text-2xs uppercase tracking-wider text-text-tertiary">Now</div>
                <div className="mt-1 font-mono text-3xl text-text-primary" data-tabular>
                  {latestReport.index.index}
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-text-secondary">
              {latestReport.index.index > plan.baseline.index
                ? `Up ${latestReport.index.index - plan.baseline.index} points on the composite index since day one.`
                : latestReport.index.index === plan.baseline.index
                ? "Level with your baseline. Adaptation is rarely linear — keep the reps consistent."
                : `Down ${plan.baseline.index - latestReport.index.index} points. Check sleep and test conditions before reading anything into it.`}
            </p>
          </Card>
        </motion.section>
      )}

      {toast.node}
    </motion.div>
  );
}
