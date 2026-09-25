"use client";

import { Tag } from "@/components/Tag";
import type { ActivityKind } from "./ActivityContext";
import { ACTIVITY_LABELS } from "./ActivityPanel";
import { CandidateActions } from "./CandidateActions";
import { CandidateLines } from "./CandidateLines";
import styles from "./CandidateRow.module.css";
import type { CandidateView, SendRequest } from "./types";

export interface CandidateRowProps {
  candidate: CandidateView;
  sentKind: ActivityKind | null;
  onSend: (request: SendRequest) => void;
  onRequestOverride: (candidate: CandidateView) => void;
}

export function CandidateRow({
  candidate,
  sentKind,
  onSend,
  onRequestOverride,
}: CandidateRowProps) {
  return (
    <li className={`${styles.row} ${styles[candidate.status]}`}>
      <div className={styles.fit} aria-label={candidate.fitLabel} role="img">
        <span className={styles.fitScore}>{candidate.fitScore}</span>
        <span className={styles.fitCaption}>{candidate.fitCaption}</span>
      </div>
      <div className={styles.main}>
        <h3 className={styles.name}>{candidate.name}</h3>
        <p className={styles.meta}>{candidate.meta}</p>
        <CandidateLines candidate={candidate} />
      </div>
      <div className={styles.actions}>
        {sentKind ? (
          <Tag tone="accent">{ACTIVITY_LABELS[sentKind]}</Tag>
        ) : (
          <CandidateActions
            candidate={candidate}
            onSend={onSend}
            onRequestOverride={onRequestOverride}
          />
        )}
      </div>
    </li>
  );
}
