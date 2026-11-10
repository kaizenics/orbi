import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { APP_NAME, APP_TAGLINE } from "@orbi/core";
import { themeInitScript } from "@/lib/theme";
import { currentEmail } from "@/lib/session";
import { Providers } from "./providers";
import "./globals.css";

// Self-hosted at build time by next/font (no request to Google from visitors' browsers).
// Inter for text, Plus Jakarta Sans for headings and the wordmark.
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-brand-sans" });
const heading = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-brand-heading" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff", variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const email = await currentEmail();
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${sans.variable} ${heading.variable} ${geistMono.variable}`}>
        <Providers cacheKey={email ?? "signed-out"}>{children}</Providers>
      </body>
    </html>
  );
}
