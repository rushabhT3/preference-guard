"use client";

import { useMemo, useState } from "react";
import type { Status } from "@/domain/rules";
import { useActivity } from "./ActivityContext";
import { ActivityPanel } from "./ActivityPanel";
import styles from "./CandidateBoard.module.css";
import { CandidateSection } from "./CandidateSection";
import { OverrideDialog } from "./OverrideDialog";
import type { CandidateView, ClientOption, SendRequest } from "./types";

export interface CandidateBoardProps {
  client: ClientOption;
  candidates: CandidateView[];
}

const SECTIONS: { status: Status; isOpenByDefault: boolean }[] = [
  { status: "clear", isOpenByDefault: true },
  { status: "needs_check", isOpenByDefault: true },
  { status: "blocked", isOpenByDefault: false },
];

export function CandidateBoard({ client, candidates }: CandidateBoardProps) {
  const { entries, record } = useActivity();
  const [overrideTarget, setOverrideTarget] = useState<CandidateView | null>(
    null,
  );
  const sentKinds = useMemo(
    () =>
      new Map(
        entries
          .filter((entry) => entry.clientId === client.id)
          .map((entry) => [entry.candidateId, entry.kind]),
      ),
    [entries, client.id],
  );

  const handleSend = ({ candidate, kind, detail }: SendRequest) => {
    record({
      kind,
      detail,
      clientId: client.id,
      clientName: client.name,
      candidateId: candidate.id,
      candidateName: candidate.name,
    });
  };

  const handleOverrideConfirm = (reason: string) => {
    if (overrideTarget) {
      handleSend({
        candidate: overrideTarget,
        kind: "override",
        detail: reason,
      });
    }
    setOverrideTarget(null);
  };

  return (
    <div className={styles.board}>
      <ActivityPanel />
      {SECTIONS.map(({ status, isOpenByDefault }) => (
        <CandidateSection
          key={`${client.id}-${status}`}
          status={status}
          isOpenByDefault={isOpenByDefault}
          candidates={candidates.filter(
            (candidate) => candidate.status === status,
          )}
          sentKinds={sentKinds}
          onSend={handleSend}
          onRequestOverride={setOverrideTarget}
        />
      ))}
      <OverrideDialog
        candidate={overrideTarget}
        onCancel={() => setOverrideTarget(null)}
        onConfirm={handleOverrideConfirm}
      />
    </div>
  );
}
