"use client";

import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/Button";
import styles from "./OverrideForm.module.css";
import type { CandidateView } from "./types";

export interface OverrideFormProps {
  candidate: CandidateView;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const OVERRIDE_REASONS = [
  { id: "flexible", label: "Client said flexible on this" },
  { id: "strong_fit", label: "Strong fit on everything else" },
  { id: "thin_pool", label: "Pool is thin for this client" },
  { id: "other", label: "Other" },
] as const;

type OverrideReasonId = (typeof OVERRIDE_REASONS)[number]["id"];

export function OverrideForm({
  candidate,
  onCancel,
  onConfirm,
}: OverrideFormProps) {
  const [reasonId, setReasonId] = useState<OverrideReasonId | null>(null);
  const [otherText, setOtherText] = useState("");
  const otherId = useId();
  const chosen = OVERRIDE_REASONS.find(({ id }) => id === reasonId);
  const reason =
    reasonId === "other" ? otherText.trim() : (chosen?.label ?? "");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason) onConfirm(reason);
  };

  return (
    <form onSubmit={handleSubmit}>
      <ul className={styles.blockers}>
        {candidate.blockers.map(({ side, message }) => (
          <li key={`${side}-${message}`}>{message}</li>
        ))}
      </ul>
      <fieldset className={styles.reasons}>
        <legend className={styles.legend}>
          Why send it anyway? Logged as an override.
        </legend>
        {OVERRIDE_REASONS.map(({ id, label }) => (
          <label key={id} className={styles.option}>
            <input
              type="radio"
              name="override-reason"
              value={id}
              checked={reasonId === id}
              onChange={() => setReasonId(id)}
              required
            />
            {label}
          </label>
        ))}
      </fieldset>
      {reasonId === "other" && (
        <div className={styles.other}>
          <label htmlFor={otherId}>Describe the reason</label>
          <textarea
            id={otherId}
            required
            maxLength={200}
            rows={2}
            value={otherText}
            onChange={(event) => setOtherText(event.target.value)}
          />
        </div>
      )}
      <footer className={styles.footer}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" disabled={!reason}>
          Send anyway
        </Button>
      </footer>
    </form>
  );
}
