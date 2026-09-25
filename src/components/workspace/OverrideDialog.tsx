"use client";

import { Dialog } from "@/components/Dialog";
import { OverrideForm } from "./OverrideForm";
import type { CandidateView } from "./types";

export interface OverrideDialogProps {
  candidate: CandidateView | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function OverrideDialog({
  candidate,
  onCancel,
  onConfirm,
}: OverrideDialogProps) {
  return (
    <Dialog
      isOpen={candidate !== null}
      eyebrow="Override a dealbreaker"
      title={candidate ? `Send ${candidate.name} anyway?` : ""}
      onClose={onCancel}
    >
      {candidate && (
        <OverrideForm
          candidate={candidate}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  );
}
