"use client";
import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { Container } from "@/components/container";
import { Heading } from "@/components/heading";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  { q: "Can anyone see how much I was paid?", a: "No. A confidential transfer publishes the sender and recipient addresses, but the amount field is ciphertext. Only the sender, the recipient and the auditor key for that account can open it." },
  { q: "What does the donor learn?", a: "The total sent from the declared lanes inside the declared window, and how many transfers it covers. Not any single amount, and not who received what." },
  { q: "Can the payer leave a payment out of the total?", a: "Not from the declared lanes inside the window. Every confidential transfer publishes its sender, so the verifier enumerates the round's transfers from the chain, and a withheld one shows up as a transfer the proof does not cover." },
  { q: "Does the total cover everything the payer spent?", a: "No. The guarantee is scoped to transfers from the accounts declared before the round, not to the payer's total spend. A payer can run other accounts that were never declared." },
  { q: "Does Tally prove the recipients are independent of the payer?", a: "No. The proof establishes what amounts moved, not who controls the receiving accounts. That needs recipient attestation, which is future work." },
  { q: "What happens after about seven days?", a: "Stellar's RPC keeps about seven days of events. After that the published round can no longer be enumerated from RPC, and the verifier says so with exit code 3 instead of reporting a failed proof. A durable archive is designed, not built." },
  { q: "Is this on mainnet, and is it audited?", a: "No to both. Everything runs on Stellar testnet, on OpenZeppelin's Confidential Tokens developer preview. Neither Tally nor the confidential-token suite it uses has been audited." },
  { q: "Who would hold the auditor key?", a: "In the planned operator service, the key would be split two-of-three between the issuer, Tally and an independent custodian, so no single party can decrypt alone. That service is designed, not built." },
];

export function FAQ() {
  return (
    <section id="faq" className="relative scroll-mt-24 overflow-hidden py-10 md:py-20 lg:py-28">
      <Container>
        <Heading className="my-10 md:my-16">Questions</Heading>
        <div className="flex flex-col gap-4">
          {QUESTIONS.map((x) => <Question key={x.q} {...x} />)}
        </div>
      </Container>
    </section>
  );
}

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full overflow-hidden rounded-3xl bg-neutral-100 dark:bg-neutral-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-4 text-left md:p-8"
      >
        <h3 className="font-display text-lg font-bold md:text-2xl">{q}</h3>
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-black dark:bg-white" aria-hidden>
          <IconMinus className={cn("absolute inset-0 size-6 text-white transition-all duration-200 dark:text-black", !open && "scale-0 rotate-90")} />
          <IconPlus className={cn("absolute inset-0 size-6 text-white transition-all duration-200 dark:text-black", open && "scale-0 -rotate-90")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.25 }}>
            <p className="px-4 pb-6 font-inter text-neutral-700 dark:text-neutral-300 md:px-8 md:pb-8">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
