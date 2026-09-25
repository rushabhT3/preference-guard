import { type ReactNode, useId } from "react";
import styles from "./Section.module.css";

export interface SectionProps {
  index: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}

export function Section({ index, title, lede, children }: SectionProps) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <header className={styles.header}>
        <span className={styles.index}>{index}</span>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
      </header>
      {lede && <p className={styles.lede}>{lede}</p>}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
