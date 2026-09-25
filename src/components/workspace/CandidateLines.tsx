import { Tag } from "@/components/Tag";
import type { Side } from "@/domain/rules";
import styles from "./CandidateRow.module.css";
import type { CandidateView } from "./types";

const SIDE_LABELS: Record<Side, string> = {
  client: "client's rule",
  candidate: "candidate's rule",
};

export function CandidateLines({ candidate }: { candidate: CandidateView }) {
  if (candidate.status === "clear") {
    return candidate.reasons.length === 0 ? (
      <p className={styles.quiet}>
        Passes every rule. No soft preference matched.
      </p>
    ) : (
      <ul className={styles.lines} aria-label="Top matches">
        {candidate.reasons.map((reason) => (
          <li key={reason} className={styles.line}>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    );
  }
  const lines =
    candidate.status === "blocked" ? candidate.blockers : candidate.gaps;
  return (
    <ul className={styles.lines}>
      {lines.map((line) => (
        <li key={`${line.side}-${line.message}`} className={styles.line}>
          <span>{line.message}</span>
          <Tag>{SIDE_LABELS[line.side]}</Tag>
        </li>
      ))}
    </ul>
  );
}
