"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

/**
 * Eased scroll reveal. Content is visible in the server HTML; the fade-up is
 * armed only for blocks that start below the fold, and never when the reader
 * prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    if (r && r.top > window.innerHeight) setArmed(true);
  }, [reduce]);
  const hidden = armed && !inView;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={hidden ? { opacity: 0, y: 12 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
