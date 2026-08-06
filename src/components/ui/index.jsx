/**
 * The DefogDaily UI kit.
 *
 * One place for every surface, control, and readout so the whole product reads
 * as a single instrument. Tailwind cannot build class names at runtime, so
 * accents resolve through the explicit ACCENT map below rather than string
 * interpolation.
 */

import { forwardRef, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, animate } from "framer-motion";
import { cue, primeAudio } from "../../lib/feedback";

export const ACCENT = {
  cyan: {
    hex: "#3ED9D5",
    text: "text-accent-cyan",
    bg: "bg-accent-cyan",
    soft: "bg-accent-cyan/10",
    border: "border-accent-cyan/40",
    glow: "shadow-glow-cyan",
    ring: "focus-visible:ring-accent-cyan",
    grad: "from-accent-cyan to-accent-cyan-dim",
  },
  violet: {
    hex: "#8A7BFF",
    text: "text-accent-violet",
    bg: "bg-accent-violet",
    soft: "bg-accent-violet/10",
    border: "border-accent-violet/40",
    glow: "shadow-glow-violet",
    ring: "focus-visible:ring-accent-violet",
    grad: "from-accent-violet to-accent-violet-dim",
  },
  amber: {
    hex: "#FFB454",
    text: "text-accent-amber",
    bg: "bg-accent-amber",
    soft: "bg-accent-amber/10",
    border: "border-accent-amber/40",
    glow: "shadow-glow-amber",
    ring: "focus-visible:ring-accent-amber",
    grad: "from-accent-amber to-warning",
  },
  emerald: {
    hex: "#3DDC97",
    text: "text-accent-emerald",
    bg: "bg-accent-emerald",
    soft: "bg-accent-emerald/10",
    border: "border-accent-emerald/40",
    glow: "shadow-glow-emerald",
    ring: "focus-visible:ring-accent-emerald",
    grad: "from-accent-emerald to-success",
  },
  rose: {
    hex: "#FF6B8A",
    text: "text-accent-rose",
    bg: "bg-accent-rose",
    soft: "bg-accent-rose/10",
    border: "border-accent-rose/40",
    glow: "shadow-glow-rose",
    ring: "focus-visible:ring-accent-rose",
    grad: "from-accent-rose to-danger",
  },
  slate: {
    hex: "#9AA7C2",
    text: "text-text-secondary",
    bg: "bg-white/10",
    soft: "bg-white/5",
    border: "border-white/15",
    glow: "",
    ring: "focus-visible:ring-white/40",
    grad: "from-white/30 to-white/10",
  },
};

