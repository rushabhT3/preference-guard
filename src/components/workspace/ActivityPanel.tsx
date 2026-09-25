"use client";

import { padCount } from "@/components/format";
import { type ActivityKind, useActivity } from "./ActivityContext";
import styles from "./ActivityPanel.module.css";

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  sent: "Sent",
  override: "Override",
  sent_unverified: "Sent unverified",
};

const KINDS: ActivityKind[] = ["sent", "override", "sent_unverified"];
const RECENT_LIMIT = 5;

export function ActivityPanel() {
  const { entries } = useActivity();
  return (
    <section className={styles.panel} aria-labelledby="activity-heading">
      <div className={styles.header}>
        <h2 id="activity-heading" className={styles.title}>
          This session
        </h2>
        <dl className={styles.counts}>
          {KINDS.map((kind) => (
            <div key={kind} className={styles.count}>
              <dt>{ACTIVITY_LABELS[kind]}</dt>
              <dd>
                {padCount(
                  entries.filter((entry) => entry.kind === kind).length,
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Nothing sent yet. Unverified sends are logged apart from overrides and
          never count as violations.
        </p>
      ) : (
        <ol className={styles.log} aria-live="polite">
          {entries.slice(0, RECENT_LIMIT).map((entry) => (
            <li key={entry.id}>
              <span className={styles.kind}>{ACTIVITY_LABELS[entry.kind]}</span>
              {entry.candidateName} to {entry.clientName}
              {entry.detail && (
                <span className={styles.detail}> · {entry.detail}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
