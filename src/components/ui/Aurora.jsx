import { useReducedMotion } from "framer-motion";

/**
 * The ambient backdrop for the whole app: a slow aurora of blurred colour
 * fields over a faint measurement grid, with a fog-noise layer on top.
 *
 * Rendered once at the shell level and fixed behind everything, so it costs a
 * single composited layer rather than one per screen. All motion is CSS
 * keyframes on transform only, which keeps it off the main thread, and the
 * whole animation stops for anyone who has asked for reduced motion.
 */
export default function Aurora({ intensity = 1, tone = "default" }) {
  const reduced = useReducedMotion();

  const tones = {
    default: ["bg-accent-cyan/20", "bg-accent-violet/20", "bg-accent-cyan/10"],
    focus: ["bg-accent-violet/25", "bg-accent-cyan/15", "bg-accent-violet/10"],
    success: ["bg-accent-emerald/20", "bg-accent-cyan/20", "bg-accent-emerald/10"],
    alert: ["bg-accent-amber/20", "bg-accent-rose/15", "bg-accent-amber/10"],
  };
  const [a, b, c] = tones[tone] ?? tones.default;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg-base" />

      {/* Measurement grid — the "precision instrument" half of the brand. */}
      <div
        className="absolute inset-0 bg-grid-fade bg-grid opacity-[0.55]"
        style={{
          maskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, #000 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 60% at 50% 0%, #000 20%, transparent 75%)",
        }}
      />

      <div
        className={`absolute -left-[15%] -top-[10%] h-[55vh] w-[55vh] rounded-full blur-[110px] ${a} ${
          reduced ? "" : "animate-aurora-drift"
        }`}
        style={{ opacity: 0.9 * intensity }}
      />
      <div
        className={`absolute -right-[12%] top-[5%] h-[60vh] w-[60vh] rounded-full blur-[120px] ${b} ${
          reduced ? "" : "animate-aurora-drift"
        }`}
        style={{ opacity: 0.85 * intensity, animationDelay: "-7s" }}
      />
      <div
        className={`absolute bottom-[-20%] left-[25%] h-[50vh] w-[50vh] rounded-full blur-[130px] ${c} ${
          reduced ? "" : "animate-aurora-drift"
        }`}
        style={{ opacity: 0.7 * intensity, animationDelay: "-14s" }}
      />

      {/* Vignette keeps the centre readable no matter where the blobs drift. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,7,12,0.82)_100%)]" />

      {/* Fog grain. Static SVG turbulence — cheap, and it kills gradient banding. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.16] mix-blend-overlay">
        <filter id="aurora-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="11" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#aurora-grain)" />
      </svg>
    </div>
  );
}
