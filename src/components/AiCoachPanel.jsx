import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { generateCoachInsight, isAiConfigured } from "../lib/ai";
import { Card } from "./ui";

/**
 * The coach briefing. Uses Firebase AI Logic when configured, and a locally
 * composed briefing built from the same report when it is not — so the panel
 * always says something useful, key or no key.
 */
export default function AiCoachPanel({ report }) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    generateCoachInsight(report).then((text) => {
      if (!alive) return;
      setInsight(text);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [report]);

  const paragraphs = insight.split("\n").filter(Boolean);

  return (
    <Card strong className="relative overflow-hidden p-6">
      {/* Slow sheen along the top edge marks this as the generated panel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px animate-sheen-sweep bg-[linear-gradient(90deg,transparent,rgba(62,217,213,0.8),transparent)] bg-[length:200%_100%]"
      />

      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl-soft border border-accent-violet/25 bg-accent-violet/10">
          <Sparkles className="h-4.5 w-4.5 text-accent-violet" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base text-text-primary">Defog Coach</h3>
            <span className="text-2xs uppercase tracking-wider text-text-tertiary">
              {isAiConfigured() ? "AI briefing" : "Rule-based briefing"}
            </span>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-11/12" />
              <div className="skeleton h-3.5 w-4/6" />
              <p className="pt-1 text-2xs text-text-tertiary">Reading your trial data…</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2.5 space-y-2.5"
            >
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-text-secondary">
                  {paragraph}
                </p>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </Card>
  );
}
