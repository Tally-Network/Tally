import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/docs-source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }} search={{ options: { type: "static" } }}>
      <DocsLayout tree={source.pageTree} nav={{ title: "Tally docs", url: "/docs" }} githubUrl="https://github.com/Tally-Network/Tally"
        links={[{ text: "Home", url: "/" }]} sidebar={{ defaultOpenLevel: 0, collapsible: true }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
