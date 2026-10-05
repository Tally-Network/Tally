import React from "react";
import Link from "next/link";
import {
  IconBuildingBank, IconCalendarDollar, IconCash, IconCircleCheck, IconCircleX, IconCode, IconFileCertificate,
  IconFileInvoice, IconGift, IconHeartHandshake, IconKey, IconListCheck, IconLock, IconReceiptTax, IconShieldCheck,
  IconTrophy, IconUser, IconUsersGroup, IconEye, IconEyeOff, IconFingerprint, IconSearch, IconLayersIntersect,
  IconArrowRight, IconAlertTriangle,
} from "@tabler/icons-react";
import { Container } from "@/components/container";
import { Heading } from "@/components/heading";
import { Subheading } from "@/components/subheading";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { RoundExplainer } from "./round-explainer";
import { CopyButton } from "./copy-button";
import { team } from "@/content/team";
import {
  REPO, repoFile, explorer, facts, n, pct, short, cap, sizeCap, batch, largest, aggRows, ozRev, round, transfers,
} from "@/content/facts";
import { FAQ } from "./faq";
import { HeroHeadline } from "./hero-headline";

/* ------------------------------------------------------------------ shared */

const Badge = ({ children, tone = "sealed" }: { children: React.ReactNode; tone?: "sealed" | "primary" | "neutral" }) => (
  <span
    className={
      tone === "sealed"
        ? "inline-flex w-fit items-center gap-1 rounded-full bg-sealed-dim px-2.5 py-1 font-inter text-xs font-medium text-sealed"
        : tone === "primary"
          ? "inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-inter text-xs font-medium text-primary"
          : "inline-flex w-fit items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 font-inter text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
    }
  >
    {children}
  </span>
);

const SectionHead = ({ id, title, sub, extra }: { id?: string; title: React.ReactNode; sub?: React.ReactNode; extra?: React.ReactNode }) => (
  <div id={id} className="scroll-mt-24 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
    <div className="flex flex-col gap-4">
      {extra}
      <Heading>{title}</Heading>
    </div>
    {sub && <Subheading className="xl:max-w-lg">{sub}</Subheading>}
  </div>
);

/** Agenforce's bordered grid (features-secondary / features-tertiary). */
const Grid = ({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) => (
  <div
    className={`mt-10 grid grid-cols-1 border-y border-neutral-200 dark:border-neutral-800 md:mt-16 ${
      cols === 2 ? "md:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"
    } divide-y divide-neutral-200 dark:divide-neutral-800 md:divide-y-0 md:divide-x`}
  >
    {children}
  </div>
);
const Cell = ({ icon, title, children }: { icon?: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) => (
  <div className="p-4 md:p-8">
    <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
      {icon}
      <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{title}</h3>
    </div>
    <div className="mt-2 font-inter text-neutral-600 dark:text-neutral-400 [&_p+p]:mt-2">{children}</div>
  </div>
);
const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="break-all font-mono text-[0.85em]">{children}</span>
);
const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">{children}</a>
);

/* ---------------------------------------------------------------- 1. hero */

const HEADLINE = ["Disclosure", "and", "audit", "for", "Stellar's", "privacy", "tokens."];

export const Hero = () => (
  <section className="relative overflow-hidden pt-10 md:pt-20 lg:pt-28">
    <Container>
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">Stellar testnet</Badge>
        <Badge tone="neutral">OpenZeppelin Confidential Tokens v0.9.0</Badge>
      </div>
      <HeroHeadline words={HEADLINE} />
      <Subheading className="max-w-2xl py-8">
        Tally is the disclosure and audit service for Stellar&apos;s privacy tokens: confidential payouts to many
        recipients, with totals an outside party can verify, and auditor access that no single party controls.
      </Subheading>
      <p className="-mt-2 mb-8 max-w-2xl font-inter text-sm text-neutral-600 dark:text-neutral-400">
        Confidential one-to-many payouts are the first use case, already working on testnet. The operator service
        (split auditor-key custody, scoped audit requests, tax export) is <strong>designed, not built</strong>.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild className="shadow-brand"><Link href="/docs/quickstart">Run the demo</Link></Button>
        <Button asChild variant="outline"><Link href="/docs">Read the docs</Link></Button>
        <Button asChild variant="ghost"><a href={REPO}>View the code</a></Button>
      </div>
      <figure id="video" className="mt-14 scroll-mt-24">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:p-6">
          <RoundExplainer still />
        </div>
        <figcaption className="mt-3 font-inter text-xs text-neutral-600 dark:text-neutral-400">
          Demo video slot. Until the video exists, this is a still of the round explainer below: real addresses and
          ciphertext from {round.dir}, illustrative names.
        </figcaption>
      </figure>
    </Container>
  </section>
);


