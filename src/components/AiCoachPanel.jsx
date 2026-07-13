import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { generateCoachInsight } from "../lib/ai";
import { fadeInUp, useReducedMotionVariant } from "../lib/motion";

export default function AiCoachPanel({ scores }) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const upVariant = useReducedMotionVariant(prefersReducedMotion, fadeInUp);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateCoachInsight(scores).then((res) => {
      if (isMounted) {
        setInsight(res);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [scores]);

  return (
    <motion.div
      variants={upVariant}
      className="mt-10 w-full max-w-2xl overflow-hidden rounded-3xl-soft border border-white/10 bg-bg-elevated p-[1px] relative shadow-glow-cyan"
    >
      {/* Animated gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/20 via-accent-violet/20 to-accent-cyan/20 animate-pulse opacity-50" />
      
      <div className="relative flex w-full flex-col items-start gap-4 rounded-[1.5rem] bg-bg-card p-6 backdrop-blur-xl md:flex-row md:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg-elevated shadow-glow-violet">
          <Sparkles className="h-6 w-6 text-accent-violet" />
        </div>
        
        <div className="flex-1">
          <h3 className="mb-1 font-display font-medium text-text-primary">Defog AI Coach</h3>
          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
              <p className="mt-1 text-xs text-text-secondary">Synthesizing cognitive baseline...</p>
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm leading-relaxed text-text-secondary"
            >
              {insight}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
