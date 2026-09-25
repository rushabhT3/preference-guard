import type { Metadata } from "next";
import { Doto, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "@/styles/tokens.css";
import "./globals.css";
import styles from "./layout.module.css";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const dots = Doto({
  subsets: ["latin"],
  weight: "900",
  variable: "--font-doto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Preference Guard", template: "%s · Preference Guard" },
  description:
    "Checks every profile against both sides' dealbreakers before a matchmaker sends it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${dots.variable}`}
    >
      <body>
        <a className={styles.skipLink} href="#main">
          Skip to content
        </a>
        <AppNav />
        <p className={styles.banner}>
          <span className={styles.bannerTag}>Demo</span>
          Mock data generated to match the assessment's 30-day funnel.
        </p>
        <main id="main" className={styles.main}>
          {children}
        </main>
      </body>
    </html>
  );
}
