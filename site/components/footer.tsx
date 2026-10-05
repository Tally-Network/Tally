import React from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { Container } from "./container";
import { Subheading } from "./subheading";
import { Button } from "./ui/button";
import { ModeToggle } from "./mode-toggle";
import { cn } from "@/lib/utils";
import { REPO, repoFile, explorer, facts, round } from "@/content/facts";

type Item = { title: string; href: string };

const columns: { title: string; items: Item[] }[] = [
  {
    title: "Docs",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Quickstart", href: "/docs/quickstart" },
      { title: "Walkthrough", href: "/docs/walkthrough" },
      { title: "Trust statement", href: "/docs/security/trust-statement" },
      { title: "Operator design (planned)", href: "/docs/operator/design" },
    ],
  },
  {
    title: "Code",
    items: [
      { title: "Repository", href: REPO },
      { title: "Circuits", href: repoFile("circuits/README.md") },
      { title: "Round registry", href: repoFile("contracts/README.md") },
      { title: "Command-line tool", href: repoFile("cli/README.md") },
      { title: "Licence (MIT)", href: "/docs/licence" },
    ],
  },
  {
    title: "Evidence",
    items: [
      { title: `Published round (${round.dir})`, href: repoFile("evidence/README.md") },
      { title: "Measurements", href: "/docs/measurements" },
      { title: "Demonstration status", href: repoFile("docs/DEMONSTRATION-STATUS.md") },
      { title: "Token contract on testnet", href: explorer("contract", facts.contracts.token) },
    ],
  },
];

const linkClass = "text-sm text-neutral-600 transition duration-200 hover:text-black dark:text-neutral-400 dark:hover:text-white";

const FooterLink = ({ title, href }: Item) =>
  href.startsWith("/") ? (
    <Link href={href} className={linkClass}>{title}</Link>
  ) : (
    <a href={href} className={linkClass}>{title}</a>
  );

export const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-neutral-200 py-10 perspective-distant dark:border-neutral-800 md:py-20 lg:py-32">
      <Container className="relative z-20 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex flex-col items-start gap-4 sm:col-span-2">
          <Logo />
          <Subheading>Disclosure and audit for Stellar&apos;s privacy tokens.</Subheading>
          <Button asChild className="shadow-brand"><Link href="/docs">Read the docs</Link></Button>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-4">
            <h2 className="text-base font-medium text-neutral-500 dark:text-neutral-400">{col.title}</h2>
            <ul className="flex list-none flex-col gap-2">
              {col.items.map((item) => <li key={item.title}><FooterLink {...item} /></li>)}
            </ul>
          </nav>
        ))}
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-medium text-neutral-500 dark:text-neutral-400">Video</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            The demo video is not recorded yet. Until it is, the <Link href="/#video" className="text-primary underline-offset-4 hover:underline">video slot</Link> shows
            a still of the round explainer.
          </p>
        </div>
      </Container>

      <Container className="relative z-20 mt-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          &copy; {new Date().getFullYear()} Tally. MIT licensed. Stellar testnet only; nothing has been audited.
        </p>
        <ModeToggle />
      </Container>

      <div
        aria-hidden
        className={cn(
          "flex h-[200%] items-center justify-center gap-20",
          "absolute -inset-x-[150%] -inset-y-40",
          "[background-size:40px_40px]",
          "[background-image:linear-gradient(to_right,var(--color-neutral-100)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-neutral-100)_1px,transparent_1px)]",
          "dark:[background-image:linear-gradient(to_right,var(--color-neutral-900)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-neutral-900)_1px,transparent_1px)]",
          "mask-radial-from-50%",
        )}
        style={{ transform: "rotateX(60deg)" }}
      />
    </footer>
  );
};
