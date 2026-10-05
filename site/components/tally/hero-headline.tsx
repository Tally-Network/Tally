"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";

/** Agenforce's h1, with the words rising in sequence on load. */
export function HeroHeadline({ words }: { words: string[] }) {
  const reduce = useReducedMotion();
  return (
    <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight font-display md:text-5xl lg:text-6xl">
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block pr-[0.25em]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.05 + i * 0.06 }}
        >
          {w}
        </motion.span>
      ))}
    </h1>
  );
}
