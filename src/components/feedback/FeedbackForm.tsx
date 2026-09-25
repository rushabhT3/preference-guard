"use client";

import { type FormEvent, useId } from "react";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import styles from "./FeedbackForm.module.css";
import type { ClassifyRequest, PersonOption } from "./types";

export interface FeedbackFormProps {
  draft: ClassifyRequest;
  clients: PersonOption[];
  candidates: PersonOption[];
  isBusy: boolean;
  onChange: (draft: ClassifyRequest) => void;
  onSubmit: (request: ClassifyRequest) => void;
}

const MAX_FEEDBACK_LENGTH = 1000;

export function FeedbackForm(props: FeedbackFormProps) {
  const { draft, clients, candidates, isBusy, onChange } = props;
  const ids = { client: useId(), candidate: useId(), text: useId() };
  const clientGender = clients.find(({ id }) => id === draft.clientId)?.gender;
  const eligible = candidates.filter(({ gender }) => gender !== clientGender);
  const canSubmit =
    !isBusy && draft.candidateId !== "" && draft.feedbackText.trim().length > 0;

  const handleClientChange = (clientId: string) => {
    const gender = clients.find(({ id }) => id === clientId)?.gender;
    const firstEligible = candidates.find(
      (candidate) => candidate.gender !== gender,
    );
    onChange({ ...draft, clientId, candidateId: firstEligible?.id ?? "" });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) props.onSubmit(draft);
  };

  return (
    <Panel title="Or paste your own">
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.pair}>
          <label className={styles.field} htmlFor={ids.client}>
            <span>Client</span>
            <select
              id={ids.client}
              value={draft.clientId}
              onChange={(event) => handleClientChange(event.target.value)}
            >
              {clients.map(({ id, name, meta }) => (
                <option key={id} value={id}>{`${name} · ${meta}`}</option>
              ))}
            </select>
          </label>
          <label className={styles.field} htmlFor={ids.candidate}>
            <span>Candidate</span>
            <select
              id={ids.candidate}
              value={draft.candidateId}
              onChange={(event) =>
                onChange({ ...draft, candidateId: event.target.value })
              }
            >
              {eligible.map(({ id, name, meta }) => (
                <option key={id} value={id}>{`${name} · ${meta}`}</option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.field} htmlFor={ids.text}>
          <span>Client's feedback</span>
          <textarea
            id={ids.text}
            rows={4}
            maxLength={MAX_FEEDBACK_LENGTH}
            placeholder="e.g. Nice family but he smokes, I had clearly said no smokers"
            value={draft.feedbackText}
            onChange={(event) =>
              onChange({ ...draft, feedbackText: event.target.value })
            }
          />
        </label>
        <div className={styles.footer}>
          <span className={styles.counter}>
            {draft.feedbackText.length}/{MAX_FEEDBACK_LENGTH}
          </span>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {isBusy ? "Classifying…" : "Classify"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
