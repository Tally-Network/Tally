# Tally site

The landing page and docs for Tally, planned for https://tally.0xo.in (docs at `/docs`). Next.js 16, Tailwind v4 and Motion on the Agenforce template (Aceternity UI Pro); docs on Fumadocs. Not deployed yet.

```bash
cd site
npm ci
npm run dev                 # http://localhost:3000
npm run build               # runs check:claims first
npm run check:site -- http://localhost:3000 [--external]
```

## Where the facts come from

The site never computes a figure. Everything on the landing page renders from `content/generated/facts.json`, which is generated from the repository and committed:

```bash
pnpm site:facts             # from the repository root
```

It reads `demo/deployment.testnet.json`, `ct/measurements.testnet.json` and the published round under `evidence/`, and lists that round's transfers from Stellar testnet RPC. If RPC fails, it keeps the committed snapshot.

## Checks

- **`check:claims`** (runs before every build). It checks four things:
  - `facts.json` must match the repository files it was built from.
  - Every claim in `content/claims/landing.json` and `content/claims/docs.json` must still appear on its page, and each source file must still contain the quoted string.
  - Contract ids must belong to the deployment.
  - Banned phrasing (adoption, audit, production and unscoped-guarantee claims) fails the build.

  It also writes [`CLAIMS.md`](CLAIMS.md).
- **`check:site`** crawls a running build. Every internal page and anchor must resolve, and every link into this repository must name a file that exists. Both trust-statement sentences must appear verbatim on `/` and `/docs/security/trust-statement`. With `--external`, it also fetches outside links.

CI runs both in the `site` job.

## Editing

- **Landing sections:** `components/tally/sections.tsx`. Each section's Agenforce source component is recorded in `content/claims/landing.json`.
- **Docs pages:** `content/docs/**/*.mdx`; the sidebar order is in the `meta.json` files.
- **Team:** `content/team.ts`.
- **Palette:** between `PALETTE START` and `PALETTE END` in `app/globals.css`.

A new statement of fact needs a claim entry with its source, or the build should be expected to drift from the repository.

## Old address

`pages-redirect/` at the repository root is a redirect page for the old GitHub Pages address. The `Redirect GitHub Pages to tally.0xo.in` workflow publishes it. Run that workflow by hand once tally.0xo.in serves the site.