export const accentOf = (key) => ACCENT[key] ?? ACCENT.cyan;

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export const Card = forwardRef(function Card(
  { as: Tag = "div", className = "", strong = false, glow = null, children, ...rest },
  ref
) {
  const glowClass = glow ? accentOf(glow).glow : "";
  return (
    <Tag
      ref={ref}
      className={`${strong ? "glass-strong" : "glass"} ${glowClass} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export function SectionTitle({ eyebrow, title, action, className = "" }) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="font-display text-xl text-text-primary md:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, accent = "slate", className = "", icon: Icon }) {
  const a = accentOf(accent);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${a.border} ${a.soft} px-2.5 py-1 text-2xs font-medium uppercase tracking-wider ${a.text} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary:
    "bg-accent-cyan text-bg-void shadow-glow-cyan hover:brightness-110 active:brightness-95 font-semibold",
  violet:
    "bg-accent-violet text-bg-void shadow-glow-violet hover:brightness-110 active:brightness-95 font-semibold",
  secondary:
    "border border-white/15 bg-white/[0.04] text-text-primary hover:bg-white/[0.09] backdrop-blur-xl",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-white/[0.06]",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
};

const BUTTON_SIZES = {
  sm: "min-h-9 px-3.5 text-sm rounded-xl-soft",
  md: "min-h-11 px-5 text-sm rounded-2xl-soft",
  lg: "min-h-14 px-7 text-base rounded-2xl-soft",
};

/**
 * The one button. Adds a magnetic pull on pointer devices, a spring tap, and
 * an audio cue — the three things that make a web app feel native.
 */
export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    magnetic = false,
    sound = "tap",
    className = "",
    children,
    onClick,
    ...rest
  },
  ref
) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 320, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 320, damping: 20, mass: 0.6 });
  const allowMagnet = magnetic && !reduced;

  return (
    <motion.button
      ref={ref}
      type="button"
      style={allowMagnet ? { x: sx, y: sy } : undefined}
      onPointerMove={
        allowMagnet
          ? (event) => {
              if (event.pointerType !== "mouse") return;
              const rect = event.currentTarget.getBoundingClientRect();
              x.set(((event.clientX - rect.left) / rect.width - 0.5) * 12);
              y.set(((event.clientY - rect.top) / rect.height - 0.5) * 8);
            }
          : undefined
      }
      onPointerLeave={
        allowMagnet
          ? () => {
              x.set(0);
              y.set(0);
            }
          : undefined
      }
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17, mass: 0.65 }}
      onClick={(event) => {
        primeAudio();
        if (sound) cue(sound);
        onClick?.(event);
      }}
      className={`inline-flex items-center justify-center gap-2 transition-colors duration-200 ease-defog touch-none-safe disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </motion.button>
  );
});

export function IconButton({ icon: Icon, label, onClick, active = false, className = "" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        primeAudio();
        cue("tap");
        onClick?.(event);
      }}
      className={`grid h-10 w-10 place-items-center rounded-xl-soft border transition-colors duration-200 focus-visible:outline-none ${
        active
          ? "border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan"
          : "border-white/10 bg-white/[0.03] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary"
      } ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Readouts
 * ------------------------------------------------------------------ */

/** Animated numeric counter that never reflows (tabular numerals). */
export function CountUp({ value, duration = 1.4, decimals = 0, className = "" }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return undefined;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  return (
    <span className={className} data-tabular>
      {Number(display).toFixed(decimals)}
    </span>
  );
}

/** Circular gauge. Used for the composite score and per-domain rings. */
export function ScoreRing({
  value,
  max = 100,
  size = 180,
  stroke = 10,
  accent = "cyan",
  trackOpacity = 0.08,
  children,
  label,
}) {
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(max, value));
  const offset = circumference * (1 - clamped / max);
  const a = accentOf(accent);
  const gradientId = `ring-${accent}-${size}`;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={a.hex} />
            <stop offset="100%" stopColor={ACCENT.violet.hex} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F5F8FF"
          strokeOpacity={trackOpacity}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduced ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 1.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${a.hex}55)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/**
 * Horizontal meter with an optional population marker.
 * `marker` draws a tick at a reference percentage (we use the 50th percentile).
 */
export function Meter({ value, max = 100, accent = "cyan", marker = null, height = 8, className = "" }) {
  const reduced = useReducedMotion();
  const a = accentOf(accent);
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`} style={{ height }}>
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${a.grad}`}
        initial={{ width: reduced ? `${pct}%` : 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      {marker != null && (
        <div
          className="absolute top-0 h-full w-px bg-text-primary/45"
          style={{ left: `${Math.max(0, Math.min(100, marker))}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** Compact metric tile: label, big value, optional delta and footnote. */
export function Stat({ label, value, unit, delta = null, hint, accent = "cyan", icon: Icon, className = "" }) {
  const a = accentOf(accent);
  const deltaPositive = typeof delta === "number" && delta > 0;
  const deltaNeutral = typeof delta === "number" && Math.abs(delta) < 0.5;

  return (
    <div className={`rounded-2xl-soft border border-white/[0.07] bg-white/[0.03] p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-3.5 w-3.5 ${a.text}`} aria-hidden="true" />}
        <span className="text-2xs uppercase tracking-wider text-text-tertiary">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl text-text-primary" data-tabular>
          {value}
        </span>
        {unit && <span className="text-xs text-text-tertiary">{unit}</span>}
        {typeof delta === "number" && !deltaNeutral && (
          <span
            className={`ml-auto font-mono text-xs ${deltaPositive ? "text-success" : "text-danger"}`}
          >
            {deltaPositive ? "+" : ""}
            {Math.round(delta)}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-snug text-text-tertiary">{hint}</p>}
    </div>
  );
}

/** Tiny inline trend line. Pure SVG, no chart library. */
export function Sparkline({ points = [], accent = "cyan", width = 96, height = 28, className = "" }) {
  const a = accentOf(accent);
  if (points.length < 2) {
    return <div className={`h-[${height}px] ${className}`} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 4) - 2]);
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${accent}-${points.length}-${Math.round(min)}`;

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={a.hex} stopOpacity="0.28" />
          <stop offset="100%" stopColor={a.hex} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={a.hex} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="2.5" fill={a.hex} />
    </svg>
  );
}

/** Progress dots for multi-step flows. */
export function StepDots({ total, current, className = "" }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <motion.span
          key={i}
          animate={{
            width: i === current ? 22 : 6,
            opacity: i <= current ? 1 : 0.28,
          }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className={`h-1.5 rounded-full ${i <= current ? "bg-accent-cyan" : "bg-white/25"}`}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

export function Toast({ message, onDone, duration = 2800, icon: Icon }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => onDone?.(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onDone]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-2xl-soft border border-white/12 bg-bg-raised/95 px-4 py-3 text-sm text-text-primary shadow-lift-lg backdrop-blur-xl md:bottom-10"
        >
          {Icon && <Icon className="h-4 w-4 shrink-0 text-accent-cyan" aria-hidden="true" />}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Toast state hook so screens do not each reinvent it. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = (message, icon = null) => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ message, icon });
  };

  useEffect(() => () => timer.current && window.clearTimeout(timer.current), []);

  return {
    toast,
    show,
    clear: () => setToast(null),
    node: <Toast message={toast?.message} icon={toast?.icon} onDone={() => setToast(null)} />,
  };
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="grid place-items-center rounded-3xl-soft border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl-soft border border-white/10 bg-white/[0.04]">
          <Icon className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-lg text-text-primary">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Expandable disclosure used throughout the report for "why this matters". */
export function Disclosure({ summary, children, defaultOpen = false, accent = "slate" }) {
  const [open, setOpen] = useState(defaultOpen);
  const a = accentOf(accent);

  return (
    <div className="overflow-hidden rounded-2xl-soft border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="no-print flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none"
      >
        <span className={`text-sm font-medium ${open ? a.text : "text-text-secondary"}`}>{summary}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="text-text-tertiary"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            data-print-expand
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-white/[0.06] px-4 py-3 text-sm leading-relaxed text-text-secondary">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
