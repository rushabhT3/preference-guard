"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import styles from "./CandidateRow.module.css";
import type { CandidateView, SendRequest } from "./types";

export interface NeedsCheckActionsProps {
  candidate: CandidateView;
  onSend: (request: SendRequest) => void;
}

type CopyStatus = "idle" | "copied" | "failed";

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: "Copy question",
  copied: "Copied",
  failed: "Copy failed",
};

export function NeedsCheckActions({
  candidate,
  onSend,
}: NeedsCheckActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const blankFields = [
    ...new Set(candidate.gaps.map(({ fieldLabel }) => fieldLabel)),
  ].join(" and ");

  useEffect(() => {
    if (isConfirming) confirmButtonRef.current?.focus();
  }, [isConfirming]);

  const handleCopyQuestionClick = async () => {
    try {
      await navigator.clipboard.writeText(candidate.question ?? "");
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  const handleConfirmSendClick = () =>
    onSend({
      candidate,
      kind: "sent_unverified",
      detail: `${blankFields} not confirmed`,
    });

  if (isConfirming) {
    return (
      <div className={styles.confirm}>
        <p>Send without confirming {blankFields}?</p>
        <Button
          ref={confirmButtonRef}
          variant="primary"
          isCompact
          onClick={handleConfirmSendClick}
        >
          Send unverified
        </Button>
        <Button
          variant="ghost"
          isCompact
          onClick={() => setIsConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <>
      {candidate.question && (
        <Button isCompact onClick={handleCopyQuestionClick} aria-live="polite">
          {COPY_LABELS[copyStatus]}
        </Button>
      )}
      <Button isCompact onClick={() => setIsConfirming(true)}>
        Send unverified
      </Button>
    </>
  );
}
