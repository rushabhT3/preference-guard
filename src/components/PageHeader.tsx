import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  index: string;
  section: string;
  title: ReactNode;
  lede?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({
  index,
  section,
  title,
  lede,
  meta,
}: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.eyebrow}>
        <span>
          {index} — {section}
        </span>
        {meta && <span>{meta}</span>}
      </div>
      <h1 className={styles.title}>{title}</h1>
      {lede && <p className={styles.lede}>{lede}</p>}
    </header>
  );
}
