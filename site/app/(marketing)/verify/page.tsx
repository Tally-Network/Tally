import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Heading } from "@/components/heading";
import { Subheading } from "@/components/subheading";
import { Verifier, VERIFY_SOURCE } from "@/components/tally/verifier";

export const metadata: Metadata = {
  title: "Verify this round",
  description: "Check Tally's published testnet round in your browser: the round and its transfers from Soroban RPC, the public inputs rebuilt from chain state, and the aggregate proof verified with bb.js.",
};

export default function VerifyPage() {
  return (
    <Container className="py-10 md:py-20">
      <Heading as="h1">Verify this round</Heading>
      <Subheading className="mt-6 max-w-3xl">
        Check the published round without cloning anything. Your browser reads the round and its transfers from Stellar
        testnet RPC, rebuilds every public input from chain state, and verifies the zero-knowledge proof with bb.js.
        Nothing runs on our servers.
      </Subheading>
      <p className="mt-4 max-w-3xl font-inter text-sm text-neutral-600 dark:text-neutral-400">
        This page runs the same code as <code className="font-mono">tally verify</code>:{" "}
        <a className="text-primary underline-offset-4 hover:underline" href={VERIFY_SOURCE}>verify/core.ts</a>. The first run
        downloads bb.js (about 2.5 MB) and a 2 MB reference string. See{" "}
        <Link className="text-primary underline-offset-4 hover:underline" href="/docs/guides/verify-in-browser">how it works</Link>.
      </p>
      <div className="mt-10 md:mt-14">
        <Verifier />
      </div>
    </Container>
  );
}
