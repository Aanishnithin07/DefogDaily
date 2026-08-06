import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Infinity as InfinityIcon, Sparkles, TrendingDown } from "lucide-react";
import { DEEP_SCAN, DOMAINS, PILLARS } from "../lib/domains";
import { domainMasteryLabel } from "../lib/achievements";
import { percentileFor, ordinal, tierFor } from "../lib/norms";
import { useStore } from "../lib/storage";
import { fadeInUp, staggerContainer } from "../lib/motion";
import { Button, Card, Meter, Pill, SectionTitle, Sparkline, accentOf } from "../components/ui";
import { iconFor } from "../components/ui/icons";

/**
 * Targeted practice. Every domain, unlimited reps, no gate.
 *
 * The list is sorted weakest-first because that is the honest ordering — the
 * fastest gains come from the domain you are worst at, not the one you enjoy.
 */
export default function PracticeScreen({ onBack, onStartDrill }) {
  const profile = useStore((s) => s.profile);
  const age = useStore((s) => s.prefs.age);

  const rows = useMemo(() => {
    return DEEP_SCAN.map((key) => {
      const domain = DOMAINS[key];
      const slot = profile[key] ?? { sessions: 0, best: 0, ema: null, history: [] };
      const level = slot.ema ?? slot.last ?? null;
      const percentile = level != null ? percentileFor(level, key, age) : null;
      return {
        key,
        domain,
        slot,
        level,
        percentile,
        tier: percentile != null ? tierFor(percentile) : null,
        history: (slot.history ?? []).slice(-10).map((h) => h.s),
        untested: slot.sessions === 0,
      };
    }).sort((a, b) => {
      // Untested domains first (you cannot improve what you have not measured),
      // then weakest to strongest.
      if (a.untested !== b.untested) return a.untested ? -1 : 1;
      return (a.level ?? 0) - (b.level ?? 0);
    });
  }, [profile, age]);

  const focus = rows.find((r) => !r.untested) ?? rows[0];

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
          className="flex items-center gap-1.5 text-sm text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </header>

      <motion.div variants={fadeInUp} className="mb-7">
        <p className="eyebrow mb-2">Targeted practice</p>
        <h1 className="font-display text-3xl leading-tight text-text-primary md:text-4xl">
          Train any domain, as often as you like
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
          Every drill adapts to your current level, so you always train at the edge of what you can
          do — the band where adaptation actually happens. No limits, no unlocks, no subscription.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill accent="emerald" icon={InfinityIcon}>
            Unlimited reps
          </Pill>
          <Pill accent="cyan" icon={Sparkles}>
            Adaptive difficulty
          </Pill>
        </div>
      </motion.div>

      {/* Recommended focus */}
      {focus && !focus.untested && (
        <motion.div variants={fadeInUp} className="mb-7">
          <Card strong glow={focus.domain.accent} className="p-5">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-accent-amber" aria-hidden="true" />
              <span className="eyebrow">Recommended focus</span>
            </div>
            <h2 className="mt-2 font-display text-xl text-text-primary">{focus.domain.label}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              Your weakest domain at {Math.round(focus.level)}/100
              {focus.percentile != null ? ` — ${ordinal(focus.percentile)} percentile` : ""}. This is
              where the next points come cheapest.
            </p>
            <Button
              variant="primary"
              size="md"
              magnetic
              className="mt-4"
              iconRight={ArrowRight}
              onClick={() => onStartDrill(focus.key)}
            >
              Drill {focus.domain.short}
            </Button>
          </Card>
        </motion.div>
      )}

      {/* All domains */}
      <motion.section variants={fadeInUp}>
        <SectionTitle eyebrow="All domains" title="Pick your drill" />
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ key, domain, slot, level, percentile, history, untested }) => {
            const Icon = iconFor(domain.icon);
            const a = accentOf(domain.accent);

            return (
              <motion.div key={key} variants={fadeInUp}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl-soft border ${a.border} ${a.soft}`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${a.text}`} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-sm text-text-primary">{domain.label}</h3>
                      <p className="mt-0.5 text-2xs uppercase tracking-wider text-text-tertiary">
                        {PILLARS[domain.pillar].label}
                      </p>
                    </div>
                    {!untested && history.length > 2 && (
                      <Sparkline points={history} accent={domain.accent} width={54} height={22} />
                    )}
                  </div>

                  <p className="mt-3 flex-1 text-xs leading-relaxed text-text-secondary">
                    {domain.tagline}
                  </p>

                  <div className="mt-4">
                    {untested ? (
                      <div className="flex items-center justify-between text-2xs text-text-tertiary">
                        <span>Not yet measured</span>
                        <span>~{domain.duration}s</span>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-2xs uppercase tracking-wider text-text-tertiary">
                            {domainMasteryLabel(level)}
                          </span>
                          <span className={`font-mono text-lg ${a.text}`} data-tabular>
                            {Math.round(level)}
                          </span>
                        </div>
                        <Meter value={percentile ?? level} accent={domain.accent} marker={50} height={5} />
                        <div className="mt-1.5 flex justify-between text-2xs text-text-tertiary">
                          <span>Best {Math.round(slot.best)}</span>
                          <span>
                            {slot.sessions} session{slot.sessions === 1 ? "" : "s"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    variant={untested ? "primary" : "secondary"}
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => onStartDrill(key)}
                  >
                    {untested ? "Measure it" : "Practise"}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <motion.div variants={fadeInUp} className="mt-8">
        <Card className="p-5">
          <h3 className="font-display text-sm text-text-primary">How to practise so it counts</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
              Aim for 65-80% success. Comfortable means you are not training; overwhelmed means you
              are guessing.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
              Short and frequent beats long and rare. Four five-minute sessions a week outperform one
              long one, because the gains consolidate between sessions.
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-cyan" />
              Accuracy first, always. Speed follows accuracy; it does not work the other way round.
            </li>
          </ul>
        </Card>
      </motion.div>
    </motion.div>
  );
}
