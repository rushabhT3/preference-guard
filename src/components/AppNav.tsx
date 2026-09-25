"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppNav.module.css";

const NAV_ITEMS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/feedback", label: "Feedback" },
  { href: "/impact", label: "Impact" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link href="/workspace" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.wordmark}>Preference Guard</span>
          <span className={styles.org}>The Date Crew</span>
        </Link>
        <nav aria-label="Primary" className={styles.nav}>
          <ul className={styles.links}>
            {NAV_ITEMS.map(({ href, label }, index) => (
              <li key={href}>
                <Link
                  href={href}
                  className={styles.link}
                  aria-current={pathname.startsWith(href) ? "page" : undefined}
                >
                  <span className={styles.index}>0{index + 1}</span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
