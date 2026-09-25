import type { ReactNode } from "react";
import styles from "./Metric.module.css";

export interface MetricProps {
  value: string;
  label: string;
  detail?: ReactNode;
  isDisplay?: boolean;
}

export function Metric({
  value,
  label,
  detail,
  isDisplay = false,
}: MetricProps) {
  return (
    <div className={styles.metric}>
      <p className={isDisplay ? styles.display : styles.value}>{value}</p>
      <p className={styles.label}>{label}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}
