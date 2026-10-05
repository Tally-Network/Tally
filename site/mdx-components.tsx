import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { RoundOutput, RoundFact } from "@/components/tally/round-docs";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, RoundOutput, RoundFact, ...components };
}
