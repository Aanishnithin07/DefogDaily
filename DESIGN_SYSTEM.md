# DefogDaily Design System (Phase 0)

## Brand Principle
DefogDaily is not "generic AI dark mode." Every visual choice should map to one of three ideas: **fog**, **clarity**, or **precision measurement**. If a choice could belong to any AI product, refine it until it feels specific to DefogDaily's promise: clearing mental fog into clarity.

## Color Tokens
- **Background**
  - `bg.base`: `#0B0E14` (primary canvas; deep, cool, not pure black)
  - `bg.elevated`: `#121827` (raised sections/panels)
  - `bg.card`: `#182033` (glass-card backing)
- **Accent**
  - `accent.cyan`: `#3ED9D5` (clarity/active signal)
  - `accent.violet`: `#8A7BFF` (depth/focus signal)
- **Feedback**
  - `success`: `#32D583` (correct/success states)
  - `danger`: `#F97066` (error/fail states)
- **Text**
  - `text.primary`: `#F5F8FF`
  - `text.secondary`: `#9AA7C2`

### Glow Usage
- `shadow-glow-cyan`: use for active/interactive emphasis and "clarity reached" moments.
- `shadow-glow-violet`: use for ambient depth, secondary emphasis, and layered atmosphere.

## Shape & Surfaces
- `rounded-2xl-soft`: `1.1rem`
- `rounded-3xl-soft`: `1.6rem`

Use soft radii consistently to preserve a native-app, tactile feel.

## Typography Roles
- `font-display` (Space Grotesk): headlines and key identity copy.
- `font-body` (Inter): all body/UI copy for readability.
- `font-mono` (JetBrains Mono / IBM Plex Mono fallback): timers, scores, reaction-time values, and any precision metric.

## Motion Foundation
- Shared variants live in `src/lib/motion.js`: `fadeInUp`, `fadeIn`, `scaleIn`, `staggerContainer`, `blobFloat`.
- Touch interactions use spring presets:
  - `springHover` and `springTap` (`stiffness: 400`, `damping: 17`).
- Ambient movement uses slow eased loops (`blobFloat`) only for background context.
- Respect reduced motion via `useReducedMotionVariant(prefersReducedMotion, fullVariant)`.

## Signature Defog Reveal Rule
`defogReveal` is reserved for exactly three moments:
1. Hero headline on load
2. Countdown "GO!"
3. Final score reveal

It starts slightly blurred/desaturated and resolves to sharp/full color. Do not reuse this variant for routine transitions.
