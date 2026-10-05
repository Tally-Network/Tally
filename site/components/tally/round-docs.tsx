/**
 * Round-specific values and output blocks for the docs, rendered from
 * content/generated/facts.json so they follow each scheduled refresh.
 */
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { published, n, verifyOutput, demoDonorOutput, demoSummary, tamperCommands, tamperAlter, tamperReplay, expiredExample } from "@/content/facts";

const blocks = {
  verify: () => verifyOutput(published),
  demo: () => demoDonorOutput(published),
  "demo-summary": () => demoSummary(published),
  tamper: () => tamperCommands(published),
  "tamper-alter": () => tamperAlter(published),
  "tamper-replay": () => tamperReplay(published),
  expired: () => expiredExample(published),
};

/** A code block of output or commands for the published round. */
export function RoundOutput({ kind }: { kind: keyof typeof blocks }) {
  return (
    <CodeBlock>
      <Pre>{blocks[kind]()}</Pre>
    </CodeBlock>
  );
}

const values = {
  dir: () => published.dir,
  published: () => published.published,
  funder: () => published.funder,
  "until-ledger": () => String(published.verifiable_until_ledger),
  "opened-at": () => String(published.run.openedAt),
  "closed-at": () => String(published.run.closedAt),
  lanes: () => String(published.run.lanes),
  transfers: () => String(published.run.inWindow),
  total: () => String(published.run.donorTotal),
  "proof-ms": () => n(published.run.proofMs),
};

/** One value of the published round, inline. */
export function RoundFact({ k, code = false }: { k: keyof typeof values; code?: boolean }) {
  const v = values[k]();
  return code ? <code>{v}</code> : <>{v}</>;
}
