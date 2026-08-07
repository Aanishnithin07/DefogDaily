import { useMemo } from "react";
import { motion, useMotionTemplate, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Flame,
  Gauge,
  Github,
  Heart,
  Lock,
  Microscope,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { DEEP_SCAN, DOMAINS, PILLARS } from "./lib/domains";
import { defogReveal, fadeInUp, staggerContainer, useReducedMotionVariant } from "./lib/motion";
import { trackEvent } from "./lib/analytics";
import { levelForXp, liveStreak, useStore } from "./lib/storage";
import { Button, Card, Pill, SectionTitle, accentOf } from "./components/ui";
import { iconFor } from "./components/ui/icons";

/** The comparison that explains why this exists. */
const COMPARISON = [
  { feature: "Cognitive assessment across 8 domains", them: "Free trial, then paywalled", us: true },
  { feature: "Percentile scoring against norms", them: "Premium only", us: true },
  { feature: "Trial-level diagnostics (consistency, lapses, interference)", them: "Rarely offered at all", us: true },
  { feature: "Personalised weakness diagnosis", them: "Premium only", us: true },
  { feature: "28-day training protocol", them: "Subscription", us: true },
  { feature: "Unlimited targeted practice", them: "Daily limit on free tier", us: true },
  { feature: "Full progress history and export", them: "Locked or account-gated", us: true },
  { feature: "No account required", them: "Signup wall", us: true },
  { feature: "Your data sold or shared", them: "Often", us: false, invert: true },
];

function DomainTile({ domainKey, variants }) {
  const domain = DOMAINS[domainKey];
  const Icon = iconFor(domain.icon);
  const a = accentOf(domain.accent);

  return (
    <motion.article
      variants={variants}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="glass p-5"
    >
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-2xl-soft border ${a.border} ${a.soft}`}>
        <Icon className={`h-4.5 w-4.5 ${a.text}`} aria-hidden="true" />
      </div>
      <h3 className="font-display text-sm text-text-primary">{domain.label}</h3>
      <p className="mt-0.5 text-2xs uppercase tracking-wider text-text-tertiary">
        {PILLARS[domain.pillar].label}
      </p>
      <p className="mt-2.5 text-xs leading-relaxed text-text-secondary">{domain.measures}</p>
    </motion.article>
  );
}

export default function Landing({ onStartScan, onNavigate }) {
  const prefersReducedMotion = useReducedMotion();
  const state = useStore();
  const { scrollY } = useScroll();

  const navOpacity = useTransform(scrollY, [0, 90], [0, 0.82], { clamp: true });
  const navBorder = useTransform(scrollY, [0, 90], [0, 0.1], { clamp: true });
  const navBg = useMotionTemplate`rgba(11, 14, 20, ${navOpacity})`;
  const navBorderColor = useMotionTemplate`rgba(245, 248, 255, ${navBorder})`;

  const hero = useReducedMotionVariant(prefersReducedMotion, defogReveal);
  const up = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const stagger = useMemo(() => staggerContainer(0.08, 0.14), []);

  const hasHistory = (state.totalSessions ?? state.sessions.length) > 0;
  const level = levelForXp(state.xp.total);
  const streak = liveStreak(state.streak);

  const start = (mode) => {
    trackEvent("cta_clicked", { mode });
    onStartScan(mode);
  };

  return (
    <div className="min-h-screen font-body text-text-primary">
      <motion.nav
        style={{ backgroundColor: navBg, borderBottomColor: navBorderColor }}
        className="sticky top-0 z-40 border-b border-transparent backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="font-display text-base tracking-wide text-text-primary">
            Defog<span className="text-accent-cyan">Daily</span>
          </span>
          <div className="flex items-center gap-2">
            {hasHistory && (
              <button
                type="button"
                onClick={() => onNavigate("progress")}
                className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-2xs text-text-secondary transition-colors hover:text-text-primary sm:flex"
              >
                <Flame className="h-3 w-3 text-accent-amber" />
                {streak} day · Lv {level.level}
              </button>
            )}
            <Button variant="primary" size="sm" onClick={() => start("daily")}>
              Start free
            </Button>
          </div>
        </div>
      </motion.nav>

      <div>
        {/* Hero */}
        <section className="relative px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-5xl">
            <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-3xl">
              <motion.div variants={up} className="mb-5 flex flex-wrap gap-2">
                <Pill accent="emerald" icon={Heart}>
                  Free forever
                </Pill>
                <Pill accent="cyan" icon={Lock}>
                  No account needed
                </Pill>
                <Pill accent="violet" icon={Microscope}>
                  Research-grade paradigms
                </Pill>
              </motion.div>

              <motion.h1
                variants={hero}
                className="font-display text-4xl leading-[1.08] text-text-primary sm:text-5xl md:text-6xl"
              >
                Find out exactly where
                <br />
                your mind is{" "}
                <span className="text-gradient">weak</span>.
                <br />
                Then fix it.
              </motion.h1>

              <motion.p
                variants={up}
                className="mt-6 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg"
              >
                Eight cognitive domains, measured trial by trial. You get a real diagnostic report —
                percentiles, reaction-time consistency, interference cost, impulsivity — plus a
                28-day protocol built from your own weakest result.
                <span className="text-text-primary"> All of it free, for everyone.</span>
              </motion.p>

              <motion.div variants={up} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button variant="primary" size="lg" magnetic icon={Play} onClick={() => start("daily")}>
                  Start Daily Scan · 3 min
                </Button>
                <Button variant="secondary" size="lg" iconRight={ArrowRight} onClick={() => start("deep")}>
                  Full Deep Scan · 8 min
                </Button>
              </motion.div>

              {hasHistory && (
                <motion.button
                  variants={up}
                  type="button"
                  onClick={() => onNavigate(state.plan ? "train" : "progress")}
                  className="mt-6 flex items-center gap-2 text-sm text-accent-cyan transition-opacity hover:opacity-80"
                >
                  {state.plan ? "Continue your 28-day protocol" : "See your progress"}
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              )}
            </motion.div>

            {/* Stat strip */}
            <motion.div
              variants={up}
              initial="hidden"
              animate="show"
              className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { value: "8", label: "cognitive domains" },
                { value: "40+", label: "metrics per scan" },
                { value: "28", label: "day training protocol" },
                { value: "£0", label: "forever" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl-soft border border-white/[0.07] bg-white/[0.02] p-4 text-center"
                >
                  <div className="font-mono text-2xl text-text-primary md:text-3xl" data-tabular>
                    {stat.value}
                  </div>
                  <div className="mt-1 text-2xs uppercase tracking-wider text-text-tertiary">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* What we measure */}
        <section className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionTitle
              eyebrow="The battery"
              title="Eight domains, not one vague score"
            />
            <p className="mb-7 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Each game is adapted from a paradigm that cognitive scientists actually use. Every
              trial is timed to the millisecond, so the report can tell you not just what you scored
              but which failure mode produced it.
            </p>
            <motion.div
              variants={staggerContainer(0.06)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {DEEP_SCAN.map((key) => (
                <DomainTile key={key} domainKey={key} variants={up} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* The free promise */}
        <section className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-4xl">
            <SectionTitle
              eyebrow="Why this exists"
              title="Everything other apps charge for"
            />
            <p className="mb-7 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Cognitive assessment is not expensive to run. It is expensive to buy, because the
              category learned it could paywall a progress chart. This project exists to put the
              whole thing — assessment, diagnosis, and training — in front of everyone at no cost.
            </p>

            <Card strong className="overflow-hidden p-0">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-white/[0.08] px-4 py-3 text-2xs uppercase tracking-wider text-text-tertiary md:gap-x-6 md:px-6">
                <span>Feature</span>
                <span className="w-20 text-center md:w-32">Typical app</span>
                <span className="w-16 text-center md:w-24">DefogDaily</span>
              </div>
              {COMPARISON.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-white/[0.05] px-4 py-3.5 last:border-0 md:gap-x-6 md:px-6"
                >
                  <span className="text-sm leading-snug text-text-primary">{row.feature}</span>
                  <span className="w-20 text-center text-2xs leading-snug text-text-tertiary md:w-32">
                    {row.them}
                  </span>
                  <span className="grid w-16 place-items-center md:w-24">
                    {row.invert ? (
                      <span className="flex items-center gap-1 text-2xs text-success">
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Never
                      </span>
                    ) : (
                      <Check className="h-4 w-4 text-success" strokeWidth={2.5} />
                    )}
                  </span>
                </div>
              ))}
            </Card>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md" magnetic onClick={() => start("daily")}>
                Try it now — no signup
              </Button>
              <span className="text-xs text-text-tertiary">
                Runs entirely in your browser. Your results stay on your device.
              </span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-5xl">
            <SectionTitle eyebrow="The loop" title="Measure, diagnose, train, re-measure" />
            <motion.div
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="grid gap-4 md:grid-cols-3"
            >
              {[
                {
                  icon: Gauge,
                  step: "01",
                  title: "Scan",
                  body: "Three minutes for the core four, eight for the full battery. Every keystroke is timestamped, so we measure the shape of your performance, not just the total.",
                },
                {
                  icon: Microscope,
                  step: "02",
                  title: "Diagnose",
                  body: "The report names the specific failure mode — flickering attention, a slow brake, expensive switching, weak encoding — and cites the number that proves it.",
                },
                {
                  icon: Target,
                  step: "03",
                  title: "Train",
                  body: "A 28-day protocol targets your weakest domain with progressive drills and daily real-world habits, then re-scans you every seventh day.",
                },
              ].map(({ icon: Icon, step, title, body }) => (
                <motion.div key={step} variants={up}>
                  <Card className="h-full p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl-soft border border-accent-cyan/25 bg-accent-cyan/[0.07]">
                        <Icon className="h-4.5 w-4.5 text-accent-cyan" aria-hidden="true" />
                      </div>
                      <span className="font-mono text-xs text-text-tertiary">{step}</span>
                    </div>
                    <h3 className="font-display text-lg text-text-primary">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Science */}
        <section className="px-4 py-16 md:px-6 md:py-20">
          <div className="mx-auto max-w-4xl">
            <Card className="p-6 md:p-8">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-accent-violet" aria-hidden="true" />
                <span className="eyebrow">Honest about the science</span>
              </div>
              <h2 className="mt-3 font-display text-2xl text-text-primary">
                What this is, and what it is not
              </h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm text-success">
                    <Check className="h-3.5 w-3.5" /> What it does
                  </h3>
                  <ul className="space-y-2 text-sm leading-relaxed text-text-secondary">
                    <li>Measures real cognitive paradigms — Stroop, N-back, Go/No-Go, Corsi, digit span, task switching.</li>
                    <li>Tracks you against yourself over time, which is where the signal actually is.</li>
                    <li>Separates failure modes that look identical in a single score.</li>
                    <li>Trains at the difficulty where adaptation happens, not where it feels good.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm text-warning">
                    <X className="h-3.5 w-3.5" /> What it is not
                  </h3>
                  <ul className="space-y-2 text-sm leading-relaxed text-text-secondary">
                    <li>Not a medical or clinical assessment, and not a diagnosis of anything.</li>
                    <li>Not validated against a clinical sample — percentiles come from a model-based reference distribution.</li>
                    <li>Not a claim that training one domain raises general intelligence. Transfer is narrow and contested.</li>
                    <li>Not a substitute for sleep, exercise, or talking to a doctor if something feels wrong.</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20 md:px-6">
          <div className="mx-auto max-w-4xl">
            <Card strong glow="cyan" className="p-8 text-center md:p-12">
              <Sparkles className="mx-auto h-6 w-6 text-accent-cyan" aria-hidden="true" />
              <h2 className="mt-4 font-display text-3xl leading-tight text-text-primary md:text-4xl">
                Three minutes to find out
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
                No email, no card, no trial that expires. Start the scan and you will have a full
                report before your coffee goes cold.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="primary" size="lg" magnetic icon={Play} onClick={() => start("daily")}>
                  Start Daily Scan
                </Button>
                <Button variant="secondary" size="lg" onClick={() => start("practice")}>
                  Free practice mode
                </Button>
              </div>
            </Card>
          </div>
        </section>
      </div>

      <footer className="border-t border-white/[0.06] px-4 py-10 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <div className="font-display text-lg text-text-primary">
            Defog<span className="text-accent-cyan">Daily</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-text-secondary">
            Clear the fog. Measure what your mind can do today, then do something about it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-2xs text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> No tracking, no ads, no data sales
            </span>
            <a
              href="https://github.com/Aanishnithin07/DefogDaily"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-text-secondary"
            >
              <Github className="h-3 w-3" /> Open source
            </a>
          </div>
          <p className="mt-2 max-w-lg text-2xs leading-relaxed text-text-tertiary">
            DefogDaily is an educational tool, not a medical device. It cannot diagnose any
            condition. If you are worried about your memory or concentration, speak to a doctor.
          </p>
        </div>
      </footer>
    </div>
  );
}
