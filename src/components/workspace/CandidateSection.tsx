"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { padCount } from "@/components/format";
import { STATUS_LABELS } from "@/components/StatusTag";
import type { Status } from "@/domain/rules";
import type { ActivityKind } from "./ActivityContext";
import { CandidateRow } from "./CandidateRow";
import styles from "./CandidateSection.module.css";
import type { CandidateView, SendRequest } from "./types";

export interface CandidateSectionProps {
  status: Status;
  isOpenByDefault: boolean;
  candidates: CandidateView[];
  sentKinds: ReadonlyMap<string, ActivityKind>;
  onSend: (request: SendRequest) => void;
  onRequestOverride: (candidate: CandidateView) => void;
}

const SECTION_NOTES: Record<Status, string> = {
  clear: "Passes every dealbreaker on both sides. Ranked by known fit.",
  needs_check:
    "A dealbreaker field is blank. Ask first, or send marked unverified.",
  blocked: "Breaks a stated dealbreaker. Sending anyway needs a logged reason.",
};

const PAGE_SIZE = 8;

export function CandidateSection(props: CandidateSectionProps) {
  const { status, isOpenByDefault, candidates, sentKinds } = props;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const hiddenCount = candidates.length - visibleCount;
  return (
    <details
      className={`${styles.section} ${styles[status]}`}
      open={isOpenByDefault}
    >
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true" />
        <span className={styles.title}>{STATUS_LABELS[status]}</span>
        <span className={styles.count}>{padCount(candidates.length)}</span>
        <span className={styles.note}>{SECTION_NOTES[status]}</span>
      </summary>
      {candidates.length === 0 ? (
        <p className={styles.empty}>
          No candidates in this group for this client.
        </p>
      ) : (
        <ol className={styles.rows}>
          {candidates.slice(0, visibleCount).map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              sentKind={sentKinds.get(candidate.id) ?? null}
              onSend={props.onSend}
              onRequestOverride={props.onRequestOverride}
            />
          ))}
        </ol>
      )}
      {hiddenCount > 0 && (
        <Button
          variant="ghost"
          className={styles.more}
          onClick={() => setVisibleCount(candidates.length)}
        >
          Show {hiddenCount} more
        </Button>
      )}
    </details>
  );
}
