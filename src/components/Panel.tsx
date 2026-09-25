import { type ReactNode, useId } from "react";
import styles from "./Panel.module.css";

export interface PanelProps {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, meta, children }: PanelProps) {
  const headingId = useId();
  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
        {meta && <span className={styles.meta}>{meta}</span>}
      </header>
      {children}
    </section>
  );
}
