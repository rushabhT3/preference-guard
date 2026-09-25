"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Panel } from "@/components/Panel";
import { SourceTag } from "@/components/SourceTag";
import { Tag } from "@/components/Tag";
import type { PreferenceSuggestion } from "@/domain/preventability";
import styles from "./SuggestionPanel.module.css";

export interface SuggestionPanelProps {
  clientName: string | null;
  suggestions: PreferenceSuggestion[];
}

type Decision = "approved" | "dismissed";

export function SuggestionPanel({
  clientName,
  suggestions,
}: SuggestionPanelProps) {
  const [decisions, setDecisions] = useState<ReadonlyMap<string, Decision>>(
    new Map(),
  );
  const decide = (id: string, decision: Decision) =>
    setDecisions((previous) => new Map(previous).set(id, decision));
  const pending = suggestions.filter(
    ({ constraint }) => decisions.get(constraint.id) !== "dismissed",
  );

  return (
    <Panel title="Suggested preference updates" meta={clientName ?? undefined}>
      {pending.length === 0 ? (
        <p className={styles.empty}>
          {clientName
            ? `No repeated signal for ${clientName} yet. A draft rule appears once the same unstated reason shows up twice.`
            : "Classify feedback to see draft rules learned from that client's rejections."}
        </p>
      ) : (
        <ul className={styles.list}>
          {pending.map(({ constraint, evidence, occurrences }) => (
            <li key={constraint.id} className={styles.item}>
              <div className={styles.rule}>
                <span className={styles.label}>{constraint.label}</span>
                <SourceTag source={constraint.source} />
              </div>
              <p className={styles.evidence}>
                Seen in {occurrences} rejections:{" "}
                {evidence.map((line) => `“${line}”`).join(", ")}
              </p>
              {decisions.get(constraint.id) === "approved" ? (
                <Tag tone="accent">Approved for this session</Tag>
              ) : (
                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    isCompact
                    onClick={() => decide(constraint.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    isCompact
                    onClick={() => decide(constraint.id, "dismissed")}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
