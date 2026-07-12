import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { Brain, ShieldCheck, Sparkles } from "lucide-react";
import {
  blobFloat,
  defogReveal,
  fadeInUp,
  springHover,
  springTap,
  staggerContainer,
  useReducedMotionVariant,
} from "./lib/motion";
import { trackEvent } from "./lib/analytics";

const VALUE_PROPS_ID = "value-props";

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
};

const GamePreviewMock = () => (
  <div className="relative h-64 w-full overflow-hidden rounded-3xl-soft border border-white/10 bg-bg-card/50 p-5 backdrop-blur-xl md:h-80">
    <div className="mb-4 font-display text-sm tracking-[0.2em] text-text-secondary">
      PREVIEW
    </div>
    <div className="space-y-3">
      {["17", "42", "88", "13", "96"].map((n, idx) => (
        <div
          key={n}
          className={`flex h-10 items-center justify-between rounded-2xl-soft border border-white/10 px-4 ${
            idx % 2 === 0 ? "bg-accent-cyan/10" : "bg-bg-elevated/70"
          }`}
        >
          <span className="font-mono text-lg text-text-primary">{n}</span>
          <span className="text-xs text-text-secondary">ODD / EVEN</span>
        </div>
      ))}
    </div>
  </div>
);

const ValuePropCard = ({ icon: Icon, title, body, className = "", variants }) => (
  <motion.article
    variants={variants}
    whileHover={{ y: -4, transition: { duration: 0.18, ease: "easeOut" } }}
    className={`rounded-3xl-soft border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-shadow hover:shadow-glow-violet ${className}`}
  >
    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl-soft bg-bg-elevated shadow-glow-cyan">
      <Icon className="h-5 w-5 text-accent-cyan" aria-hidden="true" />
    </div>
    <h3 className="mb-2 font-display text-xl text-text-primary">{title}</h3>
    <p className="font-body text-sm leading-relaxed text-text-secondary">{body}</p>
  </motion.article>
);

