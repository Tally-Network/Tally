import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const DESCRIPTION =
  "Tally is the disclosure and audit service for Stellar's privacy tokens: confidential payouts to many recipients, with totals an outside party can verify, and auditor access that no single party controls.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tally.0xo.in"),
  title: { default: "Tally: disclosure and audit for Stellar's privacy tokens", template: "%s · Tally" },
  description: DESCRIPTION,
  openGraph: { title: "Tally", description: DESCRIPTION, url: "https://tally.0xo.in", siteName: "Tally", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body className={`${manrope.variable} ${inter.variable} antialiased  `}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="bg-background text-foreground">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
