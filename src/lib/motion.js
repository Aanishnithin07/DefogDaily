export const fadeInUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

export const blobFloat = {
  initial: { x: 0, y: 0, scale: 1 },
  animate: {
    x: [0, 14, -10, 0],
    y: [0, -10, 10, 0],
    scale: [1, 1.02, 0.99, 1],
    transition: {
      duration: 16,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    },
  },
};

export const springHover = {
  type: "spring",
  stiffness: 400,
  damping: 17,
  mass: 0.8,
};

export const springTap = {
  type: "spring",
  stiffness: 400,
  damping: 17,
  mass: 0.65,
};

export const simpleOpacity = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

// RESERVED for hero headline, countdown GO, and final score reveal only — do not reuse for routine UI transitions.
export const defogReveal = {
  hidden: {
    opacity: 0.2,
    y: 6,
    filter: "blur(12px) saturate(85%)",
  },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px) saturate(100%)",
    transition: { duration: 0.75, ease: [0.2, 0.85, 0.2, 1] },
  },
};

/**
 * Helper for reduced-motion support in components.
 * Usage:
 *   const prefersReducedMotion = useReducedMotion();
 *   const variants = useReducedMotionVariant(prefersReducedMotion, fadeInUp);
 */
export const useReducedMotionVariant = (
  prefersReducedMotion,
  fullVariant,
  reducedVariant = simpleOpacity
) => (prefersReducedMotion ? reducedVariant : fullVariant);
