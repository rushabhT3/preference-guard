import type { ReactNode } from "react";
import styles from "./Tag.module.css";

export type TagTone = "neutral" | "accent" | "clear" | "needs" | "blocked";

export interface TagProps {
  tone?: TagTone;
  isDashed?: boolean;
  hasGlyph?: boolean;
  children: ReactNode;
}

export function Tag({
  tone = "neutral",
  isDashed = false,
  hasGlyph = false,
  children,
}: TagProps) {
  const className = [styles.tag, styles[tone], isDashed && styles.dashed]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={className}>
      {hasGlyph && <span className={styles.glyph} aria-hidden="true" />}
      {children}
    </span>
  );
}
