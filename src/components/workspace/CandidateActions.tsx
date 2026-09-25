"use client";

import { Button } from "@/components/Button";
import { NeedsCheckActions } from "./NeedsCheckActions";
import type { CandidateView, SendRequest } from "./types";

export interface CandidateActionsProps {
  candidate: CandidateView;
  onSend: (request: SendRequest) => void;
  onRequestOverride: (candidate: CandidateView) => void;
}

export function CandidateActions({
  candidate,
  onSend,
  onRequestOverride,
}: CandidateActionsProps) {
  switch (candidate.status) {
    case "clear":
      return (
        <Button
          variant="primary"
          isCompact
          onClick={() => onSend({ candidate, kind: "sent", detail: null })}
        >
          Send
        </Button>
      );
    case "needs_check":
      return <NeedsCheckActions candidate={candidate} onSend={onSend} />;
    case "blocked":
      return (
        <Button isCompact onClick={() => onRequestOverride(candidate)}>
          Send anyway
        </Button>
      );
  }
}