/* -------------------------------------------- 2. built on (logo cloud slot) */

export const BuiltOn = () => (
  <Container className="py-10 md:py-16">
    <Reveal>
      <p className="text-center font-inter text-sm text-neutral-600 dark:text-neutral-400">Built on Stellar&apos;s privacy standard</p>
      <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-800 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Confidential Tokens", "Stellar's developer preview: private balances and amounts, public addresses"],
          ["OpenZeppelin contracts", "Token, verifier and auditor from stellar-contracts"],
          ["Branch tracked", `v0.9.0 @ ${ozRev}`],
          ["Network", `Stellar testnet, protocol ${facts.measurements.protocolVersion}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-white p-5 dark:bg-neutral-950">
            <p className="font-display text-sm font-bold">{k}</p>
            <p className="mt-1 font-inter text-sm text-neutral-600 dark:text-neutral-400">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center font-inter text-xs text-neutral-600 dark:text-neutral-400">
        Tally builds on these open-source components. No endorsement by, or partnership with, Stellar, SDF or
        OpenZeppelin is implied.
      </p>
    </Reveal>
  </Container>
);

/* ------------------------------------------------------------ 3. problem */

export const Problem = () => (
  <Container className="py-10 md:py-20 lg:py-28">
    <Reveal>
      <SectionHead
        id="problem"
        title={<>A public ledger shows <br className="hidden md:block" /> every amount, forever.</>}
        sub="Grant programmes, bounty platforms, public-goods funding and aid disbursement pay many people in public. On a public ledger every recipient's amount is visible to anyone, which exposes the people being paid. Paying off-chain hides the amounts but gives up the audit trail."
      />
    </Reveal>
    <div className="mt-10 grid grid-cols-1 gap-4 md:mt-16 lg:grid-cols-3">
      {[
        { t: "Recipients are exposed", d: "An ordinary payment publishes its amount next to the recipient's address, permanently.", icon: <IconEye className="size-5" /> },
        { t: "Off-chain loses the trail", d: "Moving payouts off-chain hides amounts, and also removes the record a donor or auditor could check.", icon: <IconEyeOff className="size-5" /> },
        { t: "Tally keeps both", d: "Amounts stay sealed on-chain; the round's total stays provable to whoever is entitled to check it.", icon: <IconShieldCheck className="size-5" /> },
      ].map((c, i) => (
        <Reveal key={c.t} delay={i * 0.06}>
          <div className={`h-full bg-neutral-50 p-6 dark:bg-neutral-800 md:p-8 ${i === 0 ? "rounded-3xl lg:rounded-r-lg" : i === 2 ? "rounded-3xl lg:rounded-l-lg" : "rounded-3xl lg:rounded-lg"}`}>
            <span className="text-primary">{c.icon}</span>
            <p className="mt-4 font-display text-xl font-bold">{c.t}</p>
            <p className="mt-2 font-inter text-neutral-600 dark:text-neutral-400">{c.d}</p>
          </div>
        </Reveal>
      ))}
    </div>
  </Container>
);

/* -------------------------------------------------------- 4. who it is for */

export const WhoFor = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="who" title="Who it is for" sub="Three parties take part in a round. Each gets something different." /></Reveal>
    <Reveal>
      <Grid>
        <Cell icon={<IconCash className="size-5" />} title="The payer">
          <p>Pays many recipients from lane accounts it declared on-chain before the round opened.</p>
          <p>Amounts stay sealed on the ledger. When a donor asks, the payer answers with one zero-knowledge proof of the round&apos;s total.</p>
        </Cell>
        <Cell icon={<IconUser className="size-5" />} title="The recipient">
          <p>Registers a confidential account from their own wallet signature; the key never leaves their device.</p>
          <p>Their amount is private from the public ledger and from whoever runs the payout.</p>
        </Cell>
        <Cell icon={<IconFileCertificate className="size-5" />} title="The donor or auditor">
          <p>Checks the total with their own key and a fresh nonce. No secret of the payer&apos;s is ever handed over.</p>
          <p>Learns the total and how many transfers it covers, and nothing about any single amount.</p>
        </Cell>
      </Grid>
    </Reveal>
  </Container>
);

/* ---------------------------------------------------- 5. how a round works */

export const HowItWorks = () => (
  <Container className="py-10 md:py-20 lg:py-28">
    <Reveal>
      <SectionHead
        id="how"
        title="How a round works"
        sub="Alice declares a round and pays through several lanes. The chain records who paid whom and holds only ciphertext for each amount. Dave, a donor, checks one proof of the total on his own machine."
      />
    </Reveal>
    <div className="mt-20">
      <RoundExplainer />
    </div>
    <Reveal>
      <ol className="mt-10 grid grid-cols-1 gap-6 font-inter text-sm text-neutral-600 dark:text-neutral-400 md:grid-cols-4">
        <li><strong className="text-neutral-800 dark:text-neutral-200">1. Declare.</strong> Alice records the round id and its lanes in the round registry. The contract stamps the opening ledger.</li>
        <li><strong className="text-neutral-800 dark:text-neutral-200">2. Pay.</strong> Each lane sends confidential transfers. Sender and recipient addresses are public; the amount is sealed.</li>
        <li><strong className="text-neutral-800 dark:text-neutral-200">3. Close.</strong> Alice closes the round. The contract stamps the closing ledger, fixing the window.</li>
        <li><strong className="text-neutral-800 dark:text-neutral-200">4. Verify.</strong> Dave issues a challenge, receives a proof, and checks it against every transfer the chain shows from the declared lanes in the window.</li>
      </ol>
    </Reveal>
  </Container>
);

/* ------------------------------------------------------------- 6. use cases */

const USE_CASES = [
  { icon: <IconGift className="size-5" />, t: "Grant programmes", d: "Pay grantees without publishing each award; show funders the programme total.", plan: false },
  { icon: <IconTrophy className="size-5" />, t: "Hackathon prizes", d: "Pay winners privately and prove the prize pool went out in full.", plan: false },
  { icon: <IconCalendarDollar className="size-5" />, t: "Payroll", d: "Keep salaries off the public ledger while an auditor can check the payroll total.", plan: false },
  { icon: <IconHeartHandshake className="size-5" />, t: "Aid disbursement", d: "Protect recipients from being targeted, and give donors a checkable total.", plan: false },
  { icon: <IconUsersGroup className="size-5" />, t: "DAO contributor payouts", d: "Pay contributors without exposing each payment; prove the treasury outflow per round.", plan: false },
  { icon: <IconReceiptTax className="size-5" />, t: "Tax and audit reporting", d: "Statements for one account and period, and auditor access under a scoped request.", plan: true },
];

export const UseCases = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="use-cases" title="Use cases" sub="Anyone who pays many people from one pool and has to account for it in public. Tally has no users today; these are the situations it is built for." /></Reveal>
    <Reveal>
      <div className="mt-10 grid grid-cols-1 gap-10 md:mt-16 md:grid-cols-3">
        {USE_CASES.map((u) => (
          <div key={u.t}>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
              {u.icon}
              <h3 className="text-lg font-bold">{u.t}</h3>
            </div>
            <p className="mt-2 font-inter text-neutral-600 dark:text-neutral-400">{u.d}</p>
            {u.plan && <p className="mt-2"><Badge>Needs the operator service: designed, not built</Badge></p>}
          </div>
        ))}
      </div>
    </Reveal>
  </Container>
);

/* ------------------------------------------- 7. what a verifier learns */

export const VerifierLearns = () => (
  <Container className="py-10 md:py-20 lg:py-28">
    <Reveal><SectionHead id="verifier" title="What an outside verifier learns, and does not" /></Reveal>
    <Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2">
        <div className="rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800 md:p-8">
          <p className="flex items-center gap-2 font-display text-xl font-bold"><IconCircleCheck className="size-6 text-primary" />Learns</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 font-inter text-neutral-700 dark:text-neutral-300">
            <li>The total sent from the declared lanes inside the declared window.</li>
            <li>How many transfers that total covers (the circuit publishes the count).</li>
            <li>The lane set and the window, read from the chain, not from the payer.</li>
            <li>That the proof answers the verifier&apos;s own challenge and nonce.</li>
          </ul>
        </div>
        <div className="rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800 md:p-8">
          <p className="flex items-center gap-2 font-display text-xl font-bold"><IconCircleX className="size-6 text-neutral-600 dark:text-neutral-400" />Does not learn</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 font-inter text-neutral-700 dark:text-neutral-300">
            <li>Any individual amount.</li>
            <li>Which recipient received how much.</li>
            <li>Anyone&apos;s balance.</li>
            <li>Any secret of the payer&apos;s: the verifier holds only its own disclosure key.</li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-3xl border border-neutral-200 p-6 dark:border-neutral-800 md:p-8">
        <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">The trust statement, verbatim</p>
        <blockquote className="mt-4 space-y-4 font-inter text-neutral-800 dark:text-neutral-200">
          <p>
            <strong>The donor is assured that</strong>{" "}the confidential transfers sent from the lane accounts Tally declared on-chain
            before the round opened, within that round&apos;s declared ledger window, total exactly the disclosed amount and that none
            has been withheld — because every confidential transfer publishes its sender address on-chain whether or not the funder
            chooses to disclose it, so an omitted transfer is visible as one the proof fails to cover.
          </p>
          <p>
            <strong>This does not assure</strong>{" "}that the funder made no other payments, nor that the recipients are independent of the
            funder: the guarantee is scoped to transfers from the accounts declared before the round, <strong>not to the funder&apos;s total
            spend</strong>, and it establishes what amounts moved, not who ultimately controls the accounts that received them.
          </p>
        </blockquote>
      </div>
    </Reveal>
  </Container>
);

/* ------------------------------------------------- 8. operator service */

export const Operator = () => (
  <Container className="py-10 md:py-20">
    <Reveal>
      <SectionHead
        id="operator"
        extra={<Badge>Designed, not built</Badge>}
        title="The operator service, planned"
        sub="The compliance roles that OpenZeppelin Confidential Tokens and Nethermind's Stellar Private Payments define but leave to someone else. This is a design document today; none of it runs."
      />
    </Reveal>
    <Reveal>
      <Grid cols={2}>
        <Cell icon={<IconKey className="size-5" />} title="Split auditor-key custody">
          <p>The auditor key is generated in pieces and held two-of-three by the issuer, Tally and an independent custodian. No single party, Tally included, can decrypt alone.</p>
        </Cell>
        <Cell icon={<IconSearch className="size-5" />} title="Scoped audit requests">
          <p>A request names accounts, a ledger range and the data wanted. Each custodian checks scope itself and contributes only for events it resolves from the chain. Every step is logged.</p>
        </Cell>
        <Cell icon={<IconLayersIntersect className="size-5" />} title="Selective disclosure">
          <p>The aggregate total over a round is built today. Per-period, per-counterparty and inbound totals, and auditor-attested totals, are designed.</p>
        </Cell>
        <Cell icon={<IconFileInvoice className="size-5" />} title="Tax export">
          <p>A statement for one account and period, generated by the holder with their own key, with the transaction references and the proofs of its totals. Not tax advice and no fiat valuation.</p>
        </Cell>
      </Grid>
    </Reveal>
    <Reveal>
      <p className="mt-6 font-inter text-sm text-neutral-600 dark:text-neutral-400">
        The design&apos;s weakest point is stated in it: for clawback and auditor-side proofs, the auditor key would be reassembled briefly
        inside an attested enclave. <Link className="text-primary underline-offset-4 hover:underline" href="/docs/operator/design">Read the design</Link>.
      </p>
    </Reveal>
  </Container>
);

/* ---------------------------------------------------- 9. live evidence */

export const Evidence = () => {
  const c = facts.contracts;
  return (
    <Container className="py-10 md:py-20 lg:py-28">
      <Reveal>
        <SectionHead
          id="evidence"
          title="Live evidence"
          sub={`A real round on Stellar testnet, published as ${round.dir} on ${round.published}. Anyone with the repository can verify it until about ledger ${n(round.verifiable_until_ledger)}, when its events leave the RPC's seven-day window.`}
        />
      </Reveal>
      <Reveal>
        <Grid cols={2}>
          <Cell icon={<IconListCheck className="size-5" />} title={`The round: ${round.dir}`}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt>Funder</dt><dd><Ext href={explorer("account", round.funder)}><Mono>{short(round.funder, 8, 6)}</Mono></Ext></dd>
              <dt>Round id</dt><dd><Mono>{short(round.round_id, 12, 6)}</Mono></dd>
              <dt>Window</dt><dd><Mono>ledgers {n(round.chain.openedAt)} to {n(round.chain.closedAt)}</Mono></dd>
              <dt>Transfers</dt><dd>{transfers.length} across {round.chain.lanes} declared lanes</dd>
              <dt>Verified total</dt><dd>3,160 stroops of the wrapped asset, from the declared lanes in {round.dir}</dd>
            </dl>
          </Cell>
          <Cell icon={<IconCode className="size-5" />} title="Contracts (testnet)">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {([["Token", c.token], ["Verifier", c.verifier], ["Auditor", c.auditor], ["Round registry", c.registry]] as const).map(([k, v]) => (
                <React.Fragment key={k}><dt>{k}</dt><dd><Ext href={explorer("contract", v)}><Mono>{short(v, 8, 6)}</Mono></Ext></dd></React.Fragment>
              ))}
            </dl>
            <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">From <Ext href={repoFile("demo/deployment.testnet.json")}>demo/deployment.testnet.json</Ext>. OpenZeppelin {facts.openZeppelin}.</p>
          </Cell>
        </Grid>
      </Reveal>
      <Reveal>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[640px] font-inter text-sm">
            <caption className="px-4 pt-4 text-left text-neutral-600 dark:text-neutral-400">
              Transfers in the window, read from Stellar testnet RPC ({round.chain.readFrom}) on {round.chain.readAt.slice(0, 10)}. The amount column is the on-chain ciphertext.
            </caption>
            <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
              <th className="px-4 py-3 font-medium">Ledger</th><th className="px-4 py-3 font-medium">From (lane)</th><th className="px-4 py-3 font-medium">To</th><th className="px-4 py-3 font-medium">Amount field</th><th className="px-4 py-3 font-medium">Transaction</th>
            </tr></thead>
            <tbody>
              {transfers.slice(0, 6).map((t) => (
                <tr key={t.txHash} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2 font-mono text-xs">{t.ledger}</td>
                  <td className="px-4 py-2 font-mono text-xs">{short(t.from)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{short(t.to)}</td>
                  <td className="px-4 py-2"><span className="inline-flex items-center gap-1 rounded-md bg-sealed-dim px-2 py-0.5 font-mono text-xs text-sealed"><IconLock className="size-3" />{short(t.vTilde, 8, 4)}</span></td>
                  <td className="px-4 py-2"><Ext href={explorer("tx", t.txHash)}><Mono>{short(t.txHash, 8, 6)}</Mono></Ext></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pb-4 pt-2 font-inter text-xs text-neutral-600 dark:text-neutral-400">Showing 6 of {transfers.length}. All of them are listed in the <Link className="text-primary" href="/docs/quickstart">quickstart</Link> output and in the evidence pack.</p>
        </div>
      </Reveal>
    </Container>
  );
};

/* ---------------------------------------------------- 10. try it yourself */

const STEPS = [
  {
    t: "Clone and install",
    cmd: "git clone --recurse-submodules https://github.com/Tally-Network/Tally\ncd Tally && pnpm install",
    out: null as string | null,
    note: "Node and pnpm. Verifying needs no Noir toolchain: the compiled circuits are in the repository.",
  },
  {
    t: "Verify the published round",
    cmd: "pnpm verify:evidence",
    out: `✓ round found: 5 lanes, window [5032842, 5032851]
✓ 16 transfers from the declared lanes inside the window
✓ public inputs reconstructed from chain state only
✓ verification key matches the pinned artifact (1760 B)
✓ proof verified (16224 B, zero-knowledge)

TOTAL DISBURSED: 3160  (stroops of the wrapped asset)
over 16 transfers from 5 declared lanes, ledgers 5032842–5032851
no individual amount was revealed.`,
    note: "Exit 0 means verified, 2 means the proof was rejected, 3 means the round aged out of the RPC window, 1 means it could not be checked.",
  },
  {
    t: "Run a fresh round yourself",
    cmd: "pnpm demo",
    out: `opened_at 5032842  ·  closed_at 5032851  ·  window [5032842, 5032851]
transfers from declared lanes (all time) : 17
inside the declared window               : 16
excluded by the window                   :  1   ← the pre-round transfer
proof 16224B in 2032ms (zero-knowledge), spans 5 sender accounts, verified
donor total = 3160   expected 3160   MATCH`,
    note: "Creates fresh testnet accounts with friendbot and takes several minutes. One transfer is sent before the round opens and must be excluded.",
  },
];

export const TryIt = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="try" title="Try it yourself" sub="Three steps, with the output recorded in the repository from the last run." /></Reveal>
    <div className="mt-10 grid grid-cols-1 gap-4 md:mt-16 lg:grid-cols-3">
      {STEPS.map((s, i) => (
        <Reveal key={s.t} delay={i * 0.06} className="min-w-0">
          <div className="flex h-full min-w-0 flex-col rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800">
            <p className="font-inter text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">Step {i + 1}</p>
            <p className="mt-2 font-display text-lg font-bold">{s.t}</p>
            <div className="mt-4 rounded-xl bg-neutral-900 p-4 text-neutral-100 dark:bg-black">
              <div className="flex items-start justify-between gap-3">
                <pre className="min-w-0 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">{s.cmd}</pre>
                <CopyButton text={s.cmd} />
              </div>
            </div>
            {s.out && (
              <details className="mt-3 font-inter text-sm">
                <summary className="cursor-pointer text-neutral-700 dark:text-neutral-300">Expected output</summary>
                <pre className="mt-2 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-3 font-mono text-[11px] leading-relaxed dark:border-neutral-700 dark:bg-neutral-900">{s.out}</pre>
              </details>
            )}
            <p className="mt-3 font-inter text-sm text-neutral-600 dark:text-neutral-400">{s.note}</p>
          </div>
        </Reveal>
      ))}
    </div>
  </Container>
);

/* ------------------------------------------------------------ 11. measured */

export const Measured = () => {
  const m = facts.measurements;
  const a64 = aggRows.find((r) => r.n === 64)!;
  const stats = [
    { k: "Confidential transfer", v: n(m.confidentialTransfer.instructions), d: `CPU instructions, ${pct(m.confidentialTransfer.instructions, cap)} of the ${n(cap)} per-transaction cap` },
    { k: "Transfers in one transaction", v: String(batch.largestThatFits), d: `From one sender. At ${batch.largestThatFits}: ${pct(largest.instructions!, cap)} of instructions and ${pct(largest.txSizeBytes!, sizeCap)} of size` },
    { k: "Aggregate proof size", v: "16,224 B", d: "Zero-knowledge, the same size for 8, 16 or 64 transfers" },
    { k: "On-chain check of a 64-transfer proof", v: pct(a64.instructions, cap), d: "Of the cap. It fits; Tally still verifies off-chain, for privacy" },
    { k: "Register an account", v: n(m.register.instructions), d: `CPU instructions, ${pct(m.register.instructions, cap)} of the cap` },
    { k: "Transfer proof", v: "1.32 s", d: "Warm, on an Apple M4 Pro" },
  ];
  return (
    <Container className="py-10 md:py-20 lg:py-28">
      <Reveal>
        <SectionHead
          id="measured"
          title="Measured"
          sub={`Re-measured on ${m.measuredAt.slice(0, 10)} on Stellar testnet, protocol ${m.protocolVersion}. Method, raw data and transaction hashes are in MEASUREMENTS.md.`}
        />
      </Reveal>
      <Reveal>
        <div className="mt-10 grid grid-cols-1 gap-px border-y border-neutral-200 bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-800 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.k} className="bg-background p-6 md:p-8">
              <p className="font-inter text-sm text-neutral-600 dark:text-neutral-400">{s.k}</p>
              <p className="mt-2 font-display text-4xl font-bold tabular-nums">{s.v}</p>
              <p className="mt-2 font-inter text-sm text-neutral-600 dark:text-neutral-400">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 font-inter text-sm text-neutral-600 dark:text-neutral-400">
          Four transfers in one transaction landed on testnet in <Ext href={explorer("tx", batch.submittedTx)}><Mono>{short(batch.submittedTx, 8, 6)}</Mono></Ext>.
          Earlier figures (one transfer per transaction, under a 100,000,000 cap) are superseded. <Ext href={repoFile("MEASUREMENTS.md")}>MEASUREMENTS.md</Ext>
        </p>
      </Reveal>
    </Container>
  );
};

/* ---------------------------------------------------------- 12. safeguards */

export const Safeguards = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="safeguards" title="Safeguards" sub="Checks that run on every change, and the tampering cases the verifier rejects." /></Reveal>
    <Reveal>
      <Grid cols={4}>
        <Cell icon={<IconLock className="size-5" />} title="Secret guard">
          <p>Runs first in CI and fails the build if a Stellar seed, a private key, or a hex secret appears in any tracked file. It also detects the retired demo auditor key.</p>
        </Cell>
        <Cell icon={<IconFingerprint className="size-5" />} title="Pinned verification keys">
          <p>The verifier refuses a proof whose circuit key differs from the pinned file. CI rebuilds the circuits and fails on any drift.</p>
        </Cell>
        <Cell icon={<IconListCheck className="size-5" />} title="Upstream vectors">
          <p>The client reproduces all 19 OpenZeppelin v0.9.0 test vectors for the primitives it uses. One spender-only vector is not used.</p>
        </Cell>
        <Cell icon={<IconShieldCheck className="size-5" />} title="Tampering rejected">
          <p>A bundle whose sealed total was altered by one, and a bundle replayed against a different challenge, both fail with exit code 2.</p>
        </Cell>
      </Grid>
    </Reveal>
  </Container>
);

/* ------------------------------------------------------------ 13. compare */

const COMPARE = [
  ["Remi (SCF #44)", "OpenZeppelin Confidential Tokens", "Auditor dashboard, compliance API and selective disclosure planned for its own remittance deployment", "Closest funded overlap on the same standard. Tally aims to serve other issuers, with split custody and aggregate proofs"],
  ["Arcane (SCF #42)", "Its own shielded pool", "Scoped disclosure by role and time window, logged, with a case portal", "Same operator functions on a different privacy system"],
  ["ZKELLA (SCF #45)", "Its own shielded token", "Viewing keys, sanctions non-membership, planned auditor API", "Own stack; no aggregate disclosure"],
  ["Moonlight (SCF #37)", "Its own privacy channels", "Privacy providers run audit flows inside Moonlight", "The operator role exists, inside Moonlight only"],
  ["Haven (SCF #45)", "Not chosen yet", "Privacy-first consumer neobank, pre-launch", "Adjacent: a possible user of an operator"],
  ["SDF, OpenZeppelin, Nethermind", "First-party standards", "Specs, reference contracts, demo auditor UI, allow/deny trees", "Supply the tools; SDF asked for someone to run the operator role"],
];

export const Compare = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="compare" title="How Tally differs" sub="Others on Stellar cover parts of this. The full, sourced comparison is in the docs." /></Reveal>
    <Reveal>
      <div className="mt-10 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 md:mt-16">
        <table className="w-full min-w-[760px] font-inter text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
            <th className="px-4 py-3 font-medium">Project</th><th className="px-4 py-3 font-medium">Privacy system</th><th className="px-4 py-3 font-medium">What it covers</th><th className="px-4 py-3 font-medium">Relation to Tally</th>
          </tr></thead>
          <tbody>
            {COMPARE.map((r) => (
              <tr key={r[0]} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">{r[0]}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{r[1]}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{r[2]}</td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 font-inter text-sm"><Link className="text-primary underline-offset-4 hover:underline" href="/docs/compare">Full comparison in the docs <IconArrowRight className="inline size-4" /></Link></p>
    </Reveal>
  </Container>
);

/* ---------------------------------------- 14. built vs designed, and limits */

const BUILT = [
  "Aggregate disclosure circuits for 8, 16 and 64 transfers, zero-knowledge, with a minimum group size enforced in the circuit",
  "Round registry contract on testnet, 16 tests, 10 of them negative",
  "Client ported to OpenZeppelin v0.9.0, passing the upstream test vectors",
  "End-to-end round, donor-verified, from one command",
  "Standalone challenge, prove and verify command-line tool",
  "Published round verifiable from a clean clone",
  "Non-custodial registration, tested against live testnet",
];
const DESIGNED = [
  "Split auditor-key custody (two-of-three)",
  "Scoped audit requests with a public log",
  "Per-period, per-counterparty and inbound disclosure proofs",
  "Tax export statement",
  "Allow and deny lists for both privacy systems",
  "Durable event archive",
  "Auditor client that decrypts every event type",
];
const LIMITS = [
  "Testnet only. Nothing has been audited",
  "OpenZeppelin's confidential tokens are a developer preview on an untagged branch",
  "Verification relies on about seven days of RPC events; there is no archive yet",
  "No users, integrations or partners",
  "Recipient independence is not verified",
  "The demo sends one transfer per transaction",
  "Registration runs headless; there is no wallet page yet",
  "In the design, the auditor key is reassembled briefly in an enclave for some proofs",
];

const StatusCard = ({ title, items, tone }: { title: string; items: string[]; tone: "built" | "designed" | "limits" }) => (
  <div className="h-full rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800 md:p-8">
    <p className="flex items-center gap-2 font-display text-xl font-bold">
      {tone === "built" ? <IconCircleCheck className="size-6 text-primary" /> : tone === "designed" ? <IconFileInvoice className="size-6 text-sealed" /> : <IconAlertTriangle className="size-6 text-neutral-600 dark:text-neutral-400" />}
      {title}
    </p>
    <ul className="mt-4 list-disc space-y-2 pl-5 font-inter text-neutral-700 dark:text-neutral-300">
      {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
  </div>
);

export const Status = () => (
  <Container className="py-10 md:py-20 lg:py-28">
    <Reveal><SectionHead id="status" title="Built, designed, and the limits" sub="All three at the same weight. Items come from the repository's scope ledger and demonstration status." /></Reveal>
    <Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-16 lg:grid-cols-3">
        <StatusCard title="Built" items={BUILT} tone="built" />
        <StatusCard title="Designed, not built" items={DESIGNED} tone="designed" />
        <StatusCard title="Limits" items={LIMITS} tone="limits" />
      </div>
    </Reveal>
  </Container>
);

/* ------------------------------------------------------------- 15. roadmap */

export const Roadmap = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="roadmap" title="Roadmap" sub="No dates. The last column depends on a decision outside this project." /></Reveal>
    <Reveal>
      <Grid>
        <Cell icon={<IconCircleCheck className="size-5 text-primary" />} title="Working now, on testnet">
          <p>Confidential one-to-many payouts, the aggregate proof of the total, the round registry, the verification tool and a published round.</p>
        </Cell>
        <Cell icon={<IconArrowRight className="size-5" />} title="Next, on testnet">
          <p>The auditor client and an event archive; split auditor-key custody; scoped audit requests with a public log; allow and deny lists; more disclosure proofs and tax export; a pilot with one issuer.</p>
        </Cell>
        <Cell icon={<IconBuildingBank className="size-5" />} title="After SDF approves Confidential Tokens for mainnet">
          <p>Mainnet deployment, hardware-backed key shares, auditor-side proofs through an attested enclave, payout batching, and fixes from an external audit.</p>
        </Cell>
      </Grid>
    </Reveal>
  </Container>
);

/* ----------------------------------------------------------------- 16. FAQ */

export { FAQ };

/* ---------------------------------------------------------------- 17. team */

export const Team = () => (
  <Container className="py-10 md:py-20">
    <Reveal><SectionHead id="team" title="Team" /></Reveal>
    <Reveal>
      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
        {team.map((m) => (
          <div key={m.name} className="rounded-3xl bg-neutral-50 p-6 dark:bg-neutral-800 md:p-8">
            <p className="font-display text-xl font-bold">{m.name}</p>
            <p className="mt-1 font-inter text-sm text-neutral-600 dark:text-neutral-400">{m.role}</p>
            {m.bio && <p className="mt-4 font-inter text-neutral-700 dark:text-neutral-300">{m.bio}</p>}
            {m.links && (
              <ul className="mt-4 flex flex-wrap gap-3 font-inter text-sm">
                {m.links.map((l) => <li key={l.href}><Ext href={l.href}>{l.label}</Ext></li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Reveal>
  </Container>
);

/* ----------------------------------------------------------------- 18. CTA */

export const ClosingCta = () => (
  <Container className="py-10 md:py-20 lg:py-28">
    <Reveal>
      <div className="rounded-[2rem] bg-neutral-50 px-6 py-12 text-center dark:bg-neutral-800 md:px-16 md:py-20">
        <Heading className="mx-auto max-w-3xl">Run a round, read the design, or help shape the operator.</Heading>
        <Subheading className="mx-auto mt-6 max-w-2xl">
          Issuers, pool operators and teams paying many recipients on Stellar can talk to us as design partners. Open an issue on GitHub and say what you need.
        </Subheading>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild className="shadow-brand"><Link href="/docs">Read the docs</Link></Button>
          <Button asChild variant="outline"><Link href="/docs/quickstart">Run the demo</Link></Button>
          <Button asChild variant="ghost"><a href={`${REPO}/issues/new?title=Design%20partner`}>Contact as a design partner</a></Button>
        </div>
      </div>
    </Reveal>
  </Container>
);
