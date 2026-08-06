import { motion, useReducedMotion } from "framer-motion";
import { fadeInUp, useReducedMotionVariant } from "../../lib/motion";
import { accentOf } from "../ui";

/**
 * Shared chrome for every mini-game: title, timer/progress bar, live stat row,
 * and the screen-reader live region. Keeping this in one place means all eight
 * games stay visually identical apart from their play surface, which matters —
 * a scan should feel like one instrument taking eight readings, not eight apps.
 */
export default function GameShell({
  title,
  subtitle,
  accent = "cyan",
  progress = 1,
  timerLabel,
  stats = [],
  liveMessage,
  footer,
  children,
  className = "",
}) {
  const prefersReducedMotion = useReducedMotion();
  const variants = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
  const a = accentOf(accent);

  return (
    <motion.section
      variants={variants}
      initial="hidden"
      animate="show"
      exit="hidden"
      className={`glass-strong touch-none-safe relative overflow-hidden p-5 md:p-7 ${className}`}
    >
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <header className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base text-text-primary md:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-text-tertiary">{subtitle}</p>}
          </div>
          {timerLabel && (
            <span className={`shrink-0 font-mono text-sm ${a.text}`} data-tabular>
              {timerLabel}
            </span>
          )}
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className={`h-full origin-left rounded-full bg-gradient-to-r ${a.grad}`}
            style={{ scaleX: Math.max(0, Math.min(1, progress)) }}
            transition={{ duration: 0 }}
          />
        </div>
      </header>

      {stats.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-tertiary">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider">{stat.label}</span>
              <span className="font-mono text-sm text-text-primary" data-tabular>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children}

      {footer && <div className="mt-6">{footer}</div>}
    </motion.section>
  );
}

/**
 * Correct/incorrect flash overlay. Shared so feedback timing and intensity are
 * identical across games — inconsistent feedback would bias reaction times.
 */
export function FeedbackFlash({ feedback, prefersReducedMotion }) {
  if (prefersReducedMotion || !feedback?.type) return null;
  return (
    <motion.div
      key={`flash-${feedback.key}`}
      initial={{ opacity: feedback.type === "correct" ? 0.2 : 0.24 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={`pointer-events-none absolute inset-0 rounded-3xl-soft ${
        feedback.type === "correct" ? "bg-success/25" : "bg-danger/25"
      }`}
    />
  );
}
