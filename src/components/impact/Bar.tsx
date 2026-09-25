import type { CSSProperties } from "react";
import styles from "./DataTable.module.css";

export interface BarProps {
  ratio: number;
  isMuted?: boolean;
}

export function Bar({ ratio, isMuted = false }: BarProps) {
  const fillStyle = {
    "--pct": String(Math.min(Math.max(ratio, 0), 1)),
  } as CSSProperties;
  return (
    <span className={styles.track} aria-hidden="true">
      <span
        className={isMuted ? styles.fillMuted : styles.fill}
        style={fillStyle}
      />
    </span>
  );
}
