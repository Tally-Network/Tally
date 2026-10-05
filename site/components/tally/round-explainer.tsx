"use client";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconCircleCheck, IconLock, IconPlayerPause, IconPlayerPlay, IconFileCertificate } from "@tabler/icons-react";
import { round, transfers, short, n } from "@/content/facts";
import { cn } from "@/lib/utils";

/**
 * One round, animated: Alice declares it, transfers land on-chain as sealed
 * ciphertext, Dave verifies the total off-chain. Addresses and ciphertext are
 * round-004's real on-chain values; the names are illustrative. No amount is
 * ever drawn on the chain side.
 */
const NAMES = ["Bob", "Charlie", "Erin", "Frank", "Grace"];
const SHOWN = transfers.slice(0, 5);
const LAST = SHOWN.length + 2; // declare, 5 transfers, sealed summary, donor
const TOTAL = 3160; // evidence/README.md: "TOTAL DISBURSED: 3160"

export function RoundExplainer({ still = false, className }: { still?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const fixed = still || !!reduce;
  const [step, setStep] = useState(fixed ? LAST + 1 : 0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (fixed || paused) return;
    const wait = step === 0 ? 1200 : step <= SHOWN.length ? 900 : step === LAST + 1 ? 3200 : 1100;
    const t = setTimeout(() => setStep((s) => (s > LAST ? 0 : s + 1)), wait);
    return () => clearTimeout(t);
  }, [step, paused, fixed]);

  const landed = (i: number) => step >= i + 1;
  const sealedAll = step >= SHOWN.length + 1;
  const verified = step >= LAST;

  return (
    <div className={cn("relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr_1fr]", className)}>
      {/* Payer */}
      <div className={cn("rounded-3xl bg-neutral-50 p-6 ring-1 ring-inset transition-shadow dark:bg-neutral-800", !fixed && step <= 1 ? "ring-primary/50" : "ring-transparent")}>
        <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Payer · on-chain</p>
        <p className="mt-3 font-display text-xl font-bold">Alice declares the round</p>
        <p className="mt-2 font-inter text-sm text-neutral-600 dark:text-neutral-400">
          {round.chain.lanes} lanes and a ledger window, recorded in the round registry before anything is paid.
        </p>
        <div className="mt-4 flex gap-2" aria-hidden>
          {Array.from({ length: round.chain.lanes }).map((_, i) => (
            <span key={i} className={cn("size-3 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-600")} />
          ))}
        </div>
        <p className="mt-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">window [{round.chain.openedAt}, {round.chain.closedAt}]</p>
      </div>

      {/* Chain */}
      <div className={cn("rounded-3xl bg-neutral-50 p-6 ring-1 ring-inset transition-shadow dark:bg-neutral-800", !fixed && step > 1 && !verified ? "ring-primary/50" : "ring-transparent")}>
        <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Stellar testnet · what anyone can read</p>
        <ul className="mt-3 space-y-2">
          {SHOWN.map((t, i) => (
            <li key={t.txHash} className="relative overflow-hidden rounded-lg bg-white px-3 py-2 dark:bg-neutral-900">
              {!fixed && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  initial={false}
                  animate={{ width: landed(i) ? "100%" : step === i ? "40%" : "0%" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-inter text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="font-medium">{NAMES[i]}</span>{" "}
                  <span className="font-mono text-neutral-600 dark:text-neutral-400">{short(t.to)}</span>
                </span>
                <AnimatePresence initial={false}>
                  {landed(i) && (
                    <motion.span
                      key="sealed"
                      initial={fixed ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex shrink-0 items-center gap-1 rounded-md bg-sealed-dim px-2 py-0.5 font-mono text-xs text-sealed"
                    >
                      <IconLock className="size-3" aria-hidden />
                      {t.vTilde.slice(0, 8)}…{t.vTilde.slice(-4)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </li>
          ))}
        </ul>
        <p className={cn("mt-3 font-inter text-xs text-neutral-600 dark:text-neutral-400 transition-opacity", sealedAll ? "opacity-100" : "opacity-0")}>
          {transfers.length} transfers in the window. Each amount field is ciphertext; the chain never holds an amount in plaintext.
        </p>
      </div>

      {/* Donor */}
      <div className={cn("rounded-3xl bg-neutral-50 p-6 ring-1 ring-inset transition-shadow dark:bg-neutral-800", !fixed && verified ? "ring-primary/50" : "ring-transparent")}>
        <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Donor · off-chain, on Dave&apos;s machine</p>
        <p className="mt-3 flex items-center gap-2 font-inter text-sm text-neutral-600 dark:text-neutral-400">
          <IconFileCertificate className="size-4" aria-hidden /> One zero-knowledge proof, 16,224 B, answering Dave&apos;s own challenge
        </p>
        <p className={cn("mt-4 flex items-center gap-2 font-display text-4xl font-bold text-primary transition-opacity", verified ? "opacity-100" : "opacity-0")}>
          <IconCircleCheck className="size-8" aria-hidden /> {n(TOTAL)}
        </p>
        <p className={cn("mt-2 font-inter text-sm text-neutral-600 transition-opacity dark:text-neutral-400", verified ? "opacity-100" : "opacity-0")}>
          Verified total from the {round.chain.lanes} declared lanes in {round.dir}, over {transfers.length} transfers. No individual amount revealed.
        </p>
      </div>

      {!fixed && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="absolute -top-12 right-0 inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 font-inter text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          aria-label={paused ? "Play the round animation" : "Pause the round animation"}
        >
          {paused ? <IconPlayerPlay className="size-3.5" /> : <IconPlayerPause className="size-3.5" />}
          {paused ? "Play" : "Pause"}
        </button>
      )}
    </div>
  );
}