export default function Landing({ onStartScan }) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const allowSpatialMotion = !prefersReducedMotion && !isMobile;
  const heroRef = useRef(null);

  const { scrollY } = useScroll();
  const navProgress = useTransform(scrollY, [0, 80], [0, 1], { clamp: true });
  const navBgOpacity = useTransform(navProgress, [0, 1], [0, 0.78]);
  const navBorderOpacity = useTransform(navProgress, [0, 1], [0, 0.15]);
  const navBlur = useTransform(navProgress, [0, 1], [0, 20]);

  const navBackground = useMotionTemplate`rgba(11, 14, 20, ${navBgOpacity})`;
  const navBorder = useMotionTemplate`rgba(245, 248, 255, ${navBorderOpacity})`;
  const navBackdrop = useMotionTemplate`blur(${navBlur}px)`;

  const fogYNear = useTransform(scrollY, [0, 800], [0, -90]);
  const fogYFar = useTransform(scrollY, [0, 800], [0, -40]);

  const magnetX = useMotionValue(0);
  const magnetY = useMotionValue(0);
  const springX = useSpring(magnetX, springHover);
  const springY = useSpring(magnetY, springHover);

  const heroHeadlineVariant = useReducedMotionVariant(prefersReducedMotion, defogReveal);
  const staggerHero = useMemo(() => staggerContainer(0.08, 0.16), []);
  const revealUp = useReducedMotionVariant(prefersReducedMotion, fadeInUp);

  const onPrimaryMouseMove = (event) => {
    if (!allowSpatialMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / rect.width - 0.5;
    const localY = (event.clientY - rect.top) / rect.height - 0.5;
    magnetX.set(localX * 10);
    magnetY.set(localY * 8);
  };

  const onPrimaryMouseLeave = () => {
    magnetX.set(0);
    magnetY.set(0);
  };

  const scrollToValueProps = () => {
    const target = document.getElementById(VALUE_PROPS_ID);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-bg-base font-body text-text-primary">
      <svg className="absolute h-0 w-0">
        <filter id="defog-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="8">
            {!prefersReducedMotion && (
              <animate
                attributeName="baseFrequency"
                dur="10s"
                values="0.85;0.95;0.85"
                repeatCount="indefinite"
              />
            )}
          </feTurbulence>
        </filter>
      </svg>

      <motion.nav
        style={{
          backgroundColor: navBackground,
          borderBottomColor: navBorder,
          backdropFilter: navBackdrop,
        }}
        className="sticky top-0 z-40 border-b border-transparent"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-8">
          <span className="font-display text-lg tracking-wide text-text-primary">DefogDaily</span>
          <button
            type="button"
            onClick={() => {
              trackEvent("cta_clicked", { location: "hero" });
              onStartScan();
            }}
            className="min-h-11 rounded-2xl-soft border border-white/10 px-4 text-sm text-text-primary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
          >
            Start Scan
          </button>
        </div>
      </motion.nav>

      <main>
        <section
          ref={heroRef}
          className="relative isolate overflow-hidden px-5 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16"
        >
          <motion.div
            aria-hidden="true"
            variants={allowSpatialMotion ? blobFloat : undefined}
            initial={allowSpatialMotion ? "initial" : false}
            animate={allowSpatialMotion ? "animate" : false}
            style={{ y: allowSpatialMotion ? fogYFar : 0 }}
            className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-accent-cyan/20 blur-3xl"
          />
          <motion.div
            aria-hidden="true"
            variants={allowSpatialMotion ? blobFloat : undefined}
            initial={allowSpatialMotion ? "initial" : false}
            animate={allowSpatialMotion ? "animate" : false}
            style={{ y: allowSpatialMotion ? fogYNear : 0 }}
            className="pointer-events-none absolute right-[-4rem] top-20 h-80 w-80 rounded-full bg-accent-violet/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ filter: "url(#defog-noise)" }}
          />

          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
            <motion.div
              variants={staggerHero}
              initial="hidden"
              animate="show"
              className="relative z-10"
            >
              <motion.h1
                variants={heroHeadlineVariant}
                className="max-w-xl font-display text-4xl leading-tight text-text-primary sm:text-5xl md:text-6xl"
              >
                Upgrade your{" "}
                <motion.span
                  variants={{
                    hidden: heroHeadlineVariant.hidden,
                    show: {
                      ...heroHeadlineVariant.show,
                      transition: {
                        ...heroHeadlineVariant.show.transition,
                        delay: prefersReducedMotion ? 0 : 0.22,
                      },
                    },
                  }}
                  animate={!prefersReducedMotion ? { backgroundPositionX: ["0%", "100%", "0%"] } : {}}
                  transition={!prefersReducedMotion ? { duration: 6, ease: "easeInOut", repeat: Infinity } : {}}
                  className="bg-gradient-to-r from-accent-cyan via-text-primary to-accent-violet bg-[length:220%_220%] bg-clip-text text-transparent"
                >
                  working memory.
                </motion.span>
              </motion.h1>

              <motion.p
                variants={revealUp}
                className="mt-5 max-w-lg text-base leading-relaxed text-text-secondary md:text-lg"
              >
                A 3-minute cognitive calibration built for signal, not noise. Measure speed,
                recall, and focus with game mechanics grounded in real paradigms.
              </motion.p>

              <motion.div variants={revealUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={() => {
                    trackEvent("cta_clicked", { location: "value_props" });
                    onStartScan();
                  }}
                  onMouseMove={onPrimaryMouseMove}
                  onMouseLeave={onPrimaryMouseLeave}
                  whileTap={allowSpatialMotion ? { scale: 0.98 } : undefined}
                  transition={springTap}
                  style={{
                    x: allowSpatialMotion ? springX : 0,
                    y: allowSpatialMotion ? springY : 0,
                  }}
                  className="min-h-11 rounded-2xl-soft bg-accent-cyan px-6 py-3 font-medium text-bg-base shadow-glow-cyan transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
                >
                  Start Your Free Brain Scan
                </motion.button>
                <button
                  type="button"
                  onClick={scrollToValueProps}
                  className="min-h-11 rounded-2xl-soft border border-white/15 px-6 py-3 text-text-primary transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
                >
                  See How It Works
                </button>
              </motion.div>
            </motion.div>

            <motion.div variants={revealUp} initial="hidden" animate="show" className="relative z-10">
              <GamePreviewMock />
            </motion.div>
          </div>
        </section>

        <section id={VALUE_PROPS_ID} className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <motion.div
            variants={staggerContainer(0.1, 0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="grid gap-4 md:grid-cols-3"
          >
            <ValuePropCard
              variants={revealUp}
              className="md:col-span-2"
              icon={Sparkles}
              title="AI-generated puzzles that never repeat"
              body="Each run creates fresh odd/even, dual-recall, and spatial-load combinations so you measure cognition, not memorization."
            />
            <ValuePropCard
              variants={revealUp}
              icon={Brain}
              title="3 minutes, high signal"
              body="Fast enough for daily use, strict enough to reveal drift in attention and working-memory sharpness."
            />
            <ValuePropCard
              variants={revealUp}
              icon={ShieldCheck}
              title="100% free, forever"
              body="No signup wall, no paywalled metrics. Run it, share it, and compare over time."
            />
          </motion.div>
        </section>

        <section className="border-y border-white/10 bg-bg-elevated/45 px-5 py-4 md:px-8">
          <p className="mx-auto max-w-6xl text-center text-sm text-text-secondary">
            Built on N-back and dual-task recall paradigms from cognitive psychology
            research.
          </p>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-5 py-8 md:px-8">
        <div className="font-display text-lg text-text-primary">DefogDaily</div>
        <p className="text-sm text-text-secondary">
          Clear the fog. Measure what your mind can do today.
        </p>
      </footer>
    </div>
  );
}
