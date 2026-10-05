import { join } from "node:path";
import { createMDX } from "fumadocs-mdx/next";

// The repository root, so the /verify page can import verify/core.ts, the
// module `tally verify` uses, together with the SDK and packages it resolves.
const root = join(import.meta.dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: root,
  // Built with webpack (`next build --webpack`): the repository's TypeScript
  // imports siblings as "./x.js" (TypeScript ESM style), which webpack maps to
  // ./x.ts through extensionAlias and Turbopack does not.
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] };
    return config;
  },
};
export default createMDX()(nextConfig);
